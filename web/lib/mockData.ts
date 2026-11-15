import type { Service } from "./types";

// Fixed lists the screens need. No health information lives here: records,
// share codes and notes all come from the backend.

// Sign-in details for the two demo accounts, which the sign-in page fills in for you.
// They are made up for the demo and THEY ARE PUBLIC: anyone can read this file. The
// backend only has these accounts while it runs in demo mode (see server/config.js),
// and it is the backend, not this file, that checks the password.
// (".example" is a web address ending reserved for examples, so these emails can never belong to anyone.)
export const DEMO_LOGINS: Record<"patient" | "clinician", { email: string; password: string }> = {
  patient: { email: "maya.johnson@carevault.example", password: "towson-demo-2026" },
  clinician: { email: "sam.lee@carevault.example", password: "towson-demo-2026" },
};

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
