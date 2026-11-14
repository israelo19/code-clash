import Link from "next/link";
import type { ChatMessage, ClinicianNote, Estimate, HealthDocument } from "@/lib/types";
import { Icon } from "./Icon";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function formatDate(iso: string) {
  return new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_COLORS: Record<string, string> = {
  "Immunization record": "bg-emerald-100 text-emerald-800",
  "Visit summary": "bg-sky-100 text-sky-800",
  "Lab result": "bg-violet-100 text-violet-800",
  "Physical form": "bg-amber-100 text-amber-800",
  Note: "bg-rose-100 text-rose-800",
};

export function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type] ?? "bg-slate-100 text-slate-700"}`}>
      {type}
    </span>
  );
}

// One entry on the records timeline.
export function TimelineItem({ doc, href }: { doc: HealthDocument; href?: string }) {
  const body = (
    <div className="flex gap-3">
      <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <Icon name="file" className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={doc.type} />
          <span className="text-xs text-slate-500">{formatDate(doc.date)}</span>
        </div>
        <div className="mt-1 text-sm font-medium">{doc.provider}</div>
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{doc.summary}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300">
      {body}
    </Link>
  ) : (
    <Card>{body}</Card>
  );
}

export function NoteItem({ note }: { note: ClinicianNote }) {
  return (
    <Card>
      <div className="flex gap-3">
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700">
          <Icon name="note" className="h-4 w-4" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type="Note" />
            <span className="text-xs text-slate-500">{formatDate(note.created_at)}</span>
          </div>
          <div className="mt-1 text-sm font-medium">{note.clinician_name}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{note.text}</p>
        </div>
      </div>
    </Card>
  );
}

export function FieldsTable({ fields }: { fields: Record<string, string> }) {
  return (
    <dl className="divide-y divide-slate-100">
      {Object.entries(fields).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 py-2 text-sm">
          <dt className="text-slate-500">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Low / typical / high price card. Always labeled as an estimate.
export function CostRangeCard({ estimate, highlight = false }: { estimate: Estimate; highlight?: boolean }) {
  const { low, typical, high } = estimate;
  const pct = ((typical - low) / (high - low || 1)) * 100;
  return (
    <Card className={highlight ? "border-teal-400 ring-1 ring-teal-200" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium">{estimate.label}</div>
          <div className="text-xs text-slate-500">{estimate.detail}</div>
        </div>
        {highlight && <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-xs font-medium text-white">Lowest</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold">
        ${low}–${high}
      </div>
      <div className="text-xs text-slate-500">Typical about ${typical}</div>
      <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-emerald-200 via-amber-200 to-rose-200">
        <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded bg-slate-800" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>Low</span>
        <span>High</span>
      </div>
    </Card>
  );
}

export function ChatBubble({ msg }: { msg: ChatMessage }) {
  const mine = msg.role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          mine
            ? "rounded-br-sm bg-teal-600 text-white"
            : msg.urgent
            ? "rounded-bl-sm border border-rose-300 bg-rose-50 text-rose-900"
            : "rounded-bl-sm border border-slate-200 bg-white"
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.text}</p>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Used</div>
            <ul className="mt-1 flex flex-col gap-1">
              {msg.sources.map((s, i) => (
                <li key={i} className="text-xs">
                  {s.kind === "record" ? (
                    <Link href={`/patient/records/${s.id}`} className="text-teal-700 underline">
                      📄 {s.label}
                    </Link>
                  ) : (
                    <span className="text-slate-600">💲 Cost estimate: {s.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-300"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button {...props} className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${styles} ${className}`}>
      {children}
    </button>
  );
}
