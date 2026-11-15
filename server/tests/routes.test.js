// Checks for the backend: sign-in, who may see what, sharing, notes and limits.
// Run from the top of the repo:   npm test
// Uses a throwaway in-memory database, so the real data/app.db is not touched.

process.env.DB_PATH = ":memory:";
process.env.DEMO_MODE = "1";
process.env.AI_URL = "http://127.0.0.1:9"; // nothing listens here, so no test can reach a real AI service

const test = require("node:test");
const assert = require("node:assert");
const app = require("../../App");
const db = require("../db");
const { hashPasswordSync } = require("../passwords");
const { resetRateLimits, SESSION_COOKIE } = require("../security");

const PASSWORD = "towson-demo-2026"; // the public demo password
const MAYA = "maya.johnson@carevault.example";
const DR_LEE = "sam.lee@carevault.example";

let server;
let base;

test.before(async () => {
  await new Promise((ready) => (server = app.listen(0, "127.0.0.1", ready)));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(() => server.close());

test.beforeEach(() => {
  db.reset();
  resetRateLimits();
});

// A tiny browser: remembers the session cookie and sends the app's request header.
function client() {
  let cookie = "";
  const send = async (method, path, body, { appHeader = true } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (appHeader) headers["x-carevault-request"] = "1";
    if (body !== undefined) headers["content-type"] = "application/json";
    const reply = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const setCookie = reply.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return reply;
  };
  return {
    get: (path) => send("GET", path),
    post: (path, body = {}, options) => send("POST", path, body, options),
    login: (email, password = PASSWORD, role) => send("POST", "/login", { email, password, role }),
    cookie: () => cookie,
  };
}

async function signedIn(email) {
  const browser = client();
  assert.strictEqual((await browser.login(email)).status, 200);
  return browser;
}

// ---------- sign-in

test("signing in gives a session cookie that scripts cannot read, and /me knows who it is", async () => {
  const browser = client();
  const reply = await fetch(base + "/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-carevault-request": "1" },
    body: JSON.stringify({ email: MAYA, password: PASSWORD }),
  });
  assert.strictEqual(reply.status, 200);
  const cookie = reply.headers.get("set-cookie");
  assert.match(cookie, new RegExp(`^${SESSION_COOKIE}=`));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  const body = await reply.json();
  assert.deepStrictEqual(body.user, { id: "u_maya", role: "patient", name: "Maya Johnson" });
  assert.ok(!JSON.stringify(body).includes("scrypt"), "the password hash must never be sent");

  await browser.login(MAYA);
  assert.deepStrictEqual((await (await browser.get("/me")).json()).user.id, "u_maya");
});

test("a wrong password, an unknown email and the wrong role all get the same answer", async () => {
  const wrongPassword = await client().login(MAYA, "not-the-password");
  const unknownEmail = await client().login("nobody@carevault.example");
  const wrongRole = await client().login(MAYA, PASSWORD, "clinician");
  for (const reply of [wrongPassword, unknownEmail, wrongRole]) assert.strictEqual(reply.status, 401);
  assert.deepStrictEqual(await wrongPassword.json(), await unknownEmail.json());
});

