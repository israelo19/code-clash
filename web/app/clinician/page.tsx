"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, PageHeader } from "@/components/ui";

// Clinician enters the code the patient gave them.
export default function ClinicianHome() {
  const router = useRouter();
  const [code, setCode] = useState("");

  return (
    <>
      <PageHeader title="Open shared records" subtitle="Enter the code your patient gave you. You'll only see the records they chose." />
      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) router.push(`/clinician/view/${code}`);
          }}
        >
          <label className="mb-2 block text-sm font-medium text-slate-600">Share code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            placeholder="ABC123"
            autoCapitalize="characters"
            className="mb-4 w-full rounded-xl border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.3em]"
          />
          <Button disabled={code.length !== 6} className="w-full">
            Open records
          </Button>
        </form>
      </Card>
      <p className="mt-4 text-center text-xs text-slate-400">Testing tip: code DEMO01 always works.</p>
    </>
  );
}
