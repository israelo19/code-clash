// Photo or PDF upload: the bridge between the web app and the document reader.
//
//   POST /api/patients/:id/documents     (form data with the file in a field named "file")
//
// What happens:
//   1. The web app sends the photo here.
//   2. We pass it, unchanged, to the Python AI service's POST /extract, which
//      reads the document and returns a structured record.
//   3. We save that record in our database and send it back to the web app.
//
// Mount it in the server's main file:   app.use("/api", require("./routes/upload"));

const express = require("express");
const db = require("../db");

const router = express.Router();

const AI_URL = process.env.AI_URL || "http://localhost:8000";
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB, plenty for a phone photo or a PDF

// Collect the upload into memory as it arrives. Stops early if it is too big.
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_UPLOAD_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

router.post("/patients/:id/documents", async (req, res) => {
  const patient = db.getUser(req.params.id);
  if (!patient || patient.role !== "patient") {
    return res.status(404).json({ error: "No such patient." });
  }

  // A file upload arrives as "multipart/form-data". The header also carries the
  // marker that separates the parts, so we must pass the header on unchanged.
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(400).json({ error: 'Send the photo or PDF as form data, in a field named "file".' });
  }

  const upload = await readBody(req);
  if (upload === null) {
    return res.status(413).json({ error: "That file is too large. The limit is 15 MB." });
  }

  // Hand the upload to the document reader exactly as it arrived. We do not
  // send a patient_id, so the AI service does not keep its own copy: this
  // database is the one place documents live.
  let reply;
  try {
    reply = await fetch(`${AI_URL}/extract`, {
      method: "POST",
      headers: { "content-type": contentType },
      body: upload,
    });
  } catch {
    return res.status(502).json({ error: "The document reader is not reachable. Is the AI service running?" });
  }

  const record = await reply.json().catch(() => null);
  if (!reply.ok || !record) {
    const reason = record && typeof record.detail === "string" ? record.detail : "The document reader could not read that file.";
    return res.status(reply.ok ? 502 : reply.status).json({ error: reason });
  }

  // Save it on the patient's timeline and return the saved version (with its new id).
  const document = db.addDocument(patient.id, record);
  res.status(201).json(document);
});

module.exports = router;
