"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, FieldsTable, PageHeader, TypeBadge, formatDate } from "@/components/ui";
import { addNote, openShare, type OpenShareResult } from "@/lib/api";
import { DEMO_USERS } from "@/lib/mockData";

// The packet of records the patient chose to share, plus "add a visit note".
export default function SharedView() {
  const { code } = useParams<{ code: string }>();
  const [result, setResult] = useState<OpenShareResult | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return; // avoid double-logging in React dev mode
    opened.current = true;
    openShare(code, DEMO_USERS.clinician.id).then(setResult);
  }, [code]);

  const back = (
    <Link href="/clinician" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
      <Icon name="back" className="h-4 w-4" /> Enter another code
    </Link>
  );

  if (!result) return <p className="text-sm text-slate-500">Opening…</p>;

  if (!result.ok)
    return (
      <>
        {back}
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-900">
          {result.reason === "expired"
            ? "This code has expired. Ask the patient for a new one."
            : result.reason === "unavailable"
              ? "Can't open the code right now. Is the backend running on port 4000?"
              : "That code wasn't found."}
        </Card>
      </>
    );

  const save = async () => {
    await addNote(result.share.patient_id, DEMO_USERS.clinician.id, note.trim());
    setNote("");
    setSaved(true);
  };

  return (
    <>
      {back}
      <PageHeader
        title={result.patientName}
        subtitle={`Shared with code ${result.share.code} · expires ${new Date(result.share.expires_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`}
      />
      <p className="-mt-3 mb-5 text-xs text-slate-500">This view was recorded in the patient&apos;s access log.</p>

      <div className="mb-8 flex flex-col gap-4">
        {result.documents.map((d) => (
          <Card key={d.id}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <TypeBadge type={d.type} />
              <span className="text-xs text-slate-500">{formatDate(d.date)}</span>
            </div>
            <div className="text-sm font-medium">{d.provider}</div>
            <div className="mt-2">
              <FieldsTable fields={d.fields} />
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Add a visit note</h2>
      <Card>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder="e.g. Rapid strep positive. Started amoxicillin. Return if not improving in 48–72 hours."
          className="mb-3 w-full rounded-xl border border-slate-300 p-3 text-sm"
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!note.trim()}>
            Save to patient timeline
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        </div>
      </Card>
    </>
  );
}
