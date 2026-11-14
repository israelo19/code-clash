import type { ClinicianNote, HealthDocument, Service, Share, User } from "./types";

// Synthetic demo data only. No real health information.

export const DEMO_USERS: Record<"patient" | "clinician", User> = {
  patient: { id: "u_maya", role: "patient", name: "Maya Johnson" },
  clinician: { id: "u_lee", role: "clinician", name: "Dr. Sam Lee" },
};

// Sign-in details for the two demo accounts above. They are made up for the demo: not real accounts,
// not real passwords. The sign-in page fills them in, and checkLogin() in lib/api.ts checks against them.
// (".example" is a web address ending reserved for examples, so these emails can never belong to anyone.)
export const DEMO_LOGINS: Record<"patient" | "clinician", { email: string; password: string }> = {
  patient: { email: "maya.johnson@carevault.example", password: "towson-demo-2026" },
  clinician: { email: "sam.lee@carevault.example", password: "towson-demo-2026" },
};

// No longer shown in the app: the timeline now comes from the backend's database, which starts from
// data/sample_records.json. Kept as a reference for the document shape.
export const SEED_DOCUMENTS: HealthDocument[] = [
  {
    id: "d_imm",
    patient_id: "u_maya",
    type: "Immunization record",
    date: "2025-08-20",
    provider: "Towson University Health Center",
    summary:
      "Your vaccine history. It shows MMR (2 doses), Tdap, hepatitis B (3 doses), meningococcal, and a flu shot from last fall. A negative TB skin test is included.",
    fields: {
      MMR: "2 doses, complete",
      Tdap: "2024-08-15",
      "Hepatitis B": "3 doses, complete",
      Meningococcal: "2024-08-15",
      Influenza: "2025-10-03",
      "TB skin test": "Negative, 2025-08-20",
    },
  },
  {
    id: "d_phys",
    patient_id: "u_maya",
    type: "Physical form",
    date: "2025-08-20",
    provider: "Towson University Health Center",
    summary:
      "A completed annual physical. Vitals were normal and you were cleared for clinical placement with no restrictions.",
    fields: {
      "Blood pressure": "114/72",
      "Heart rate": "68 bpm",
      Clearance: "Cleared, no restrictions",
    },
  },
  {
    id: "d_cbc",
    patient_id: "u_maya",
    type: "Lab result",
    date: "2026-03-11",
    provider: "Quest Diagnostics, Towson",
    summary:
      "A complete blood count (CBC). All values were within the normal range, which means nothing unusual showed up in your red cells, white cells or platelets.",
    fields: {
      "White blood cells": "6.8 (normal 4.0–11.0)",
      Hemoglobin: "13.4 (normal 12.0–15.5)",
      Platelets: "245 (normal 150–400)",
    },
  },
];

export const SEED_NOTES: ClinicianNote[] = [];

// A seeded share so the clinician screen works on its own during testing.
export const SEED_SHARES: Share[] = [
  {
    code: "DEMO01",
    patient_id: "u_maya",
    document_ids: ["doc_imm001", "doc_phys001"], // ids of Maya's starting records in data/sample_records.json
    expires_at: "2099-01-01T00:00:00.000Z",
  },
];

// The six services the cost model can price (the AI service lists them at GET /services).
// The TB skin test from the brief is not here: the training data had too few rows for it.
export const SERVICES: Service[] = [
  { code: "87880", label: "Rapid strep test" },
  { code: "87804", label: "Rapid flu test" },
  { code: "99213", label: "Office visit, returning patient" },
  { code: "99203", label: "Office visit, new patient" },
  { code: "90471", label: "Giving a vaccine" },
  { code: "85025", label: "Blood count (CBC)" },
];

// What the document reader "returns" for the demo upload.
export const DEMO_EXTRACTED_VISIT: Omit<HealthDocument, "id" | "patient_id"> = {
  type: "Visit summary",
  date: "2026-11-14",
  provider: "MinuteClinic, York Rd, Towson",
  summary:
    "You were seen for a sore throat. The rapid strep test was positive, so you were prescribed an antibiotic (amoxicillin) for 10 days. Finish the full course even if you feel better, and come back if you aren't improving in 2 to 3 days.",
  fields: {
    Reason: "Sore throat, fever",
    "Rapid strep test": "Positive",
    Prescription: "Amoxicillin 500 mg, twice daily, 10 days",
    "Follow-up": "If not better in 48–72 hours",
    "Return to class": "After 24 hours on antibiotics and no fever",
  },
};
