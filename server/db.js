// The app's database. Every SQL statement in the backend lives in this file.
//
// Routes never write SQL. They call the functions exported at the bottom, e.g.
//
//   const db = require("./db");            // from a file next to this one
//   const docs = db.listDocuments("u_maya");
//
// The data sits in one SQLite file, data/app.db, which is created and filled
// with the demo data the first time this file is loaded. Rows come back with
// the same names the web app's types use (patient_id, expires_at, ...).

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const config = require("./config");
const { hashPasswordSync } = require("./passwords");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const SEED_RECORDS = path.join(DATA_DIR, "sample_records.json");

// SQLite is built into Node (no flag needed from 22.13). If you have installed
// the better-sqlite3 package yourself it is used instead. The two work the same
// way for everything this file does.
function openDatabase(file) {
  let BetterSqlite = null;
  try {
    BetterSqlite = require("better-sqlite3");
  } catch {
    // not installed, which is the normal case: use the built-in one
  }
  if (BetterSqlite) return new BetterSqlite(file); // a real error opening the file is not hidden
  const { DatabaseSync } = require("node:sqlite");
  return new DatabaseSync(file);
}

const db = openDatabase(DB_PATH);

// The five tables from the project brief, plus sessions for sign-in.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    role          TEXT NOT NULL,    -- "patient" or "clinician"
    name          TEXT NOT NULL,
    email         TEXT UNIQUE,      -- lower case, used to sign in
    password_hash TEXT              -- a slow one-way hash, never the password (see passwords.js)
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,  -- a hash of the cookie value, so a copy of this table cannot be used to sign in
    user_id      TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,     -- for signing out sessions that sit unused
    expires_at   TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS documents (
    id         TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    type       TEXT,                -- e.g. "visit_summary", as the document reader names it
    date       TEXT,                -- date on the document, YYYY-MM-DD
    provider   TEXT,
    summary    TEXT,
    fields     TEXT,                -- key facts, stored as JSON text
    file_url   TEXT,
    created_at TEXT
  );
  CREATE TABLE IF NOT EXISTS shares (
    code         TEXT PRIMARY KEY,
    patient_id   TEXT NOT NULL,
    document_ids TEXT NOT NULL,     -- list of document ids, stored as JSON text
    expires_at   TEXT NOT NULL,
    created_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS access_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    share_code  TEXT,
    viewer_id   TEXT,
    document_id TEXT,
    viewed_at   TEXT
  );
  CREATE TABLE IF NOT EXISTS notes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id   TEXT,
    clinician_id TEXT,
    text         TEXT,
    created_at   TEXT
  );
