"use client";

import { useEffect, useState } from "react";
import { Button, Card, PageHeader, TypeBadge, formatDate } from "@/components/ui";
import { createShare, listAccessLog, listDocuments, listShares, revokeShare } from "@/lib/api";
import type { AccessLogEntry, HealthDocument, Share } from "@/lib/types";

const EXPIRY_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 60 * 24, label: "1 day" },
];

// Patient picks records -> gets a code that expires -> sees who viewed what.
export default function SharePage() {
  const [docs, setDocs] = useState<HealthDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [minutes, setMinutes] = useState(60);
  const [newShare, setNewShare] = useState<Share | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [log, setLog] = useState<AccessLogEntry[]>([]);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    listShares().then((s) => {
      setShares(s);
      setNow(Date.now());
    });
    listAccessLog().then(setLog);
  };

  useEffect(() => {
    listDocuments().then(setDocs);
    refresh();
    // Poll so the access log updates live while a clinician opens the code in another tab.
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const create = async () => {
    setError(null);
    try {
      const share = await createShare(selected, minutes);
      setNewShare(share);
      setSelected([]);
    } catch (problem) {
      setError((problem as Error).message);
    }
    refresh();
  };

  // End a code now. The clinician can no longer open it.
  const revoke = async (code: string) => {
    setError(null);
    try {
      await revokeShare(code);
      if (newShare?.code === code) setNewShare(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
    refresh();
  };

  const docName = (id: string) => docs.find((d) => d.id === id)?.type ?? "Record";
  const isExpired = (s: Share) => new Date(s.expires_at).getTime() < now;

  return (
    <>
      <PageHeader title="Share records" subtitle="You choose what to share. Codes expire, and you can see every view." />

      {newShare && (
        <Card className="mb-6 border-teal-300 bg-teal-50 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">Give this code to your clinician</div>
          <div className="my-2 font-mono text-4xl font-bold tracking-[0.3em] text-teal-900">{newShare.code}</div>
          <div className="text-xs text-teal-800">
            {newShare.document_ids.length} record{newShare.document_ids.length === 1 ? "" : "s"} · expires{" "}
            {new Date(newShare.expires_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </div>
        </Card>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">1. Pick records</h2>
      <div className="mb-5 flex flex-col gap-2">
        {docs.map((d) => (
          <label
            key={d.id}
            className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm ${
              selected.includes(d.id) ? "border-teal-400 ring-1 ring-teal-200" : "border-slate-200"
            }`}
          >
            <input type="checkbox" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} className="h-4 w-4 accent-teal-600" />
            <div className="min-w-0">
              <TypeBadge type={d.type} />
              <div className="mt-1 truncate text-sm">
                {d.provider} · {formatDate(d.date)}
              </div>
            </div>
          </label>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">2. Code expires after</h2>
      <div className="mb-5 flex gap-2">
        {EXPIRY_OPTIONS.map((o) => (
          <button
            key={o.minutes}
            onClick={() => setMinutes(o.minutes)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              minutes === o.minutes ? "bg-teal-600 text-white" : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <Button onClick={create} disabled={selected.length === 0} className="mb-8 w-full">
        Create share code
      </Button>
      {error && <p className="-mt-5 mb-8 rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Your codes</h2>
      {shares.length === 0 ? (
        <p className="mb-6 text-sm text-slate-500">No codes yet.</p>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          {shares.map((s) => (
            <Card key={s.code} className="flex items-center justify-between p-3">
              <div>
                <span className="font-mono font-semibold tracking-widest">{s.code}</span>
                <div className="text-xs text-slate-500">{s.document_ids.map(docName).join(", ")}</div>
              </div>
              <span className="flex shrink-0 items-center gap-3 text-xs">
                <span className={isExpired(s) ? "text-slate-400" : "text-emerald-700"}>{isExpired(s) ? "Ended" : "Active"}</span>
                {!isExpired(s) && (
                  <button onClick={() => revoke(s.code)} className="font-medium text-rose-700 hover:underline">
                    Stop sharing
                  </button>
                )}
              </span>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Who viewed your records</h2>
      {log.length === 0 ? (
        <p className="text-sm text-slate-500">No one has viewed your shared records yet.</p>
      ) : (
        <Card className="divide-y divide-slate-100 p-0">
          {log.map((e) => (
            <div key={e.id} className="flex justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <strong>{e.viewer_name}</strong> viewed {docName(e.document_id)}
              </span>
              <span className="shrink-0 text-xs text-slate-500">
                {new Date(e.viewed_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
