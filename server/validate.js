// Checks on things that come from outside: the browser, and the AI model.
// Nothing from either is trusted until it has been through here.

const DOC_TYPES = [
  "visit_summary",
  "lab_result",
  "immunization_record",
  "prescription",
  "physical_form",
  "insurance_card",
  "other",
];

const VISITS = ["office", "strep", "flu", "blood_count", "vaccine"];

// Text from outside, trimmed and cut to `max` characters. Anything that is not
// text or a number (a list, an object, true/false) becomes an empty string, so
// it cannot turn into "[object Object]" or crash a route.
function text(value, max) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// A record the document reader returned. The reader is an AI model reading a
// photo that anyone could have written anything on, so its output is treated as
// untrusted: only the fields we expect are kept, and every one is cut to a
// sensible length. Any "id" it sent is dropped. The database makes the id.
function cleanRecord(record) {
  const source = record && typeof record === "object" ? record : {};
  const fields = {};
  const entries = source.fields && typeof source.fields === "object" && !Array.isArray(source.fields) ? Object.entries(source.fields) : [];
  for (const [key, value] of entries.slice(0, 40)) {
    const label = text(key, 80);
    if (label && label !== "__proto__") fields[label] = text(value !== null && typeof value === "object" ? JSON.stringify(value) : value, 500);
  }
  const date = text(source.date, 10);
  return {
    type: DOC_TYPES.includes(source.type) ? source.type : "other",
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "",
    provider: text(source.provider, 200),
    summary: text(source.summary, 2000),
    fields,
  };
}

const isZip = (value) => typeof value === "string" && /^\d{5}$/.test(value);
const isServiceCode = (value) => typeof value === "string" && /^[A-Za-z0-9]{5}$/.test(value);
const isShareCode = (value) => typeof value === "string" && /^[A-Z0-9]{6}$/.test(value);
const isVisit = (value) => VISITS.includes(value);

// Earlier chat turns sent by the browser: only "user" and "assistant" turns,
// only text, at most the last 20, each cut to 4,000 characters.
function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
    .slice(-20)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000) }));
}

module.exports = { cleanRecord, cleanHistory, isZip, isServiceCode, isShareCode, isVisit, text };