test("password guessing is cut off after ten tries", async () => {
  const browser = client();
  for (let i = 0; i < 10; i++) assert.strictEqual((await browser.login(MAYA, "guess" + i)).status, 401);
  const blocked = await browser.login(MAYA, PASSWORD); // even the right password has to wait now
  assert.strictEqual(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});

test("signing out ends the session", async () => {
  const browser = await signedIn(MAYA);
  assert.strictEqual((await browser.post("/logout")).status, 200);
  assert.strictEqual((await browser.get("/me")).status, 401);
});

test("a session stops working when it expires or sits unused", async () => {
  const expired = db.createSession("u_maya", -1); // expired an hour ago
  assert.strictEqual((await fetch(base + "/me", { headers: { cookie: `${SESSION_COOKIE}=${expired.token}` } })).status, 401);

  const fresh = db.createSession("u_maya", 8);
  assert.ok(db.getSessionUser(fresh.token, 30), "in use: fine");
  assert.strictEqual(db.getSessionUser(fresh.token, 0), undefined, "idle longer than allowed: signed out");
});

test("signing in again replaces the old session", async () => {
  const browser = await signedIn(MAYA);
  const oldCookie = browser.cookie();
  await browser.login(MAYA);
  assert.notStrictEqual(browser.cookie(), oldCookie);
  assert.strictEqual((await fetch(base + "/me", { headers: { cookie: oldCookie } })).status, 401, "the old cookie is dead");
});

test("a request marked by the browser as coming from another website is refused", async () => {
  const maya = await signedIn(MAYA);
  const reply = await fetch(base + "/shares", {
    method: "POST",
    headers: { cookie: maya.cookie(), "x-carevault-request": "1", "sec-fetch-site": "cross-site", "content-type": "application/json" },
    body: JSON.stringify({ document_ids: ["doc_imm001"] }),
  });
  assert.strictEqual(reply.status, 403);
});

test("passwords are stored as slow salted hashes", () => {
  const first = hashPasswordSync("same password");
  const second = hashPasswordSync("same password");
  assert.match(first, /^scrypt\$131072\$8\$1\$/);
  assert.notStrictEqual(first, second, "each hash has its own salt");
});

// ---------- who may see what

test("nothing about a patient is readable without signing in", async () => {
  const stranger = client();
  for (const path of ["/patients/u_maya/documents", "/patients/u_maya/notes", "/patients/u_maya/shares", "/patients/u_maya/access-log"]) {
    assert.strictEqual((await stranger.get(path)).status, 401, path);
  }
  assert.strictEqual((await stranger.get("/shares/DEMO01")).status, 401);
  assert.strictEqual((await stranger.post("/shares", { document_ids: ["doc_imm001"] })).status, 401);
  assert.strictEqual((await stranger.post("/notes", { patient_id: "u_maya", text: "hi" })).status, 401);
  assert.strictEqual((await stranger.post("/chat", { message: "hi" })).status, 401);
});

test("a patient sees their own timeline and nobody else's", async () => {
  const maya = await signedIn(MAYA);
  const documents = await (await maya.get("/patients/u_maya/documents")).json();
  assert.strictEqual(documents.length, 3);

  // A second patient, signed in properly, asks for Maya's records by changing the id.
  db.createUser({ id: "u_ben", role: "patient", name: "Ben Ortiz", email: "ben@carevault.example", passwordHash: hashPasswordSync("another-demo-password") });
  const ben = client();
  assert.strictEqual((await ben.login("ben@carevault.example", "another-demo-password")).status, 200);
  for (const path of ["/patients/u_maya/documents", "/patients/u_maya/notes", "/patients/u_maya/shares", "/patients/u_maya/access-log"]) {
    assert.strictEqual((await ben.get(path)).status, 403, path);
  }
  // He cannot share her documents either.
  assert.strictEqual((await ben.post("/shares", { document_ids: ["doc_imm001"] })).status, 400);
});

test("a clinician cannot read a patient's timeline directly, only through a share", async () => {
  const lee = await signedIn(DR_LEE);
  assert.strictEqual((await lee.get("/patients/u_maya/documents")).status, 403);
  assert.strictEqual((await lee.post("/shares", { document_ids: ["doc_imm001"] })).status, 403);
});

test("a request that changes something is refused without the app's header", async () => {
  const maya = await signedIn(MAYA);
  const forged = await maya.post("/shares", { document_ids: ["doc_imm001"] }, { appHeader: false });
  assert.strictEqual(forged.status, 403);
  assert.strictEqual((await (await maya.get("/patients/u_maya/shares")).json()).filter((s) => s.code !== "DEMO01").length, 0);
});

// ---------- sharing

test("a patient creates a share code for their own documents", async () => {
  const maya = await signedIn(MAYA);
  const reply = await maya.post("/shares", { document_ids: ["doc_imm001"], minutes: 15 });
  assert.strictEqual(reply.status, 201);
  const share = await reply.json();
  assert.match(share.code, /^[A-Z2-9]{6}$/);
  assert.strictEqual(share.patient_id, "u_maya");
  assert.deepStrictEqual(share.document_ids, ["doc_imm001"]);
  assert.ok(new Date(share.expires_at) > new Date());

  const codes = (await (await maya.get("/patients/u_maya/shares")).json()).map((s) => s.code);
  assert.ok(codes.includes(share.code));
});

test("a share is refused for a document that is not the patient's, for nothing, or for a bad time limit", async () => {
  const maya = await signedIn(MAYA);
  assert.strictEqual((await maya.post("/shares", { document_ids: ["no_such_doc"] })).status, 400);
  assert.strictEqual((await maya.post("/shares", { document_ids: [] })).status, 400);
  for (const minutes of [0, -5, 1.5, 60 * 24 * 365, 1e300, true, "15"]) {
    assert.strictEqual((await maya.post("/shares", { document_ids: ["doc_imm001"], minutes })).status, 400, `minutes: ${minutes}`);
  }
  // Picking the same document twice is fine and counts once.
  const twice = await maya.post("/shares", { document_ids: ["doc_imm001", "doc_imm001"] });
  assert.deepStrictEqual((await twice.json()).document_ids, ["doc_imm001"]);
  // The patient id in the request is ignored: the share always belongs to whoever is signed in.
  const reply = await maya.post("/shares", { patient_id: "u_someone_else", document_ids: ["doc_imm001"] });
  assert.strictEqual((await reply.json()).patient_id, "u_maya");
});

test("a clinician opens a code, sees only the shared documents, and the views are logged under their own name", async () => {
  const maya = await signedIn(MAYA);
  const { code } = await (await maya.post("/shares", { document_ids: ["doc_lab001"] })).json();

  const lee = await signedIn(DR_LEE);
  const reply = await lee.get(`/shares/${code.toLowerCase()}?viewer_id=u_someone_else`); // lower case works, the fake viewer is ignored
  assert.strictEqual(reply.status, 200);
  const opened = await reply.json();
  assert.strictEqual(opened.patient_name, "Maya Johnson");
  assert.deepStrictEqual(opened.documents.map((d) => d.id), ["doc_lab001"]);

  const log = await (await maya.get("/patients/u_maya/access-log")).json();
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0].viewer_id, "u_lee");
  assert.strictEqual(log[0].viewer_name, "Dr. Sam Lee");
  assert.strictEqual(log[0].document_id, "doc_lab001");
});

