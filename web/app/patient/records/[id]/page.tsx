"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Card, FieldsTable, PageHeader, TypeBadge, formatDate } from "@/components/ui";
import { getDocument } from "@/lib/api";
import type { HealthDocument } from "@/lib/types";

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>();
  const [doc, setDoc] = useState<HealthDocument | null | undefined>(undefined);

  useEffect(() => {
    getDocument(id).then(setDoc);
  }, [id]);

  if (doc === undefined) return <p className="text-sm text-slate-500">Loading…</p>;
  if (doc === null) return <p className="text-sm text-slate-500">Record not found.</p>;

  return (
    <>
      <Link href="/patient" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <Icon name="back" className="h-4 w-4" /> Timeline
      </Link>
      <div className="mb-2">
        <TypeBadge type={doc.type} />
      </div>
      <PageHeader title={doc.provider} subtitle={formatDate(doc.date)} />

      <Card className="mb-4 border-teal-200 bg-teal-50/50">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-teal-700">In plain language</div>
        <p className="text-sm leading-relaxed">{doc.summary}</p>
      </Card>

      <Card className="mb-4">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Key details</div>
        <FieldsTable fields={doc.fields} />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Link href="/patient/chat" className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700">
          Ask about this record
        </Link>
        <Link href="/patient/share" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Share it
        </Link>
      </div>
    </>
  );
}
