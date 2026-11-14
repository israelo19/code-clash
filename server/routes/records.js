// The patient's timeline, clinician notes, and the demo reset.
//
//   GET  /api/patients/:id/documents   the timeline, newest first
//   GET  /api/patients/:id/notes       notes clinicians left for this patient
//   POST /api/notes                    a clinician adds a note   { patient_id, clinician_id, text }
//   POST /api/reset                    put the demo data back, before a demo run
//
// (Uploading a document is in upload.js. Sharing is in shares.js.)
// Mounted in App.js:   app.use("/api", require("./server/routes/records"));

const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/patients/:id/documents", (req, res) => {
  res.json(db.listDocuments(req.params.id));
});

router.get("/patients/:id/notes", (req, res) => {
  res.json(db.listNotes(req.params.id));
});

router.post("/notes", (req, res) => {
  const { patient_id, clinician_id } = req.body || {};
  const text = String((req.body || {}).text || "").trim();
  const patient = patient_id && db.getUser(patient_id);
  const clinician = clinician_id && db.getUser(clinician_id);
  if (!patient || patient.role !== "patient") {
    return res.status(404).json({ error: "No such patient." });
  }
  if (!clinician || clinician.role !== "clinician") {
    return res.status(403).json({ error: "Only clinicians can add notes." });
  }
  if (!text) {
    return res.status(400).json({ error: "The note is empty." });
  }
  res.status(201).json(db.addNote({ patientId: patient.id, clinicianId: clinician.id, text }));
});

router.post("/reset", (req, res) => {
  db.reset();
  res.json({ reset: true });
});

module.exports = router;
