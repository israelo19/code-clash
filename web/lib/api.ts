"use client";

// How the screens reach the rest of the system. Every screen goes through these functions.
//
// CONNECTED TO THE REAL AI SERVICE (ai/main.py, port 8000):
//   documents and upload   GET /records/{patient}   POST /extract
//   companion chat         POST /chat               (it searches the records and calls the cost model)
//   cost estimates         POST /estimate           GET /clinics      (the trained cost model)
//
// STILL KEPT IN THIS BROWSER, until Part B's backend routes exist:
//   share codes, the access log and clinician notes.
//   They work between two tabs of the same browser, but not between two devices.
//   Each of those functions names the backend route that will replace it.

import { DEMO_USERS, SEED_SHARES, SERVICES } from "./mockData";
import type {
  AccessLogEntry,
  ChatMessage,
  ChatSource,
  ClinicianNote,
  DocumentType,
  Estimate,
  HealthDocument,
  Share,
} from "./types";

// ---------- talking to the AI service

// Where the AI service runs. Set NEXT_PUBLIC_AI_URL when it is hosted somewhere else.
// The default is port 8000 on the machine this page came from, so a phone on the
// same Wi-Fi as the laptop reaches the laptop's AI service too.
function aiUrl() {
  if (process.env.NEXT_PUBLIC_AI_URL) return process.env.NEXT_PUBLIC_AI_URL;
  const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
  return `http://${host}:8000`;
}

