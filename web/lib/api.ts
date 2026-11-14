"use client";

// THE ONE FILE TO SWAP.
// Every screen talks to the backend only through these functions. Right now they use mock data
// saved in the browser, so the whole demo clicks through before the backend and AI service exist.
// When Workstream B's routes are ready, replace the body of each function with a fetch() call,
// e.g. `return (await fetch("/api/documents")).json()`. The screens won't need to change.

import {
  DEMO_EXTRACTED_VISIT,
  DEMO_LOGINS,
  DEMO_USERS,
  SEED_DOCUMENTS,
  SEED_NOTES,
  SEED_SHARES,
  SERVICES,
} from "./mockData";
import type {
  AccessLogEntry,
  CareSetting,
  ChatMessage,
  ChatSource,
  ClinicianNote,
  Estimate,
  HealthDocument,
  Role,
  Share,
  User,
} from "./types";

// ---------- mock store (localStorage so a patient tab and a clinician tab in the same browser share it)

type Store = {
  documents: HealthDocument[];
  notes: ClinicianNote[];
  shares: Share[];
  accessLog: AccessLogEntry[];
};

const STORE_KEY = "mock_store_v1";

function seed(): Store {
  return {
    documents: [...SEED_DOCUMENTS],
    notes: [...SEED_NOTES],
    shares: [...SEED_SHARES],
    accessLog: [],
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {}
  return seed();
}

function save(store: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
}

export function resetDemoData() {
  save(seed());
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

// ---------- sign-in

// Checks an email and password for the sign-in page. Returns the user, or null if they don't match.
// Real version: POST them to Workstream B's sign-in route and return the user it sends back.
// Mock: compares them with the two seeded demo accounts in mockData.ts. Real sign-up is cut for today.
export async function checkLogin(role: Role, email: string, password: string): Promise<User | null> {
  await wait(600);
  const demo = DEMO_LOGINS[role];
  const matches = email.trim().toLowerCase() === demo.email && password === demo.password;
  return matches ? DEMO_USERS[role] : null;
}

// ---------- documents

export async function listDocuments(patientId: string): Promise<HealthDocument[]> {
  await wait(150);
  return load()
    .documents.filter((d) => d.patient_id === patientId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getDocument(id: string): Promise<HealthDocument | null> {
  await wait(100);
  return load().documents.find((d) => d.id === id) ?? null;
}

// Real version: POST the file to /api/extract (which calls the AI service's POST /extract),
// then save the returned record. Mock: pretends to read the photo and returns the demo visit summary.
export async function uploadAndExtract(patientId: string, file: File): Promise<HealthDocument> {
  await wait(1800);
  const doc: HealthDocument = {
    ...DEMO_EXTRACTED_VISIT,
    id: newId("d"),
    patient_id: patientId,
    file_url: file.name,
  };
  const store = load();
  store.documents.push(doc);
  save(store);
  return doc;
}

// ---------- notes

export async function listNotes(patientId: string): Promise<ClinicianNote[]> {
  await wait(100);
  return load()
    .notes.filter((n) => n.patient_id === patientId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

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

// ---------- sharing

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, easier to read aloud
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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
export async function openShare(code: string, viewerId: string): Promise<OpenShareResult> {
  await wait(400);
  const store = load();
  const share = store.shares.find((s) => s.code === code.trim().toUpperCase());
  if (!share) return { ok: false, reason: "not_found" };
  if (new Date(share.expires_at).getTime() < Date.now()) return { ok: false, reason: "expired" };
  const documents = store.documents.filter((d) => share.document_ids.includes(d.id));
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

// ---------- cost estimates

export const SETTINGS: CareSetting[] = ["Campus health center", "Retail clinic", "Urgent care", "Emergency room"];

// Mock typical prices. The real numbers come from Workstream D's trained model via POST /estimate.
const BASE: Record<string, number> = {
  "87880": 38,
  "87804": 52,
  "99213": 135,
  "99203": 190,
  "86580": 28,
  "90471": 32,
  "85025": 30,
};
const SETTING_FACTOR: Record<CareSetting, number> = {
  "Campus health center": 0.6,
  "Retail clinic": 1,
  "Urgent care": 1.6,
  "Emergency room": 4.5,
};

export async function estimateCost(serviceCode: string, setting: CareSetting, zip: string): Promise<Estimate> {
  await wait(250);
  void zip;
  const typical = Math.round((BASE[serviceCode] ?? 100) * SETTING_FACTOR[setting]);
  return {
    service_code: serviceCode,
    setting,
    low: Math.round(typical * 0.6),
    typical,
    high: Math.round(typical * 1.9),
    caveat: "Estimate based on public Medicare charge data. Not a quote, and not what your insurance will pay.",
  };
}

export function serviceLabel(code: string) {
  return SERVICES.find((s) => s.code === code)?.label ?? code;
}

// ---------- companion chat

// Real version: POST /chat with { message, patient_id }. Mock: keyword rules that show off
// the two tools (search_records and estimate_cost) and the companion rules from the brief.
export async function sendChat(patientId: string, message: string): Promise<ChatMessage> {
  await wait(900);
  const m = message.toLowerCase();
  const docs = await listDocuments(patientId);
  const imm = docs.find((d) => d.type === "Immunization record");
  const visit = docs.find((d) => d.type === "Visit summary");

  if (/(chest pain|can't breathe|cant breathe|trouble breathing|suicid|overdose|unconscious|severe bleeding)/.test(m)) {
    return {
      role: "companion",
      urgent: true,
      text: "This sounds urgent. Please call 911 or go to the nearest emergency room now. If you're on campus, campus police can also send help.",
    };
  }

  if (/(strep|sore throat|throat)/.test(m) && !/(mean|summary|results?)/.test(m)) {
    const [campus, retail, urgent] = await Promise.all([
      estimateCost("87880", "Campus health center", "212"),
      estimateCost("87880", "Retail clinic", "212"),
      estimateCost("87880", "Urgent care", "212"),
    ]);
    const visitCampus = await estimateCost("99213", "Campus health center", "212");
    const sources: ChatSource[] = [{ kind: "estimate", label: "Rapid strep test + office visit, Towson area" }];
    if (imm) sources.push({ kind: "record", id: imm.id, label: `${imm.type}, ${imm.provider}` });
    return {
      role: "companion",
      sources,
      text:
        `I can't tell you whether it's strep, but a clinic can test for it in about 10 minutes. Here's roughly what a rapid strep test costs near you:\n\n` +
        `• Campus health center: $${campus.low}–$${campus.high}\n` +
        `• Retail clinic: $${retail.low}–$${retail.high}\n` +
        `• Urgent care: $${urgent.low}–$${urgent.high}\n\n` +
        `Add about $${visitCampus.low}–$${visitCampus.high} for the visit itself at the campus health center. ` +
        `The campus health center is usually the cheapest option. Bring your insurance card and your immunization record. You can share it with the clinician by code from the Share tab.`,
    };
  }

  if (/(immuni|vaccin|shot|mmr|tdap|tb)/.test(m) && imm) {
    return {
      role: "companion",
      sources: [{ kind: "record", id: imm.id, label: `${imm.type}, ${imm.date}` }],
      text: `From your immunization record: ${Object.entries(imm.fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ")}. That covers what most clinical placement forms ask for. You can share it with a clinician or school by code from the Share tab.`,
    };
  }

  if (/(mean|summary|explain|results?|visit|amoxicillin|antibiotic)/.test(m) && visit) {
    return {
      role: "companion",
      sources: [{ kind: "record", id: visit.id, label: `${visit.type}, ${visit.provider}, ${visit.date}` }],
      text: `Here's your visit summary in plain language: ${visit.summary}\n\nOn class: the summary says you can go back ${visit.fields["Return to class"]?.toLowerCase() ?? "once your clinician says it's okay"}.`,
    };
  }

  return {
    role: "companion",
    text: "I can explain your records and estimate what care costs. Try asking “What does a strep test cost?”, “What vaccines do I have?” or “What does my visit summary mean?”",
  };
}
