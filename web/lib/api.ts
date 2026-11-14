"use client";

// How the screens reach the rest of the system. Every screen goes through these functions.
//
// THE BACKEND (App.js at the repo root, port 4000) keeps the data in its database:
//   timeline and upload    GET /api/patients/:id/documents     POST /api/patients/:id/documents
//   share codes            POST /api/shares                    GET /api/shares/:code
//   access log and notes   GET /api/patients/:id/access-log    GET /api/patients/:id/notes   POST /api/notes
//
// THE AI SERVICE (ai/main.py, port 8000) does the thinking:
//   companion chat         POST /chat          (it searches the records and calls the cost model)
//   cost estimates         POST /estimate      GET /clinics      (the trained cost model)
//   The document reader (POST /extract) is called by the backend during an upload, not from here.
//
// Sign-in is still the two demo accounts, checked in the browser (checkLogin below).

import { DEMO_LOGINS, DEMO_USERS, SERVICES } from "./mockData";
import type {
  AccessLogEntry,
  ChatMessage,
  ChatSource,
  ClinicianNote,
  DocumentType,
  Estimate,
  HealthDocument,
  Role,
  Share,
  User,
} from "./types";

// ---------- talking to the two services

// Where each service runs. The defaults are ports 4000 and 8000 on the machine this page
// came from, so a phone on the same Wi-Fi as the laptop reaches the laptop's services too.
// Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_AI_URL when they are hosted somewhere else.
const SERVICES_AT = {
  backend: { name: "backend", port: 4000, url: process.env.NEXT_PUBLIC_API_URL },
  ai: { name: "AI service", port: 8000, url: process.env.NEXT_PUBLIC_AI_URL },
};

