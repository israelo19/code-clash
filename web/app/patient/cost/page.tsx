"use client";

import { useEffect, useState } from "react";
import { CostRangeCard, PageHeader } from "@/components/ui";
import { SETTINGS, estimateCost } from "@/lib/api";
import { SERVICES } from "@/lib/mockData";
import type { Estimate } from "@/lib/types";

// Pick a service -> get a price range for each care setting nearby.
export default function CostCheck() {
  const [code, setCode] = useState(SERVICES[0].code);
  const [zip, setZip] = useState("21252");
  const [result, setResult] = useState<{ key: string; estimates: Estimate[] } | null>(null);
  const key = `${code}|${zip}`;
  // Show "Estimating…" until the result for the current service and ZIP arrives.
  const estimates = result?.key === key ? result.estimates : null;

  useEffect(() => {
    let cancelled = false;
    Promise.all(SETTINGS.map((s) => estimateCost(code, s, zip))).then((r) => {
      if (!cancelled) setResult({ key: `${code}|${zip}`, estimates: r });
    });
    return () => {
      cancelled = true;
    };
  }, [code, zip]);

  const cheapest = estimates ? Math.min(...estimates.map((e) => e.typical)) : null;

  return (
    <>
      <PageHeader title="What will it cost?" subtitle="See a price range before you go." />

      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_140px]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">Service</span>
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
          >
            {SERVICES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-600">ZIP code</span>
          <input
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
          />
        </label>
      </div>

      {estimates === null ? (
        <p className="text-sm text-slate-500">Estimating…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {estimates.map((e) => (
              <CostRangeCard key={e.setting} estimate={e} highlight={e.typical === cheapest} />
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Estimate only.</strong> {estimates[0].caveat}
          </p>
        </>
      )}
    </>
  );
}
