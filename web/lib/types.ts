// Shared data shapes. Agree on these with Workstreams B (backend) and C/D (AI service)
// so the screens don't change when the mock API is swapped for the real one.

export type Role = "patient" | "clinician";

export type User = {
  id: string;
  role: Role;
  name: string;
};

export type DocumentType =
  | "Immunization record"
  | "Visit summary"
  | "Lab result"
  | "Physical form"
  | "Prescription"
  | "Other";

// Matches the `documents` table in the brief.
export type HealthDocument = {
  id: string;
  patient_id: string;
  type: DocumentType;
  date: string; // ISO date, e.g. "2026-09-02"
  provider: string;
  summary: string; // plain-language summary from the document reader
  fields: Record<string, string>; // key fields pulled out of the document
  file_url?: string;
};

// Matches the `notes` table.
export type ClinicianNote = {
  id: string;
  patient_id: string;
  clinician_id: string;
  clinician_name: string;
  text: string;
  created_at: string;
};

// Matches the `shares` table.
export type Share = {
  code: string;
  patient_id: string;
  document_ids: string[];
  expires_at: string; // ISO timestamp
};

// Matches the `access_log` table.
export type AccessLogEntry = {
  id: string;
  share_code: string;
  viewer_id: string;
  viewer_name: string;
  document_id: string;
  viewed_at: string;
};

// Output of POST /estimate.
export type CareSetting = "Campus health center" | "Retail clinic" | "Urgent care" | "Emergency room";

export type Estimate = {
  service_code: string;
  setting: CareSetting;
  low: number;
  typical: number;
  high: number;
  caveat: string;
};

export type Service = {
  code: string;
  label: string;
};

// Output of POST /chat.
export type ChatSource =
  | { kind: "record"; id: string; label: string }
  | { kind: "estimate"; label: string };

export type ChatMessage = {
  role: "user" | "companion";
  text: string;
  sources?: ChatSource[];
  urgent?: boolean;
};
