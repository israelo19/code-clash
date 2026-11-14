"use client";

import { useEffect, useState } from "react";
import { CostRangeCard, PageHeader } from "@/components/ui";
import { costOptions } from "@/lib/api";
import { SERVICES } from "@/lib/mockData";
import type { Estimate } from "@/lib/types";

// Pick a service and a ZIP -> a price range for the area, plus known clinics nearby, cheapest first.
// The numbers come from the trained cost model (see docs/DECISIONS.md).
export default function CostCheck() {
  const [code, setCode] = useState(SERVICES[0].code);
  const [zip, setZip] = useState("21204"); // Towson
  // The latest answer, saved with the service and ZIP it belongs to. `error` is set when the request failed.
  const [result, setResult] = useState<{ key: string; options: Estimate[]; error?: string } | null>(null);
  const key = `${code}|${zip}`;
  // Show "Estimating…" until the answer for the current service and ZIP arrives.
  const current = result?.key === key ? result : null;

  useEffect(() => {
    let cancelled = false;
    const asked = `${code}|${zip}`;
    costOptions(code, zip)
      .then((options) => {
        if (!cancelled) setResult({ key: asked, options });
      })
      .catch((problem: Error) => {
        if (!cancelled) setResult({ key: asked, options: [], error: problem.message });
      });
    return () => {
      cancelled = true;
    };
  }, [code, zip]);

  const options = current?.options ?? [];
  const area = options.find((o) => o.based_on === "area");
  const clinics = options.filter((o) => o.based_on === "clinic");

  return (
    <>
      <PageHeader title="What will it cost?" subtitle="See an estimated cost before you go." />

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

      {current === null ? (
        <p className="text-sm text-slate-500">Estimating…</p>
      ) : current.error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">
          <strong>No estimate right now.</strong> {current.error}
        </p>
      ) : (
        <>
          {area && <CostRangeCard estimate={area} />}

          <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-700">Clinics near you, cheapest first</h2>
          {clinics.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {/* The list arrives cheapest first, so the first card is the lowest. */}
                {clinics.map((c, i) => (
                  <CostRangeCard key={c.label + c.detail} estimate={c} highlight={i === 0} />
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Each clinic&apos;s range comes from what clinicians at that address have billed before. Clinics are listed by
                street address because the public data has no clinic names.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              No clinics in our data near this ZIP. We only have Maryland clinics, so the range above is the best estimate.
            </p>
          )}

          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Billed prices, before insurance.</strong> {options[0]?.caveat}
          </p>
        </>
      )}
    </>
  );
}
