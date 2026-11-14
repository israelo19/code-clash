// Checks for the backend routes: sharing, the access log, notes and the timeline.
// Run from the top of the repo:   npm test
// Uses a throwaway in-memory database, so the real data/app.db is not touched.

process.env.DB_PATH = ":memory:";

const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const db = require("../db");

let server;
let base;

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", require("../routes/shares"));
  app.use("/api", require("../routes/records"));
  await new Promise((ready) => (server = app.listen(0, ready)));
  base = `http://localhost:${server.address().port}/api`;
});

test.after(() => server.close());

test.beforeEach(() => db.reset());

const get = (path) => fetch(base + path);
const post = (path, body) =>
  fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("the timeline lists Maya's three starting records", async () => {
  const documents = await (await get("/patients/u_maya/documents")).json();
  assert.strictEqual(documents.length, 3);
});

test("a patient creates a share code for their own documents", async () => {
  const reply = await post("/shares", { patient_id: "u_maya", document_ids: ["doc_imm001"], minutes: 15 });
  assert.strictEqual(reply.status, 201);
  const share = await reply.json();
  assert.match(share.code, /^[A-Z2-9]{6}$/);
  assert.deepStrictEqual(share.document_ids, ["doc_imm001"]);
  assert.ok(new Date(share.expires_at) > new Date());

  const codes = (await (await get("/patients/u_maya/shares")).json()).map((s) => s.code);
  assert.ok(codes.includes(share.code));
});

test("a share is refused when a document is not the patient's, or nothing is picked", async () => {
  assert.strictEqual((await post("/shares", { patient_id: "u_maya", document_ids: ["no_such_doc"] })).status, 400);
  assert.strictEqual((await post("/shares", { patient_id: "u_maya", document_ids: [] })).status, 400);
  assert.strictEqual((await post("/shares", { patient_id: "u_maya", document_ids: ["doc_imm001"], minutes: 0 })).status, 400);
});

test("a clinician opens a code, sees only the shared documents, and the views are logged", async () => {
  const { code } = await (await post("/shares", { patient_id: "u_maya", document_ids: ["doc_lab001"] })).json();

  const reply = await get(`/shares/${code.toLowerCase()}?viewer_id=u_lee`); // lower case works too
  assert.strictEqual(reply.status, 200);
  const opened = await reply.json();
  assert.strictEqual(opened.patient_name, "Maya Johnson");
  assert.deepStrictEqual(opened.documents.map((d) => d.id), ["doc_lab001"]);

  const log = await (await get("/patients/u_maya/access-log")).json();
  assert.strictEqual(log.length, 1);
  assert.strictEqual(log[0].viewer_name, "Dr. Sam Lee");
  assert.strictEqual(log[0].document_id, "doc_lab001");
});

test("a code is not opened for a patient, for nobody, when unknown, or after it expires", async () => {
  assert.strictEqual((await get("/shares/DEMO01?viewer_id=u_maya")).status, 403);
  assert.strictEqual((await get("/shares/DEMO01")).status, 403);
  assert.strictEqual((await get("/shares/ZZZZZZ?viewer_id=u_lee")).status, 404);

  db.createShare({ code: "OLD001", patientId: "u_maya", documentIds: ["doc_imm001"], expiresAt: "2020-01-01T00:00:00.000Z" });
  assert.strictEqual((await get("/shares/OLD001?viewer_id=u_lee")).status, 410);

  // None of those attempts showed a document, so nothing was logged.
  assert.strictEqual((await (await get("/patients/u_maya/access-log")).json()).length, 0);
});

test("a clinician adds a note and it shows on the patient's timeline", async () => {
  const reply = await post("/notes", { patient_id: "u_maya", clinician_id: "u_lee", text: "  Return in 2 days.  " });
  assert.strictEqual(reply.status, 201);
  const notes = await (await get("/patients/u_maya/notes")).json();
  assert.strictEqual(notes.length, 1);
  assert.strictEqual(notes[0].text, "Return in 2 days.");
  assert.strictEqual(notes[0].clinician_name, "Dr. Sam Lee");
});

test("a note is refused from a patient or when it is empty", async () => {
  assert.strictEqual((await post("/notes", { patient_id: "u_maya", clinician_id: "u_maya", text: "hi" })).status, 403);
  assert.strictEqual((await post("/notes", { patient_id: "u_maya", clinician_id: "u_lee", text: "   " })).status, 400);
});

test("reset removes shares and notes and puts the demo data back", async () => {
  await post("/shares", { patient_id: "u_maya", document_ids: ["doc_imm001"] });
  await post("/notes", { patient_id: "u_maya", clinician_id: "u_lee", text: "note" });
  assert.strictEqual((await post("/reset", {})).status, 200);

  const shares = await (await get("/patients/u_maya/shares")).json();
  assert.deepStrictEqual(shares.map((s) => s.code), ["DEMO01"]);
  assert.strictEqual((await (await get("/patients/u_maya/notes")).json()).length, 0);
});
