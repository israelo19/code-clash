// The patient's timeline, clinician notes, and the demo reset.
//
//   GET  /api/patients/:id/documents   the timeline, newest first      (that patient only)
//   GET  /api/patients/:id/notes       notes clinicians left           (that patient only)
//   POST /api/notes                    a clinician adds a note   { patient_id, text }
//   POST /api/reset                    put the demo data back          (demo mode only)
//
// (Uploading a document is in upload.js. Sharing is in shares.js.)
// Mounted in App.js:   app.use("/api", require("./server/routes/records"));

const express = require("express");
const config = require("../config");
const db = require("../db");
const { rateLimit, requireUser, requireSelf } = require("../security");
const { text } = require("../validate");

const router = express.Router();

const MAX_NOTE_LENGTH = 2000;

router.get("/patients/:id/documents", requireSelf, (req, res) => {
  res.json(db.listDocuments(req.params.id));
});

router.get("/patients/:id/notes", requireSelf, (req, res) => {
  res.json(db.listNotes(req.params.id));
});

router.post("/notes", requireUser("clinician"), (req, res) => {
  const patientId = text((req.body || {}).patient_id, 64);
  const note = text((req.body || {}).text, MAX_NOTE_LENGTH + 1);
  const patient = patientId && db.getUser(patientId);

  // A clinician may only write to a patient who shared records with them, and
  // only while that share is still valid. The same answer is given when the
  // patient does not exist, so this cannot be used to find out who has an account.
  if (!patient || patient.role !== "patient" || !db.clinicianCanSeePatient(req.user.id, patient.id)) {
    return res.status(403).json({ error: "This patient has not shared records with you, or the share has expired." });
  }
  if (!note || typeof (req.body || {}).text !== "string") {
    return res.status(400).json({ error: "The note is empty." });
  }
  if (note.length > MAX_NOTE_LENGTH) {
    return res.status(400).json({ error: `The note is too long. The limit is ${MAX_NOTE_LENGTH} characters.` });
  }
  res.status(201).json(db.addNote({ patientId: patient.id, clinicianId: req.user.id, text: note }));
});

// Wipes the database and puts the demo data back. It exists for demos, so it
// only exists in demo mode. Anywhere else the route answers "not found".
const limitResets = rateLimit({ windowMs: 60 * 1000, max: 5 });

router.post("/reset", limitResets, (req, res) => {
  if (!config.demoMode) return res.status(404).json({ error: "Not found." });
  db.reset();
  res.json({ reset: true });
});

module.exports = router;
