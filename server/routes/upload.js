// Photo or PDF upload: the bridge between the web app and the document reader.
//
//   POST /api/patients/:id/documents     (form data with the file in a field named "file")
//
// What happens:
//   1. The signed-in patient sends a photo here.
//   2. We pass it, unchanged, to the AI service's POST /extract, which reads the
//      document and returns a structured record.
//   3. We check that record, save it in our database and send it back.
//
// Mounted in App.js:   app.use("/api", require("./server/routes/upload"));

const express = require("express");
const config = require("../config");
const db = require("../db");
const { callAi, AiError } = require("../ai");
const { rateLimit, requireSelf } = require("../security");
const { cleanRecord } = require("../validate");

const router = express.Router();

// Every upload costs an AI call, so each patient gets ten per ten minutes.
const limitUploads = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  key: (req) => req.user && req.user.id,
  message: "Too many uploads. Wait a few minutes and try again.",
});

// Collect the upload into memory as it arrives, but never more than the limit.
// Resolves to the bytes, or to null when the upload is too large. An oversized
// upload is read to its end and thrown away, not cut off: cutting the connection
// mid-upload makes browsers show "network error" instead of our message. Past
// four times the limit we stop being polite and drop the connection.
function readBody(req, alreadyTooLarge = false) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let tooLarge = alreadyTooLarge;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (!tooLarge && size > config.maxUploadBytes) {
        tooLarge = true;
        chunks.length = 0; // free what we had kept
      }
      if (!tooLarge) chunks.push(chunk);
      else if (size > 4 * config.maxUploadBytes) req.destroy();
    });
    req.on("end", () => resolve(tooLarge ? null : Buffer.concat(chunks)));
    // The sender gave up or the connection broke, or we dropped them: nothing to save.
    req.on("error", () => resolve(null));
    req.on("close", () => resolve(null));
  });
}

router.post("/patients/:id/documents", requireSelf, limitUploads, async (req, res) => {
  // A file upload arrives as "multipart/form-data". The header also carries the
  // marker that separates the parts, so we must pass the header on unchanged.
  const contentType = req.headers["content-type"] || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return res.status(400).json({ error: 'Send the photo or PDF as form data, in a field named "file".' });
  }

  // When the browser announces a size over the limit, nothing is kept at all.
  const announcedTooLarge = Number(req.headers["content-length"]) > config.maxUploadBytes;
  const upload = await readBody(req, announcedTooLarge);
  if (upload === null) {
    if (!req.complete) return; // the connection was dropped before the upload finished: nobody left to answer
    return res.status(413).json({ error: "That file is too large. The limit is 15 MB." });
  }

  // Hand the upload to the document reader exactly as it arrived. We do not
  // send a patient_id, so the AI service does not keep its own copy: this
  // database is the one place documents live.
  let record;
  try {
    record = await callAi("/extract", { method: "POST", headers: { "content-type": contentType }, body: upload });
  } catch (problem) {
    if (problem instanceof AiError) return res.status(problem.status).json({ error: problem.message });
    throw problem;
  }

  // The reader is an AI model, and the photo could say anything. Keep only the
  // fields we expect, at sensible lengths, before saving (see validate.js).
  const document = db.addDocument(req.user.id, cleanRecord(record));
  res.status(201).json(document);
});

module.exports = router;
