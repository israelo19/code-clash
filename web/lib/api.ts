"use client";

// How the screens reach the rest of the system. Every screen goes through these functions.
//
// The browser only ever talks to this web app's own address. Requests to /api/...
// are passed on to the backend (App.js) by the web server (see next.config.ts), and
// the backend alone talks to the AI service. So there is one address, one sign-in
// cookie, and the paid AI key stays behind the backend's checks.
//
//   sign-in                POST /api/login     POST /api/logout     GET /api/me
//   timeline and upload    GET  /api/patients/:id/documents         POST (same path)
//   share codes            POST /api/shares    GET /api/shares/:code
//   access log and notes   GET  /api/patients/:id/access-log        GET /api/patients/:id/notes   POST /api/notes
//   companion chat         POST /api/chat
//   cost estimates         POST /api/estimate  GET /api/clinics     (the trained cost model)
//
// The backend decides who may see what from the sign-in session. The ids sent
// from here only say which of your own things you are asking for.

import { SERVICES } from "./mockData";
import { onUserChange, rememberUser, signedInUser } from "./session";
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

// ---------- talking to the backend

// A failed request. `status` is the HTTP status code, or 0 when the backend did not answer at all.
class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// One request to the backend. Throws a RequestError with a readable message when it fails.
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  // The backend refuses requests that change something unless they carry this
  // header. Other websites cannot add it, so they cannot act as you.
  headers.set("X-CareVault-Request", "1");

  let reply: Response;
  try {
    reply = await fetch(`/api${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new RequestError("Can't reach the server. Is the backend running?", 0);
  }
  if (!reply.ok) {
    const body = await reply.json().catch(() => null);
    const reason = typeof body?.error === "string" ? body.error : `The server answered with error ${reply.status}.`;
    throw new RequestError(reason, reply.status);
  }
  return (await reply.json()) as T;
}

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// The id of whoever is signed in. The screens that call these functions only
// show once someone is, so a missing user means the session ended.
function myId(): string {
  const user = signedInUser();
  if (!user) throw new RequestError("Sign in first.", 401);
  return user.id;
}

// ---------- sign-in

// Checks an email and password with the backend. Returns the user, or null if they
// don't match an account with that role. The backend answers a correct sign-in with
// a session cookie, which the browser then sends by itself.
export async function checkLogin(role: Role, email: string, password: string): Promise<User | null> {
  try {
    const { user } = await call<{ user: User }>("/login", post({ email: email.trim(), password, role }));
    rememberUser(user);
    return user;
  } catch (problem) {
    if (problem instanceof RequestError && problem.status === 401) return null;
    throw problem; // backend down, or too many attempts: the form shows "could not sign in"
  }
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
    // Object.hasOwn: only our own five labels count, never something built into every object.
    type: Object.hasOwn(TYPE_LABELS, record.type) ? TYPE_LABELS[record.type] : "Other",
    date: record.date || new Date().toISOString().slice(0, 10),
    provider: record.provider || "Unknown provider",
    summary: record.summary || "",
    fields: Object.fromEntries(Object.entries(record.fields ?? {}).map(([key, value]) => [fieldLabel(key), String(value)])),
  };
}

// Your own timeline, newest first. If the backend is down this returns an
// empty list, so a screen shows "no records" and not a crash.
export async function listDocuments(): Promise<HealthDocument[]> {
  try {
    const id = myId();
    const records = await call<StoredRecord[]>(`/patients/${id}/documents`);
    return records.map((r) => toDocument(r, id)).sort((a, b) => b.date.localeCompare(a.date));
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export async function getDocument(id: string): Promise<HealthDocument | null> {
  const documents = await listDocuments();
  return documents.find((d) => d.id === id) ?? null;
}

// Send the photo or PDF to the backend. It passes the file to the document reader, saves
// the record on your timeline and returns it. Throws if the file can't be read.
export async function uploadAndExtract(file: File): Promise<HealthDocument> {
  const id = myId();
  const form = new FormData();
  form.append("file", file);
  const record = await call<StoredRecord>(`/patients/${id}/documents`, { method: "POST", body: form });
  return toDocument(record, id);
}

// Before a demo run: the backend drops uploads, share codes, notes and the access log,
// goes back to the starting records and signs everyone out. Only works in demo mode.
export function resetDemoData() {
  chatHistory.length = 0;
  rememberUser(null);
  call("/reset", { method: "POST" }).catch(console.error);
}

// ---------- clinician notes (backend database)

// Notes clinicians left on your timeline.
export async function listNotes(): Promise<ClinicianNote[]> {
  try {
    return await call<ClinicianNote[]>(`/patients/${myId()}/notes`);
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

// A clinician adds a note for a patient who shared records with them. The backend
// knows which clinician is signed in, and checks that the share is still valid.
export async function addNote(patientId: string, text: string): Promise<ClinicianNote> {
  return call<ClinicianNote>("/notes", post({ patient_id: patientId, text }));
}

// ---------- share codes and the access log (backend database)

// The backend makes the code, for your own documents only.
export async function createShare(documentIds: string[], minutes: number): Promise<Share> {
  return call<Share>("/shares", post({ document_ids: documentIds, minutes }));
}

// End one of your share codes now, before its time is up.
export async function revokeShare(code: string): Promise<void> {
  await call(`/shares/${encodeURIComponent(code)}`, { method: "DELETE" });
}

// Your own codes. In demo mode this includes DEMO01, a built-in code for trying the clinician side.
export async function listShares(): Promise<Share[]> {
  try {
    return await call<Share[]>(`/patients/${myId()}/shares`);
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

// Everyone who viewed your shared records.
export async function listAccessLog(): Promise<AccessLogEntry[]> {
  try {
    return await call<AccessLogEntry[]>(`/patients/${myId()}/access-log`);
  } catch (problem) {
    console.error(problem);
    return [];
  }
}

export type OpenShareResult =
  | { ok: true; share: Share; patientName: string; documents: HealthDocument[] }
  | { ok: false; reason: "not_found" | "expired" | "too_many" | "unavailable" };

// What the backend sends when a clinician opens a code.
type OpenedShare = {
  code: string;
  patient: string; // the patient's id
  patient_name: string;
  expires_at: string;
  document_ids: string[];
  documents: StoredRecord[];
};

// The signed-in clinician opens a code. The backend writes every document they are shown to the access log.
export async function openShare(code: string): Promise<OpenShareResult> {
  try {
    const opened = await call<OpenedShare>(`/shares/${encodeURIComponent(code.trim().toUpperCase())}`);
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
    if (status === 429) return { ok: false, reason: "too_many" };
    console.error(problem);
    return { ok: false, reason: "unavailable" };
  }
}

// ---------- cost estimates (the trained cost model, through the backend)

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
    call<AiEstimate>("/estimate", post({ service_code: serviceCode, zip_code: zip })),
    call<AiEstimate[]>(`/clinics?${query}`).catch(() => []), // no clinic list is fine, the area estimate still shows
  ]);
  return [area, ...clinics].map((price) => toEstimate(price, zip));
}

export function serviceLabel(code: string) {
  return SERVICES.find((s) => s.code === code)?.label ?? code;
}

// ---------- companion chat (through the backend)

type AiChatReply = {
  reply: string;
  used_records: string[]; // ids of the records the answer used
  used_estimates: AiEstimate[];
};

// Earlier turns of this conversation, sent along so follow-up questions make sense.
// Forgotten when the signed-in user changes, so one person's chat never follows another's.
const chatHistory: { role: "user" | "assistant"; content: string }[] = [];
onUserChange(() => {
  chatHistory.length = 0;
});

// Ask the companion. The backend adds your records itself, from its database,
// so the companion can only ever read the signed-in patient's own records.
export async function sendChat(message: string): Promise<ChatMessage> {
  let answer: AiChatReply;
  try {
    answer = await call<AiChatReply>("/chat", post({ message, history: chatHistory }));
  } catch (problem) {
    return { role: "companion", text: `I can't answer right now. ${(problem as Error).message}` };
  }
  chatHistory.push({ role: "user", content: message }, { role: "assistant", content: answer.reply });
  if (chatHistory.length > 20) chatHistory.splice(0, chatHistory.length - 20); // keep the last ten exchanges

  // Show which records and estimates the answer came from.
  const sources: ChatSource[] = [];
  if (answer.used_records.length > 0) {
    const documents = await listDocuments();
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
    // The chat bubble shows plain text, so drop the ** marks the model sometimes puts around bold words.
    text: answer.reply.replace(/\*\*(.+?)\*\*/g, "$1"),
    sources,
    // The companion sends people with urgent symptoms to 911, and those replies get the red style.
    urgent: /\b911\b/.test(answer.reply),
  };
}