test("a code is not opened for a patient, when unknown, or after it expires, and none of that is logged", async () => {
  const maya = await signedIn(MAYA);
  const lee = await signedIn(DR_LEE);
  assert.strictEqual((await maya.get("/shares/DEMO01")).status, 403);
  assert.strictEqual((await lee.get("/shares/ZZZZZZ")).status, 404);
  assert.strictEqual((await lee.get("/shares/not-a-code")).status, 404);

  db.createShare({ code: "OLD001", patientId: "u_maya", documentIds: ["doc_imm001"], expiresAt: "2020-01-01T00:00:00.000Z" });
  assert.strictEqual((await lee.get("/shares/OLD001")).status, 410);

  assert.strictEqual((await (await maya.get("/patients/u_maya/access-log")).json()).length, 0);
});

test("a patient can end a share early, and only their own", async () => {
  const maya = await signedIn(MAYA);
  const lee = await signedIn(DR_LEE);
  const { code } = await (await maya.post("/shares", { document_ids: ["doc_lab001"], minutes: 60 })).json();
  assert.strictEqual((await lee.get(`/shares/${code}`)).status, 200);

  const remove = (browser, shareCode) =>
    fetch(`${base}/shares/${shareCode}`, { method: "DELETE", headers: { cookie: browser.cookie(), "x-carevault-request": "1" } });
  assert.strictEqual((await remove(lee, code)).status, 403, "a clinician cannot end it");
  assert.strictEqual((await remove(maya, code)).status, 200);
  assert.strictEqual((await lee.get(`/shares/${code}`)).status, 410, "the code no longer opens");
  assert.strictEqual((await remove(maya, code)).status, 404, "already ended");
  assert.strictEqual((await remove(maya, "ZZZZZZ")).status, 404);
  // After the share is ended the clinician can no longer write notes for her.
  assert.strictEqual((await lee.post("/notes", { patient_id: "u_maya", text: "late note" })).status, 403);
});

test("guessing share codes is cut off after ten tries", async () => {
  const lee = await signedIn(DR_LEE);
  for (let i = 0; i < 10; i++) assert.strictEqual((await lee.get(`/shares/ZZZZZ${i}`)).status, 404);
  assert.strictEqual((await lee.get("/shares/DEMO01")).status, 429);
});

// ---------- notes

test("a clinician can add a note only for a patient who shared with them, and it shows on the timeline", async () => {
  const maya = await signedIn(MAYA);
  const lee = await signedIn(DR_LEE);

  // Before opening any share: refused, with the same answer as for a patient who does not exist.
  const early = await lee.post("/notes", { patient_id: "u_maya", text: "Return in 2 days." });
  const nobody = await lee.post("/notes", { patient_id: "u_nobody", text: "Return in 2 days." });
  assert.strictEqual(early.status, 403);
  assert.deepStrictEqual(await early.json(), await nobody.json());

  await lee.get("/shares/DEMO01");
  const reply = await lee.post("/notes", { patient_id: "u_maya", clinician_id: "u_someone_else", text: "  Return in 2 days.  " });
  assert.strictEqual(reply.status, 201);
  const notes = await (await maya.get("/patients/u_maya/notes")).json();
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].text, "Return in 2 days.");
  assert.strictEqual(notes[0].clinician_id, "u_lee"); // from the session, not from the request
  assert.strictEqual(notes[0].clinician_name, "Dr. Sam Lee");
});

