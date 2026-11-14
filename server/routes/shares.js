// Sharing records with a clinician by code.
//
//   POST /api/shares                       patient picks documents, gets a code that expires
//   GET  /api/shares/:code?viewer_id=...   clinician opens the code, every view is logged
//   GET  /api/patients/:id/shares          the patient's codes
//   GET  /api/patients/:id/access-log      who viewed what
//
// Mounted in App.js:   app.use("/api", require("./server/routes/shares"));

const express = require("express");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// No 0/O or 1/I, so a code is easy to read aloud.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
    let code = "";
    for (let i = 0; i < 6; i++) {
        code += alphabet[crypto.randomInt(alphabet.length)];
    }
    return code;
}

router.post("/shares", (req, res) => {
    const { patient_id, document_ids } = req.body || {};
    const minutes = Number((req.body || {}).minutes ?? 15);
    if (!patient_id || !Array.isArray(document_ids) || document_ids.length === 0) {
        return res.status(400).json({ error: "patient id and document ids are required" });
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return res.status(400).json({ error: "minutes must be a positive number" });
    }
    const docs = db.getDocuments(document_ids);
    const ok =
        docs.length === new Set(document_ids).size &&
        docs.every((d) => d.patient_id === patient_id);
    if (!ok) {
        return res.status(400).json({ error: "At least 1 of these documents aren't the patient's" });
    }
    let code = makeCode();
    while (db.getShare(code)) code = makeCode();
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    db.createShare({
        code,
        patientId: patient_id,
        documentIds: document_ids,
        expiresAt,
    });

    res.status(201).json({ code, patient_id, expires_at: expiresAt, document_ids });
});

router.get("/shares/:code", (req, res) => {
    const code = req.params.code.toUpperCase();
    const viewerId = req.query.viewer_id;
    const share = db.getShare(code);
    if (!share) {
        return res.status(404).json({ error: "Share code not found" });
    }
    if (new Date(share.expires_at) <= new Date()) {
        return res.status(410).json({ error: "This share has expired" });
    }
    const viewer = viewerId ? db.getUser(viewerId) : undefined;
    if (!viewer || viewer.role !== "clinician") {
        return res.status(403).json({ error: "Only clinicians can open shares" });
    }
    const documents = db.getDocuments(share.document_ids);
    for (const doc of documents) {
        db.logAccess({ shareCode: code, viewerId: viewer.id, documentId: doc.id });
    }
    const patient = db.getUser(share.patient_id);
    res.json({
        code,
        patient: share.patient_id,
        patient_name: patient ? patient.name : "",
        expires_at: share.expires_at,
        document_ids: share.document_ids,
        documents,
    });
});

router.get("/patients/:id/shares", (req, res) => {
    res.json(db.listShares(req.params.id));
});

router.get("/patients/:id/access-log", (req, res) => {
    res.json(db.listAccessLog(req.params.id));
});

module.exports = router;
