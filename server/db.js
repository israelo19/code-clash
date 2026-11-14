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

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "app.db");
const SEED_RECORDS = path.join(DATA_DIR, "sample_records.json");

// SQLite is built into Node 22.5 and newer. On an older Node, run
// `npm install better-sqlite3` and it is used instead. The two work the same
// way for everything this file does.
function openDatabase(file) {
  try {
    const BetterSqlite = require("better-sqlite3");
    return new BetterSqlite(file);
  } catch {
    const { DatabaseSync } = require("node:sqlite");
    return new DatabaseSync(file);
  }
}

const db = openDatabase(DB_PATH);

// The five tables from the project brief.
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id   TEXT PRIMARY KEY,
    role TEXT NOT NULL,             -- "patient" or "clinician"
    name TEXT NOT NULL
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

const now = () => new Date().toISOString(); // every time in the database is UTC

// ---------- demo data

// The same two accounts the web app signs in with (web/lib/mockData.ts).
const DEMO_PATIENT = { id: "u_maya", role: "patient", name: "Maya Johnson" };
const DEMO_CLINICIAN = { id: "u_lee", role: "clinician", name: "Dr. Sam Lee" };

// A share that never expires, so the clinician screen can be tried on its own.
const DEMO_SHARE = { code: "DEMO01", documentIds: ["doc_imm001", "doc_phys001"], expiresAt: "2099-01-01T00:00:00.000Z" };

function seed() {
  for (const user of [DEMO_PATIENT, DEMO_CLINICIAN]) {
    db.prepare("INSERT INTO users (id, role, name) VALUES (?, ?, ?)").run(user.id, user.role, user.name);
  }
  // Maya's starting records are the synthetic ones the AI service already uses.
  const records = JSON.parse(fs.readFileSync(SEED_RECORDS, "utf8")).maya || [];
  for (const record of records) addDocument(DEMO_PATIENT.id, record);
  createShare({ ...DEMO_SHARE, patientId: DEMO_PATIENT.id });
}

// Empty every table and put the demo data back. Run before each demo.
function reset() {
  db.exec(`
    DELETE FROM notes; DELETE FROM access_log; DELETE FROM shares; DELETE FROM documents; DELETE FROM users;
    DELETE FROM sqlite_sequence;
  `); // the last line restarts the automatic id numbers at 1
  seed();
}

// ---------- users

function listUsers() {
  return db.prepare("SELECT id, role, name FROM users ORDER BY role DESC, name").all();
}

function getUser(id) {
  return db.prepare("SELECT id, role, name FROM users WHERE id = ?").get(id);
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
function addDocument(patientId, record) {
  const id = record.id || `doc_${crypto.randomBytes(4).toString("hex")}`;
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

// A brand new database has no users yet, so fill it with the demo data.
if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count === 0) seed();

module.exports = {
  listUsers,
  getUser,
  listDocuments,
  getDocument,
  getDocuments,
  addDocument,
  createShare,
  getShare,
  listShares,
  logAccess,
  listAccessLog,
  addNote,
  listNotes,
  reset,
};