// One request to the AI service. Throws an Error with a readable message when it fails.
async function ai<T>(path: string, init?: RequestInit): Promise<T> {
  let reply: Response;
  try {
    reply = await fetch(aiUrl() + path, init);
  } catch {
    throw new Error("Can't reach the AI service. Is it running on port 8000?");
  }
  if (!reply.ok) {
    const body = await reply.json().catch(() => null);
    throw new Error(typeof body?.detail === "string" ? body.detail : `The AI service answered with error ${reply.status}.`);
  }
  return (await reply.json()) as T;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

// The web app calls the demo patient "u_maya". The AI service files her records under "maya".
const aiPatientId = (patientId: string) => patientId.replace(/^u_/, "");

// ---------- documents (real: AI service)

// A record the way the AI service stores it.
type AiRecord = {
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

function toDocument(record: AiRecord, patientId: string): HealthDocument {
  return {
    id: record.id,
    patient_id: patientId,
    type: TYPE_LABELS[record.type] ?? "Other",
    date: record.date || new Date().toISOString().slice(0, 10),
    provider: record.provider || "Unknown provider",
    summary: record.summary || "",
    fields: record.fields ?? {},
  };
}

// The patient's timeline, newest first. If the AI service is down this returns an
// empty list, so a screen shows "no records" and not a crash.
export async function listDocuments(patientId: string): Promise<HealthDocument[]> {
  try {
    const records = await ai<AiRecord[]>(`/records/${aiPatientId(patientId)}`);
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

// Send the photo or PDF to the document reader. It reads it, files it on the
// patient's timeline and returns the record. Throws if the file can't be read.
export async function uploadAndExtract(patientId: string, file: File): Promise<HealthDocument> {
  const form = new FormData();
  form.append("file", file);
  form.append("patient_id", aiPatientId(patientId)); // tells the AI service to save it too
  const record = await ai<AiRecord>("/extract", { method: "POST", body: form });
  return toDocument(record, patientId);
}

// ---------- shares, access log and notes (still in this browser)

type LocalStore = {
  notes: ClinicianNote[];
  shares: Share[];
  accessLog: AccessLogEntry[];
};

// localStorage is shared by every tab of one browser, so a patient tab and a
// clinician tab see the same share codes.
const STORE_KEY = "local_store_v2";

function emptyStore(): LocalStore {
  return { notes: [], shares: [...SEED_SHARES], accessLog: [] };
}

function load(): LocalStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {}
  return emptyStore();
}

function save(store: LocalStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// Before a demo run: forget this browser's shares and notes, and ask the AI
// service to drop uploaded documents and go back to the starting records.
export function resetDemoData() {
  save(emptyStore());
  chatHistory.length = 0;
  ai("/reset", { method: "POST" }).catch(console.error);
}

// Backend route to come: GET /api/patients/:id/notes
export async function listNotes(patientId: string): Promise<ClinicianNote[]> {
  await wait(100);
  return load()
    .notes.filter((n) => n.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// Backend route to come: POST /api/notes
export async function addNote(patientId: string, clinicianId: string, text: string): Promise<ClinicianNote> {
  await wait(300);
  const note: ClinicianNote = {
    id: newId("n"),
    patient_id: patientId,
    clinician_id: clinicianId,
    clinician_name: DEMO_USERS.clinician.name,
    text,
    created_at: new Date().toISOString(),
  };
  const store = load();
  store.notes.push(note);
  save(store);
  return note;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, easier to read aloud
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Backend route to come: POST /api/shares
export async function createShare(patientId: string, documentIds: string[], minutes: number): Promise<Share> {
  await wait(300);
  const share: Share = {
    code: makeCode(),
    patient_id: patientId,
    document_ids: documentIds,
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
  };
  const store = load();
  store.shares.push(share);
  save(store);
  return share;
}

export async function listShares(patientId: string): Promise<Share[]> {
  await wait(100);
  return load()
    .shares.filter((s) => s.patient_id === patientId && s.code !== "DEMO01")
    .sort((a, b) => b.expires_at.localeCompare(a.expires_at));
}

// Backend route to come: GET /api/patients/:id/access-log
export async function listAccessLog(patientId: string): Promise<AccessLogEntry[]> {
  await wait(100);
  const store = load();
  const codes = new Set(store.shares.filter((s) => s.patient_id === patientId).map((s) => s.code));
  return store.accessLog
    .filter((e) => codes.has(e.share_code))
    .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
}

export type OpenShareResult =
  | { ok: true; share: Share; patientName: string; documents: HealthDocument[] }
  | { ok: false; reason: "not_found" | "expired" };

// Clinician opens a code. Every document they can see is written to the access log.
// The share itself is kept in this browser, but the documents it points to are the
// real ones from the AI service.
// Backend route to come: GET /api/shares/:code?viewer_id=...
export async function openShare(code: string, viewerId: string): Promise<OpenShareResult> {
  const store = load();
  const share = store.shares.find((s) => s.code === code.trim().toUpperCase());
  if (!share) return { ok: false, reason: "not_found" };
  if (new Date(share.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  const all = await listDocuments(share.patient_id);
  const documents = all.filter((d) => share.document_ids.includes(d.id));
  const now = new Date().toISOString();
  for (const d of documents) {
    store.accessLog.push({
      id: newId("a"),
      share_code: share.code,
      viewer_id: viewerId,
      viewer_name: DEMO_USERS.clinician.name,
      document_id: d.id,
      viewed_at: now,
    });
  }
  save(store);
  return { ok: true, share, patientName: DEMO_USERS.patient.name, documents };
}

// ---------- cost estimates (real: the trained cost model, through the AI service)

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
    ai<AiEstimate>("/estimate", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ service_code: serviceCode, zip_code: zip }),
    }),
    ai<AiEstimate[]>(`/clinics?${query}`).catch(() => []), // no clinic list is fine, the area estimate still shows
  ]);
  return [area, ...clinics].map((price) => toEstimate(price, zip));
}

export function serviceLabel(code: string) {
  return SERVICES.find((s) => s.code === code)?.label ?? code;
}

// ---------- companion chat (real: AI service)

type AiChatReply = {
  reply: string;
  used_records: string[]; // ids of the records the answer used
  used_estimates: AiEstimate[];
};

// Earlier turns of this conversation, sent along so follow-up questions make sense.
const chatHistory: { role: "user" | "assistant"; content: string }[] = [];

export async function sendChat(patientId: string, message: string): Promise<ChatMessage> {
  let answer: AiChatReply;
  try {
    answer = await ai<AiChatReply>("/chat", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ message, patient_id: aiPatientId(patientId), history: chatHistory }),
    });
  } catch (problem) {
    return { role: "companion", text: `I can't answer right now. ${(problem as Error).message}` };
  }
  chatHistory.push({ role: "user", content: message }, { role: "assistant", content: answer.reply });

  // Show which records and estimates the answer came from.
  const sources: ChatSource[] = [];
  if (answer.used_records.length > 0) {
    const documents = await listDocuments(patientId);
    for (const id of answer.used_records) {
      const d = documents.find((doc) => doc.id === id);
      if (d) sources.push({ kind: "record", id: d.id, label: `${d.type}, ${d.provider}, ${d.date}` });
    }
  }
  for (const e of answer.used_estimates) {
    if (e.typical !== undefined) sources.push({ kind: "estimate", label: `${e.service}: $${e.low}–$${e.high}` });
  }

  return {
    role: "companion",
    text: answer.reply,
    sources,
    // The companion sends people with urgent symptoms to 911, and those replies get the red style.
    urgent: /\b911\b/.test(answer.reply),
  };
}