test("a note is refused from a patient, when empty, or when too long", async () => {
  const maya = await signedIn(MAYA);
  const lee = await signedIn(DR_LEE);
  await lee.get("/shares/DEMO01");
  assert.strictEqual((await maya.post("/notes", { patient_id: "u_maya", text: "hi" })).status, 403);
  assert.strictEqual((await lee.post("/notes", { patient_id: "u_maya", text: "   " })).status, 400);
  assert.strictEqual((await lee.post("/notes", { patient_id: "u_maya", text: { not: "text" } })).status, 400);
  assert.strictEqual((await lee.post("/notes", { patient_id: ["u_maya"], text: "hi" })).status, 403);
  assert.strictEqual((await lee.post("/notes", { patient_id: "u_maya", text: "x".repeat(2001) })).status, 400);
});

// ---------- companion and estimates

test("chat and estimates check their input before anything is sent to the AI service", async () => {
  const maya = await signedIn(MAYA);
  assert.strictEqual((await maya.post("/chat", { message: "" })).status, 400);
  assert.strictEqual((await maya.post("/chat", { message: "x".repeat(2001) })).status, 400);
  assert.strictEqual((await maya.post("/estimate", { service_code: "87880", zip_code: "2120" })).status, 400);
  assert.strictEqual((await maya.post("/estimate", { service_code: "87880; DROP TABLE users", zip_code: "21204" })).status, 400);
  assert.strictEqual((await maya.get("/clinics?service_code=87880&zip_code=abcde")).status, 400);
  // Valid input reaches the AI service. None is running in tests, so the answer is a clean 502.
  const reply = await maya.post("/chat", { message: "What vaccines do I have?" });
  assert.strictEqual(reply.status, 502);
  assert.ok(!JSON.stringify(await reply.json()).includes("127.0.0.1"), "errors must not reveal internal addresses");
});

test("an upload must be form data, from the signed-in patient, and not too large", async () => {
  const maya = await signedIn(MAYA);
  assert.strictEqual((await maya.post("/patients/u_maya/documents", { file: "not a form" })).status, 400);
  const tooBig = await fetch(base + "/patients/u_maya/documents", {
    method: "POST",
    headers: { cookie: maya.cookie(), "x-carevault-request": "1", "content-type": "multipart/form-data; boundary=x" },
    body: Buffer.alloc(15 * 1024 * 1024 + 1),
  });
  assert.strictEqual(tooBig.status, 413);
  const lee = await signedIn(DR_LEE);
  assert.strictEqual((await lee.post("/patients/u_maya/documents", {})).status, 403);
});

// ---------- the server as a whole

test("every answer carries the security headers and says nothing about the server software", async () => {
  const reply = await client().get("/health");
  assert.strictEqual(reply.headers.get("x-content-type-options"), "nosniff");
  assert.strictEqual(reply.headers.get("x-frame-options"), "DENY");
  assert.strictEqual(reply.headers.get("cache-control"), "no-store");
  assert.match(reply.headers.get("content-security-policy"), /default-src 'none'/);
  assert.strictEqual(reply.headers.get("x-powered-by"), null);
  assert.strictEqual(reply.headers.get("access-control-allow-origin"), null, "other websites are not allowed by default");
});

test("unknown routes and broken requests get short answers with no internals", async () => {
  const browser = client();
  const missing = await browser.get("/no-such-route");
  assert.strictEqual(missing.status, 404);
  assert.deepStrictEqual(await missing.json(), { error: "Not found." });
  const broken = await fetch(base + "/login", { method: "POST", headers: { "content-type": "application/json", "x-carevault-request": "1" }, body: "{not json" });
  assert.strictEqual(broken.status, 400);
  assert.deepStrictEqual(await broken.json(), { error: "That request could not be read." }); // no stack trace, no file paths
});

test("reset puts the demo data back and signs everyone out", async () => {
  const maya = await signedIn(MAYA);
  await maya.post("/shares", { document_ids: ["doc_imm001"] });
  assert.strictEqual((await client().post("/reset")).status, 200);
  assert.strictEqual((await maya.get("/me")).status, 401);
  const again = await signedIn(MAYA);
  const shares = await (await again.get("/patients/u_maya/shares")).json();
  assert.deepStrictEqual(shares.map((s) => s.code), ["DEMO01"]);
});