`);

// A database file made before sign-in existed has no email or password columns. Add them.
const userColumns = db.prepare("PRAGMA table_info(users)").all().map((column) => column.name);
if (!userColumns.includes("email")) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT; ALTER TABLE users ADD COLUMN password_hash TEXT;");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (email);");
}

// Sessions are throwaway, so if the table has an older shape it is simply rebuilt.
if (!db.prepare("PRAGMA table_info(sessions)").all().some((column) => column.name === "last_seen_at")) {
  db.exec(`DROP TABLE sessions;
    CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
                           last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL);`);
}

const now = () => new Date().toISOString(); // every time in the database is UTC

// ---------- demo data

// The two demo accounts. The web app's sign-in page fills in the same email and
// password (web/lib/mockData.ts). THE PASSWORD IS PUBLIC: it is in this repo. These
// accounts exist only in demo mode (see config.js), which is off in production.
const DEMO_PASSWORD = "towson-demo-2026";
const DEMO_PATIENT = { id: "u_maya", role: "patient", name: "Maya Johnson", email: "maya.johnson@carevault.example" };
const DEMO_CLINICIAN = { id: "u_lee", role: "clinician", name: "Dr. Sam Lee", email: "sam.lee@carevault.example" };

// A share that never expires, so the clinician screen can be tried on its own.
const DEMO_SHARE = { code: "DEMO01", documentIds: ["doc_imm001", "doc_phys001"], expiresAt: "2099-01-01T00:00:00.000Z" };

// Hashing is slow on purpose, so hash the demo password once and reuse it.
let demoPasswordHash = null;

function seed() {
  demoPasswordHash = demoPasswordHash || hashPasswordSync(DEMO_PASSWORD);
  for (const user of [DEMO_PATIENT, DEMO_CLINICIAN]) createUser({ ...user, passwordHash: demoPasswordHash });
  // Maya's starting records are synthetic. Their ids come from the sample file.
  const records = JSON.parse(fs.readFileSync(SEED_RECORDS, "utf8")).maya || [];
  for (const record of records) addDocument(DEMO_PATIENT.id, record, { id: record.id });
  createShare({ ...DEMO_SHARE, patientId: DEMO_PATIENT.id });
}

// Empty every table and put the demo data back. Run before each demo.
// Only reachable in demo mode: it deletes everything.
function reset() {
  demoPasswordHash = demoPasswordHash || hashPasswordSync(DEMO_PASSWORD);
  // All or nothing: if anything fails half way, the database is left as it was.
  db.exec("BEGIN");
  try {
    db.exec(`
      DELETE FROM sessions; DELETE FROM notes; DELETE FROM access_log; DELETE FROM shares; DELETE FROM documents;
      DELETE FROM users; DELETE FROM sqlite_sequence;
    `); // the last line restarts the automatic id numbers at 1
    seed();
    db.exec("COMMIT");
  } catch (problem) {
    db.exec("ROLLBACK");
    throw problem;
  }
}

// ---------- users

// These never return the password hash, so it cannot end up in a response by accident.
function listUsers() {
  return db.prepare("SELECT id, role, name FROM users ORDER BY role DESC, name").all();
}

function getUser(id) {
  return db.prepare("SELECT id, role, name FROM users WHERE id = ?").get(id);
}

// For sign-in only: the one place the password hash is read.
function getUserForSignIn(email) {
  return db
    .prepare("SELECT id, role, name, password_hash FROM users WHERE email = ?")
    .get(String(email || "").trim().toLowerCase());
}

// passwordHash comes from passwords.js. There is no sign-up screen yet, so
// outside demo mode accounts are added by calling this from a script.
function createUser({ id, role, name, email, passwordHash }) {
  db.prepare("INSERT INTO users (id, role, name, email, password_hash) VALUES (?, ?, ?, ?, ?)").run(
    id,
    role,
    name,
    String(email).trim().toLowerCase(),
    passwordHash
  );
  return getUser(id);
}

// ---------- sessions

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

// Make a session. The token is 32 random bytes (256 bits), far beyond guessing.
// The browser keeps the token in a cookie. We keep only its hash.
function createSession(userId, hours) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now()); // tidy up old ones
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now(),
    now(),
    expiresAt
  );
  return { token, expiresAt };
}

// The user a session token belongs to, or undefined if the token is unknown,
// has expired, or has sat unused for longer than `idleMinutes`. Each use counts
// as activity and restarts the idle clock.
function getSessionUser(token, idleMinutes = 30) {
  const tokenHash = hashToken(token);
  const idleSince = new Date(Date.now() - idleMinutes * 60 * 1000).toISOString();
  const user = db
    .prepare(
      `SELECT users.id, users.role, users.name FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND sessions.last_seen_at > ?`
    )
    .get(tokenHash, now(), idleSince);
  if (user) db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").run(now(), tokenHash);
  return user;
}

function deleteSession(token) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

// ---------- documents

// "fields" is stored as JSON text. Turn it back into an object on the way out.
function readDocument(row) {
  return row && { ...row, fields: JSON.parse(row.fields || "{}") };
}

// The patient's timeline, newest first.
function listDocuments(patientId) {
  return db
    .prepare("SELECT * FROM documents WHERE patient_id = ? ORDER BY date DESC, created_at DESC")
    .all(patientId)
    .map(readDocument);
}

function getDocument(id) {
  return readDocument(db.prepare("SELECT * FROM documents WHERE id = ?").get(id));
}

// Several documents at once, in the order asked for. Unknown ids are skipped.
function getDocuments(ids) {
  return ids.map(getDocument).filter(Boolean);
}

// Save a record from the document reader (type, date, provider, fields, summary).
// The id is always made here. Only the seed passes one in, from the sample file.
function addDocument(patientId, record, { id = `doc_${crypto.randomBytes(8).toString("hex")}` } = {}) {
  db.prepare(
    `INSERT INTO documents (id, patient_id, type, date, provider, summary, fields, file_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    patientId,
    record.type || "other",
    record.date || "",
    record.provider || "",
    record.summary || "",
    JSON.stringify(record.fields || {}),
    record.file_url || null,
    now()
  );
  return getDocument(id);
}

// ---------- shares

function readShare(row) {
  return row && { ...row, document_ids: JSON.parse(row.document_ids) };
}

