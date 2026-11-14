"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { NoteItem, PageHeader, TimelineItem } from "@/components/ui";
import { listDocuments, listNotes } from "@/lib/api";
import { DEMO_USERS } from "@/lib/mockData";
import type { ClinicianNote, HealthDocument } from "@/lib/types";

type Entry = { kind: "doc"; date: string; doc: HealthDocument } | { kind: "note"; date: string; note: ClinicianNote };

// Patient dashboard: quick actions + the records timeline (documents and clinician notes, newest first).
export default function PatientHome() {
  const patient = DEMO_USERS.patient;
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    Promise.all([listDocuments(patient.id), listNotes(patient.id)]).then(([docs, notes]) => {
      const all: Entry[] = [
        ...docs.map((doc) => ({ kind: "doc" as const, date: doc.date, doc })),
        ...notes.map((note) => ({ kind: "note" as const, date: note.created_at.slice(0, 10), note })),
      ];
      setEntries(all.sort((a, b) => b.date.localeCompare(a.date)));
    });
  }, [patient.id]);

  const actions = [
    { href: "/patient/chat", label: "Ask the companion", icon: "chat" },
    { href: "/patient/cost", label: "Check a cost", icon: "dollar" },
    { href: "/patient/upload", label: "Add a document", icon: "camera" },
    { href: "/patient/share", label: "Share records", icon: "share" },
  ];

  return (
    <>
      <PageHeader title={`Hi, ${patient.name.split(" ")[0]}`} subtitle="Your health records, all in one place." />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium shadow-sm transition hover:border-teal-400"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50 text-teal-700">
              <Icon name={a.icon} />
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Timeline</h2>
      {entries === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500">No records yet. Add your first document.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((e) =>
            e.kind === "doc" ? (
              <TimelineItem key={e.doc.id} doc={e.doc} href={`/patient/records/${e.doc.id}`} />
            ) : (
              <NoteItem key={e.note.id} note={e.note} />
            )
          )}
        </div>
      )}
    </>
  );
}
