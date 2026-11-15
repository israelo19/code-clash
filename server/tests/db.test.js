// Checks for server/db.js. Uses Node's built-in test runner, so nothing to install.
//
// Run from the repo root:
//   node --test server/tests/db.test.js

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DB_PATH = ":memory:"; // a throwaway database in memory, not data/app.db
const db = require("../db");

test.beforeEach(() => db.reset());

test("starts with the two demo accounts", () => {
  assert.deepEqual(db.listUsers().map((u) => u.id).sort(), ["u_lee", "u_maya"]);
  assert.equal(db.getUser("u_maya").role, "patient");
  assert.equal(db.getUser("u_lee").role, "clinician");
  assert.equal(db.getUser("nobody"), undefined);
});

test("starts with Maya's three documents, newest first, with fields as an object", () => {
  const documents = db.listDocuments("u_maya");
  assert.equal(documents.length, 3);
  const dates = documents.map((d) => d.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.equal(typeof documents[0].fields, "object");
  assert.equal(db.listDocuments("u_lee").length, 0);
});

test("saves a record from the document reader and gives it an id", () => {
  const saved = db.addDocument("u_maya", {
    type: "visit_summary",
    date: "2026-11-14",
    provider: "Campus Health",
    fields: { result: "Positive for strep" },
    summary: "Seen for a sore throat.",
  });
  assert.match(saved.id, /^doc_[0-9a-f]{16}$/);
  assert.equal(saved.patient_id, "u_maya");
  assert.deepEqual(saved.fields, { result: "Positive for strep" });
  assert.equal(db.listDocuments("u_maya")[0].id, saved.id); // newest date, so first on the timeline
  assert.deepEqual(db.getDocument(saved.id), saved);
});

test("getDocuments keeps the order asked for and skips unknown ids", () => {
  const found = db.getDocuments(["doc_phys001", "missing", "doc_imm001"]);
  assert.deepEqual(found.map((d) => d.id), ["doc_phys001", "doc_imm001"]);
});

test("stores a share and reads it back with its document ids as a list", () => {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const share = db.createShare({ code: "ABC234", patientId: "u_maya", documentIds: ["doc_imm001"], expiresAt });
  assert.deepEqual(share.document_ids, ["doc_imm001"]);
  assert.equal(share.expires_at, expiresAt);
  assert.equal(db.getShare("ABC234").patient_id, "u_maya");
  assert.equal(db.getShare("NOPE00"), undefined);
  assert.ok(db.listShares("u_maya").some((s) => s.code === "ABC234"));
});

test("refuses a second share with the same code", () => {
  assert.throws(() => db.createShare({ code: "DEMO01", patientId: "u_maya", documentIds: [], expiresAt: "2099-01-01" }));
});

test("the seeded DEMO01 share points at real documents and has not expired", () => {
  const share = db.getShare("DEMO01");
  assert.equal(db.getDocuments(share.document_ids).length, share.document_ids.length);
  assert.ok(new Date(share.expires_at) > new Date());
});

test("the access log shows who viewed which document, only to the right patient", () => {
  assert.deepEqual(db.listAccessLog("u_maya"), []);
  db.logAccess({ shareCode: "DEMO01", viewerId: "u_lee", documentId: "doc_imm001" });
  db.logAccess({ shareCode: "DEMO01", viewerId: "u_lee", documentId: "doc_phys001" });

  const log = db.listAccessLog("u_maya");
  assert.equal(log.length, 2);
  assert.equal(log[0].viewer_name, "Dr. Sam Lee");
  assert.equal(log[0].share_code, "DEMO01");
  assert.deepEqual(log.map((e) => e.document_type).sort(), ["immunization_record", "physical_form"]);
  assert.equal(typeof log[0].id, "string");
  assert.ok(!Number.isNaN(Date.parse(log[0].viewed_at)));

  assert.deepEqual(db.listAccessLog("u_lee"), []); // nobody else sees Maya's log
});

test("saves a clinician note with the clinician's name", () => {
  const note = db.addNote({ patientId: "u_maya", clinicianId: "u_lee", text: "Finish the antibiotics." });
  assert.equal(note.clinician_name, "Dr. Sam Lee");
  assert.equal(note.text, "Finish the antibiotics.");
  assert.deepEqual(db.listNotes("u_maya"), [note]);
  assert.deepEqual(db.listNotes("u_lee"), []);
});

test("reset throws away everything added and restores the demo data", () => {
  db.addDocument("u_maya", { type: "other" });
  db.logAccess({ shareCode: "DEMO01", viewerId: "u_lee", documentId: "doc_imm001" });
  db.addNote({ patientId: "u_maya", clinicianId: "u_lee", text: "x" });
  db.reset();
  assert.equal(db.listDocuments("u_maya").length, 3);
  assert.deepEqual(db.listAccessLog("u_maya"), []);
  assert.deepEqual(db.listNotes("u_maya"), []);
  assert.equal(db.addNote({ patientId: "u_maya", clinicianId: "u_lee", text: "first" }).id, "1"); // ids restart
});
