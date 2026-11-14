"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { Button, Card, FieldsTable, PageHeader, TypeBadge, formatDate } from "@/components/ui";
import { uploadAndExtract } from "@/lib/api";
import { DEMO_USERS } from "@/lib/mockData";
import type { HealthDocument } from "@/lib/types";

// Snap a photo or pick a file -> document reader parses it -> filed on the timeline.
export default function Upload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "done">("idle");
  const [result, setResult] = useState<HealthDocument | null>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setStatus("idle");
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const read = async () => {
    if (!file) return;
    setStatus("reading");
    const doc = await uploadAndExtract(DEMO_USERS.patient.id, file);
    setResult(doc);
    setStatus("done");
  };

  return (
    <>
      <PageHeader title="Add a document" subtitle="Take a photo of a visit summary, lab result or form. We'll read it and file it for you." />

      {/* capture="environment" opens the back camera on phones */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />

      {status !== "done" && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-slate-500 transition hover:border-teal-400 hover:text-teal-700"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Selected document" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <Icon name="camera" className="h-10 w-10" />
          )}
          <span className="text-sm font-medium">{file ? file.name : "Take a photo or choose a file"}</span>
          {file && <span className="text-xs">Tap to choose a different one</span>}
        </button>
      )}

      {file && status === "idle" && (
        <Button onClick={read} className="mt-4 w-full">
          Read and file this document
        </Button>
      )}

      {status === "reading" && (
        <Card className="mt-4 flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <span className="text-sm">Reading your document…</span>
        </Card>
      )}

      {status === "done" && result && (
        <>
          <Card className="mb-4 flex items-center gap-3 border-emerald-200 bg-emerald-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Icon name="check" className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-emerald-900">Filed on your timeline</span>
          </Card>
          <Card className="mb-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={result.type} />
              <span className="text-xs text-slate-500">{formatDate(result.date)}</span>
            </div>
            <div className="text-sm font-medium">{result.provider}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{result.summary}</p>
            <div className="mt-3">
              <FieldsTable fields={result.fields} />
            </div>
          </Card>
          <div className="flex flex-wrap gap-3">
            <Link href="/patient/chat" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">
              Ask what it means
            </Link>
            <Link href="/patient" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              See timeline
            </Link>
          </div>
        </>
      )}
    </>
  );
}
