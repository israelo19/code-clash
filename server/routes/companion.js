// The companion chat and the cost estimates. Both are answered by the AI
// service. The browser asks here, and we ask the AI service for it.
//
//   POST /api/chat       { message, history }      signed-in patient only
//   POST /api/estimate   { service_code | visit, zip_code, clinic? }   open, rate limited
//   GET  /api/clinics    ?service_code=&zip_code=&limit=               open, rate limited
//
// Mounted in App.js:   app.use("/api", require("./server/routes/companion"));

const express = require("express");
const db = require("../db");
const { callAi, json, AiError } = require("../ai");
const { rateLimit, requireUser } = require("../security");
const { cleanHistory, isServiceCode, isVisit, isZip, text } = require("../validate");

const router = express.Router();

const MAX_MESSAGE_LENGTH = 2000;

// Every chat message costs an AI call: twenty per five minutes per patient.
const limitChat = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  key: (req) => req.user && req.user.id,
  message: "That is a lot of questions at once. Wait a few minutes and try again.",
});

// Estimates cost no AI call, only some computing: sixty a minute per address,
// and a ceiling for everyone together in case addresses are faked.
const perAddress = rateLimit({ windowMs: 60 * 1000, max: 60 });
const overall = rateLimit({ windowMs: 60 * 1000, max: 1200, key: () => "everyone" });
const limitEstimates = [overall, perAddress];

// Send the AI service's answer back, or its error in our usual shape.
async function relay(res, path, init) {
  try {
    res.json(await callAi(path, init));
  } catch (problem) {
    if (problem instanceof AiError) return res.status(problem.status).json({ error: problem.message });
    throw problem;
  }
}

router.post("/chat", requireUser("patient"), limitChat, async (req, res) => {
  const message = text((req.body || {}).message, MAX_MESSAGE_LENGTH + 1);
  if (!message) return res.status(400).json({ error: "The message is empty." });
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `That message is too long. The limit is ${MAX_MESSAGE_LENGTH} characters.` });
  }

  // The records come from our database, for the signed-in patient. The browser
  // cannot choose whose records the companion reads, or slip in made-up ones.
  // Oldest first: when two records match a question equally, the companion picks the later one.
  const records = db
    .listDocuments(req.user.id)
    .reverse()
    .map(({ id, type, date, provider, summary, fields }) => ({ id, type, date, provider, summary, fields }));

  await relay(res, "/chat", json({ message, patient_id: req.user.id, history: cleanHistory((req.body || {}).history), records }));
});

router.post("/estimate", limitEstimates, async (req, res) => {
  const { service_code, visit, zip_code, clinic, new_patient } = req.body || {};
  if (!isZip(zip_code)) return res.status(400).json({ error: "Enter a 5-digit ZIP code." });
  if (!(isServiceCode(service_code) || isVisit(visit))) return res.status(400).json({ error: "Pick a service." });
  const body = { zip_code, new_patient: new_patient !== false };
  if (isVisit(visit)) body.visit = visit;
  else body.service_code = service_code;
  if (typeof clinic === "string" && clinic.length <= 200) body.clinic = clinic;
  await relay(res, "/estimate", json(body));
});

router.get("/clinics", limitEstimates, async (req, res) => {
  const { service_code, zip_code } = req.query;
  if (!isZip(zip_code)) return res.status(400).json({ error: "Enter a 5-digit ZIP code." });
  if (!isServiceCode(service_code)) return res.status(400).json({ error: "Pick a service." });
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 5, 1), 10);
  await relay(res, `/clinics?${new URLSearchParams({ service_code, zip_code, limit: String(limit) })}`);
});

module.exports = router;