// A failed request. `status` is the HTTP status code, or 0 when the service did not answer at all.
class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// One request to a service. Throws a RequestError with a readable message when it fails.
async function call<T>(service: keyof typeof SERVICES_AT, path: string, init?: RequestInit): Promise<T> {
  const { name, port, url } = SERVICES_AT[service];
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  let reply: Response;
  try {
    reply = await fetch((url || `http://${host}:${port}`) + path, init);
  } catch {
    throw new RequestError(`Can't reach the ${name}. Is it running on port ${port}?`, 0);
  }
  if (!reply.ok) {
    // The backend explains errors in "error", the AI service in "detail".
    const body = await reply.json().catch(() => null);
    const reason = body?.error ?? body?.detail;
    throw new RequestError(typeof reason === "string" ? reason : `The ${name} answered with error ${reply.status}.`, reply.status);
  }
  return (await reply.json()) as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

const post = (body: unknown): RequestInit => ({ method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });

// ---------- sign-in (demo accounts, checked in the browser)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Checks an email and password for the sign-in page. Returns the user, or null if they don't match.
// It compares them with the two seeded demo accounts in mockData.ts. Real sign-up is cut for today.
export async function checkLogin(role: Role, email: string, password: string): Promise<User | null> {
  await wait(600);
  const demo = DEMO_LOGINS[role];
  const matches = email.trim().toLowerCase() === demo.email && password === demo.password;
  return matches ? DEMO_USERS[role] : null;
}

// ---------- documents (backend database)

// A record the way the backend stores it, which is the way the document reader wrote it.
type StoredRecord = {
  id: string;
  type: string; // e.g. "visit_summary"
  date: string;
  provider: string;
  summary: string;
  fields: Record<string, string>;
};

// The document reader names types like "visit_summary". The screens show "Visit summary".
const TYPE_LABELS: Record<string, DocumentType> = {
  immunization_record: "Immunization record",
  visit_summary: "Visit summary",
  lab_result: "Lab result",
  physical_form: "Physical form",
  prescription: "Prescription",
};

// The document reader names fields like "read_date". The screens show "Read date".
function fieldLabel(key: string) {
  const words = key.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toDocument(record: StoredRecord, patientId: string): HealthDocument {
  return {
    id: record.id,
    patient_id: patientId,
    type: TYPE_LABELS[record.type] ?? "Other",
    date: record.date || new Date().toISOString().slice(0, 10),
    provider: record.provider || "Unknown provider",
    summary: record.summary || "",
    fields: Object.fromEntries(Object.entries(record.fields ?? {}).map(([key, value]) => [fieldLabel(key), String(value)])),
  };
}

const storedRecords = (patientId: string) => call<StoredRecord[]>("backend", `/api/patients/${patientId}/documents`);

// The patient's timeline, newest first. If the backend is down this returns an
// empty list, so a screen shows "no records" and not a crash.
export async function listDocuments(patientId: string): Promise<HealthDocument[]> {
  try {
    const records = await storedRecords(patientId);
    return records.map((r) => toDocument(r, patientId)).sort((a, b) => b.date.localeCompare(a.date));
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export async function getDocument(id: string): Promise<HealthDocument | null> {
  const documents = await listDocuments(DEMO_USERS.patient.id);
  return documents.find((d) => d.id === id) ?? null;
}

// Send the photo or PDF to the backend. It passes the file to the document reader, saves
// the record on the patient's timeline and returns it. Throws if the file can't be read.
export async function uploadAndExtract(patientId: string, file: File): Promise<HealthDocument> {
  const form = new FormData();
  form.append("file", file);
  const record = await call<StoredRecord>("backend", `/api/patients/${patientId}/documents`, { method: "POST", body: form });
  return toDocument(record, patientId);
}

// Before a demo run: the backend drops uploads, share codes, notes and the access log,
// and goes back to the starting records.
export function resetDemoData() {
  chatHistory.length = 0;
  call("backend", "/api/reset", { method: "POST" }).catch(console.error);
}

// ---------- clinician notes (backend database)

export async function listNotes(patientId: string): Promise<ClinicianNote[]> {
  try {
    return await call<ClinicianNote[]>("backend", `/api/patients/${patientId}/notes`);
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export async function addNote(patientId: string, clinicianId: string, text: string): Promise<ClinicianNote> {
  return call<ClinicianNote>("backend", "/api/notes", post({ patient_id: patientId, clinician_id: clinicianId, text }));
}

// ---------- share codes and the access log (backend database)

// The backend makes the code. It refuses documents that are not this patient's.
export async function createShare(patientId: string, documentIds: string[], minutes: number): Promise<Share> {
  return call<Share>("backend", "/api/shares", post({ patient_id: patientId, document_ids: documentIds, minutes }));
}

// The patient's own codes. DEMO01 is a built-in code for trying the clinician side, so it is not listed.
export async function listShares(patientId: string): Promise<Share[]> {
  try {
    const shares = await call<Share[]>("backend", `/api/patients/${patientId}/shares`);
    return shares.filter((s) => s.code !== "DEMO01");
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export async function listAccessLog(patientId: string): Promise<AccessLogEntry[]> {
  try {
    return await call<AccessLogEntry[]>("backend", `/api/patients/${patientId}/access-log`);
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export type OpenShareResult =
  | { ok: true; share: Share; patientName: string; documents: HealthDocument[] }
  | { ok: false; reason: "not_found" | "expired" | "unavailable" };

// What the backend sends when a clinician opens a code.
type OpenedShare = {
  code: string;
  patient: string; // the patient's id
  patient_name: string;
  expires_at: string;
  document_ids: string[];
  documents: StoredRecord[];
};

// Clinician opens a code. The backend writes every document they are shown to the access log.
export async function openShare(code: string, viewerId: string): Promise<OpenShareResult> {
  const query = new URLSearchParams({ viewer_id: viewerId });
  try {
    const opened = await call<OpenedShare>("backend", `/api/shares/${encodeURIComponent(code.trim().toUpperCase())}?${query}`);
    return {
      ok: true,
      share: { code: opened.code, patient_id: opened.patient, document_ids: opened.document_ids, expires_at: opened.expires_at },
      patientName: opened.patient_name,
      documents: opened.documents.map((d) => toDocument(d, opened.patient)),
    };
  } catch (problem) {
    const status = problem instanceof RequestError ? problem.status : 0;
    if (status === 404) return { ok: false, reason: "not_found" };
    if (status === 410) return { ok: false, reason: "expired" };
    console.error(problem);
    return { ok: false, reason: "unavailable" };
  }
}

// ---------- cost estimates (the trained cost model, through the AI service)

// A price range the way the AI service returns it.
type AiEstimate = {
  service_code: string;
  service: string;
  low: number;
  typical: number;
  high: number;
  based_on: "area" | "clinic";
  caveat: string;
  clinic?: { id: string; address: string; city: string; zip: string; providers_in_data?: number };
};

function toEstimate(price: AiEstimate, zip: string): Estimate {
  const clinic = price.clinic;
  return {
    service_code: price.service_code,
    label: clinic ? clinic.address : "Typical for your area",
    detail: clinic ? `${clinic.city}, MD ${clinic.zip}` : `All providers around ZIP ${zip}`,
    low: price.low,
    typical: price.typical,
    high: price.high,
    based_on: price.based_on,
    caveat: price.caveat,
  };
}

// Price options for one service near a ZIP code. The first is the estimate for
// the whole area. The rest are known clinics nearby, cheapest first, each priced
// from that clinic's own past charges. Throws if the service has no estimate.
export async function costOptions(serviceCode: string, zip: string): Promise<Estimate[]> {
  const query = new URLSearchParams({ service_code: serviceCode, zip_code: zip, limit: "3" });
  const [area, clinics] = await Promise.all([
    call<AiEstimate>("ai", "/estimate", post({ service_code: serviceCode, zip_code: zip })),
    call<AiEstimate[]>("ai", `/clinics?${query}`).catch(() => []), // no clinic list is fine, the area estimate still shows
  ]);
  return [area, ...clinics].map((price) => toEstimate(price, zip));
}

export function serviceLabel(code: string) {
  return SERVICES.find((s) => s.code === code)?.label ?? code;
}

// ---------- companion chat (AI service)

type AiChatReply = {
  reply: string;
  used_records: string[]; // ids of the records the answer used
  used_estimates: AiEstimate[];
};

// Earlier turns of this conversation, sent along so follow-up questions make sense.
const chatHistory: { role: "user" | "assistant"; content: string }[] = [];

export async function sendChat(patientId: string, message: string): Promise<ChatMessage> {
  let answer: AiChatReply;
  let records: StoredRecord[];
  try {
    // The companion answers from the patient's records, so send it the current timeline
    // from the backend. A document uploaded a minute ago is included.
    // Oldest first: when two records match a question equally well, the companion picks the later one.
    records = (await storedRecords(patientId)).reverse();
    answer = await call<AiChatReply>("ai", "/chat", post({ message, patient_id: patientId, history: chatHistory, records }));
  } catch (problem) {
    return { role: "companion", text: `I can't answer right now. ${(problem as Error).message}` };
  }
  chatHistory.push({ role: "user", content: message }, { role: "assistant", content: answer.reply });

  // Show which records and estimates the answer came from.
  const sources: ChatSource[] = [];
  for (const id of answer.used_records) {
    const record = records.find((r) => r.id === id);
    if (record) {
      const d = toDocument(record, patientId);
      sources.push({ kind: "record", id: d.id, label: `${d.type}, ${d.provider}, ${d.date}` });
    }
  }
  for (const e of answer.used_estimates) {
    if (e.typical !== undefined) sources.push({ kind: "estimate", label: `${e.service}: $${e.low}–$${e.high}` });
  }

  return {
    role: "companion",
    // The chat bubble shows plain text, so drop the ** marks the model sometimes puts around bold words.
    text: answer.reply.replace(/\*\*(.+?)\*\*/g, "$1"),
    sources,
    // The companion sends people with urgent symptoms to 911, and those replies get the red style.
    urgent: /\b911\b/.test(answer.reply),
  };
}