// The route decides the code and the expiry time. This only stores them.
function createShare({ code, patientId, documentIds, expiresAt }) {
  db.prepare(
    "INSERT INTO shares (code, patient_id, document_ids, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(code, patientId, JSON.stringify(documentIds), expiresAt, now());
  return getShare(code);
}

// Returns the share whether or not it has expired. The route checks expires_at.
function getShare(code) {
  return readShare(db.prepare("SELECT * FROM shares WHERE code = ?").get(code));
}

// End a share now, whatever its time limit was. Only the patient who made it can.
// Returns true if a share was ended.
function revokeShare(code, patientId) {
  const result = db
    .prepare("UPDATE shares SET expires_at = ? WHERE code = ? AND patient_id = ? AND expires_at > ?")
    .run(now(), code, patientId, now());
  return Number(result.changes) > 0;
}

function listShares(patientId) {
  return db
    .prepare("SELECT * FROM shares WHERE patient_id = ? ORDER BY expires_at DESC")
    .all(patientId)
    .map(readShare);
}

// ---------- access log

// Call once for every document a clinician is shown.
function logAccess({ shareCode, viewerId, documentId }) {
  db.prepare("INSERT INTO access_log (share_code, viewer_id, document_id, viewed_at) VALUES (?, ?, ?, ?)").run(
    shareCode,
    viewerId,
    documentId,
    now()
  );
}

// Everything anyone has viewed of this patient's records, newest first.
// The log itself only stores ids. The joins look up what the patient wants to
// read: which of their shares it was, the viewer's name and the document type.
function listAccessLog(patientId) {
  return db
    .prepare(
      `SELECT log.id, log.share_code, log.viewer_id, viewer.name AS viewer_name,
              log.document_id, document.type AS document_type, log.viewed_at
       FROM access_log AS log
       JOIN shares ON shares.code = log.share_code
       LEFT JOIN users AS viewer ON viewer.id = log.viewer_id
       LEFT JOIN documents AS document ON document.id = log.document_id
       WHERE shares.patient_id = ?
       ORDER BY log.viewed_at DESC, log.id DESC`
    )
    .all(patientId)
    .map((row) => ({ ...row, id: String(row.id) }));
}

// Has this clinician opened a share from this patient that is still valid?
// Used before a clinician may write a note on the patient's timeline.
function clinicianCanSeePatient(clinicianId, patientId) {
  const row = db
    .prepare(
      `SELECT 1 AS yes FROM access_log AS log JOIN shares ON shares.code = log.share_code
       WHERE log.viewer_id = ? AND shares.patient_id = ? AND shares.expires_at > ? LIMIT 1`
    )
    .get(clinicianId, patientId, now());
  return Boolean(row);
}

// ---------- notes

const NOTE_WITH_NAME = `
  SELECT notes.id, notes.patient_id, notes.clinician_id, clinician.name AS clinician_name,
         notes.text, notes.created_at
  FROM notes LEFT JOIN users AS clinician ON clinician.id = notes.clinician_id`;

function addNote({ patientId, clinicianId, text }) {
  const result = db
    .prepare("INSERT INTO notes (patient_id, clinician_id, text, created_at) VALUES (?, ?, ?, ?)")
    .run(patientId, clinicianId, text, now());
  const row = db.prepare(`${NOTE_WITH_NAME} WHERE notes.id = ?`).get(Number(result.lastInsertRowid));
  return { ...row, id: String(row.id) };
}

function listNotes(patientId) {
  return db
    .prepare(`${NOTE_WITH_NAME} WHERE notes.patient_id = ? ORDER BY notes.created_at DESC, notes.id DESC`)
    .all(patientId)
    .map((row) => ({ ...row, id: String(row.id) }));
}

// ---------- first run

// In demo mode a brand new database is filled with the demo data. A database
// from before sign-in existed has demo users with no password, so it is rebuilt.
if (config.demoMode) {
  const demoUser = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(DEMO_PATIENT.id);
  if (!demoUser || !demoUser.password_hash) reset();
}

module.exports = {
  listUsers,
  getUser,
  getUserForSignIn,
  createUser,
  createSession,
  getSessionUser,
  deleteSession,
  clinicianCanSeePatient,
  listDocuments,
  getDocument,
  getDocuments,
  addDocument,
  createShare,
  getShare,
  revokeShare,
  listShares,
  logAccess,
  listAccessLog,
  addNote,
  listNotes,
  reset,
};
