// Sharing records with a clinician by code.
//
//   POST /api/shares                   patient picks documents, gets a code that expires
//   GET  /api/shares/:code             clinician opens the code, every view is logged
//   DELETE /api/shares/:code           the patient ends one of their codes early
//   GET  /api/patients/:id/shares      the patient's own codes
//   GET  /api/patients/:id/access-log  who viewed the patient's records
//
// Who is asking always comes from the sign-in session, never from the request.
// Mounted in App.js:   app.use("/api", require("./server/routes/shares"));

const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { rateLimit, requireUser, requireSelf } = require("../security");
const { isShareCode } = require("../validate");

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

const MAX_MINUTES = 7 * 24 * 60; // a code lasts a week at most
const MAX_DOCUMENTS = 50;

// A code has about a billion possibilities. Ten tries per ten minutes per
// clinician (and thirty per address) makes guessing one hopeless.
const TEN_MINUTES = 10 * 60 * 1000;
const tooManyCodes = "Too many codes tried. Wait a few minutes and try again.";
const limitOpensByUser = rateLimit({ windowMs: TEN_MINUTES, max: 10, key: (req) => req.user && req.user.id, message: tooManyCodes });
const limitOpensByAddress = rateLimit({ windowMs: TEN_MINUTES, max: 30, message: tooManyCodes });

router.post("/shares", requireUser("patient"), (req, res) => {
    const patient_id = req.user.id; // from the session: a patient can only share their own records
    const minutes = (req.body || {}).minutes ?? 15;
    const asked = (req.body || {}).document_ids;
    if (!Array.isArray(asked) || asked.length === 0 || asked.length > MAX_DOCUMENTS) {
        return res.status(400).json({ error: "Pick at least one document to share." });
    }
    if (!asked.every((id) => typeof id === "string" && id.length <= 64)) {
        return res.status(400).json({ error: "Those document ids are not valid." });
    }
    const document_ids = [...new Set(asked)]; // the same document picked twice counts once
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
        return res.status(400).json({ error: "minutes must be a whole number between 1 and one week" });
    }
    const docs = db.getDocuments(document_ids);
    const ok =
        docs.length === document_ids.length &&
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

router.get("/shares/:code", limitOpensByAddress, requireUser("clinician"), limitOpensByUser, (req, res) => {
    const code = String(req.params.code).toUpperCase();
    const share = isShareCode(code) ? db.getShare(code) : undefined;
    if (!share) {
        return res.status(404).json({ error: "Share code not found" });
    }
    if (new Date(share.expires_at) <= new Date()) {
        return res.status(410).json({ error: "This share has expired" });
    }
    const viewer = req.user; // the signed-in clinician
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

// The patient changes their mind: the code stops working now.
router.delete("/shares/:code", requireUser("patient"), (req, res) => {
    const code = String(req.params.code).toUpperCase();
    // The same answer whether the code is unknown, already over, or someone else's.
    if (!isShareCode(code) || !db.revokeShare(code, req.user.id)) {
        return res.status(404).json({ error: "No active share with that code." });
    }
    res.json({ revoked: true, code });
});

router.get("/patients/:id/shares", requireSelf, (req, res) => {
    res.json(db.listShares(req.params.id));
});

router.get("/patients/:id/access-log", requireSelf, (req, res) => {
    res.json(db.listAccessLog(req.params.id));
});

module.exports = router;
