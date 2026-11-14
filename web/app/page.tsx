"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { Card, ChatBubble, TypeBadge } from "@/components/ui";
import { SETTINGS, estimateCost, resetDemoData, serviceLabel } from "@/lib/api";
import { NOT_A_DOCTOR_LINE } from "@/lib/config";
import { DEMO_USERS } from "@/lib/mockData";
import { signIn } from "@/lib/session";
import type { ChatMessage, Estimate, Role } from "@/lib/types";

// Landing page and demo sign-in.
// Top to bottom: menu bar, headline with the two demo sign-in buttons, three floating preview cards
// (the middle one is a live cost check), "How it works", "Privacy", and the footer with "Reset demo data".
// Sign-in is still the two seeded accounts with no passwords (real sign-up is cut for today).

// ---------- text and sample content shown on this page

const PATIENT_FIRST_NAME = DEMO_USERS.patient.name.split(" ")[0];

const TAGS = ["Records vault", "Cost check", "AI companion"];

// Example rows for the "Records in one place" card. These are labels only, not real records.
const SAMPLE_RECORDS = [
  { type: "Immunization record", note: "Ready when a school or job asks for it" },
  { type: "Lab result", note: "Explained in plain language" },
  { type: "Visit summary", note: "Filed from a photo of the paperwork" },
];

// Example conversation for the companion card. It follows the companion rules: no diagnosis, shows its source.
const SAMPLE_CHAT: ChatMessage[] = [
  { role: "user", text: "What does a strep test cost?" },
  {
    role: "companion",
    text: "I can't tell you whether it's strep, but I can show what a test costs nearby and which records to bring.",
    sources: [{ kind: "estimate", label: "Rapid strep test, Towson area" }],
  },
];

// The visit loop from the project brief.
const STEPS = [
  {
    title: "Before the visit",
    text: "Tell the companion what is wrong. See a cost range for the options nearby and which records to bring.",
  },
  {
    title: "During the visit",
    text: "Share only the records you choose, using a code that expires. The clinician can add a visit note.",
  },
  {
    title: "After the visit",
    text: "Snap a photo of the paperwork. The app files it on your timeline and explains it in plain language.",
  },
];

const PRIVACY_POINTS = [
  "This demo uses synthetic records only. No real patient data.",
  "Nothing is shared until you create a code, and every code expires.",
  "Every clinician view is logged where you can see it.",
  "Prices are estimate ranges from public Medicare charge data. They are not quotes.",
];

// Services offered as buttons on the cost card. The codes come from section 6 of the brief.
const PREVIEW_SERVICES = [
  { code: "87880", label: "Strep test" },
  { code: "87804", label: "Flu test" },
  { code: "99213", label: "Office visit" },
];
const PREVIEW_ZIP = "21252"; // Towson

// Shared look for the white cards that float over the gradient. They lift a little on hover.
const GLASS_CARD =
  "rounded-3xl border border-white/70 bg-white/90 p-5 shadow-xl shadow-teal-900/10 backdrop-blur transition duration-300 hover:-translate-y-1";

// ---------- the page

export default function Login() {
  const router = useRouter();
  const [reset, setReset] = useState(false);

  // Demo sign-in: remember the role, then open that side of the app (or one specific screen).
  const go = (role: Role, path: string = `/${role}`) => {
    signIn(role);
    router.push(path);
  };

  // Smoothly scroll to a section of this page. Used by the menu at the top.
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main id="top" className="relative isolate">
      {/* Background gradient and dots. Decoration only, so screen readers skip it. */}
      <div aria-hidden className="hero-bg absolute inset-x-0 top-0 -z-10 h-[1040px]">
        <div className="hero-dots h-full w-full" />
      </div>

      {/* Menu bar. The pill-shaped menu in the middle is hidden on phones. */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo tone="light" />
        <nav className="hidden items-center gap-1 rounded-full border border-white/25 bg-white/10 p-1 text-sm text-white backdrop-blur md:flex">
          <button onClick={() => scrollTo("top")} className="rounded-full bg-white/20 px-4 py-1.5">
            Home
          </button>
          <button onClick={() => scrollTo("how")} className="rounded-full px-4 py-1.5 transition hover:bg-white/15">
            How it works
          </button>
          <button onClick={() => scrollTo("privacy")} className="rounded-full px-4 py-1.5 transition hover:bg-white/15">
            Privacy
          </button>
        </nav>
        <button
          onClick={() => go("clinician")}
          className="rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
        >
          Clinician sign in
        </button>
      </header>

      {/* Headline and the two demo sign-in buttons */}
      <section className="mx-auto max-w-3xl px-4 pt-8 text-center text-white md:pt-14">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-teal-50 md:text-sm">
          {TAGS.map((tag) => (
            <li key={tag}>→ {tag}</li>
          ))}
        </ul>

        <div className="relative mt-5">
          <h1 className="text-4xl font-medium tracking-tight md:text-6xl">Health care without the guesswork</h1>
          {/* Two small pink decorations next to the headline, laptop only */}
          <span
            aria-hidden
            className="absolute -right-2 -top-5 hidden h-10 w-10 rotate-12 items-center justify-center rounded-xl bg-pink-500 text-xl font-semibold shadow-lg shadow-pink-500/40 md:flex"
          >
            +
          </span>
          <span aria-hidden className="absolute -left-4 bottom-0 hidden animate-pulse text-2xl text-pink-200 md:block">
            ✦
          </span>
        </div>

        <p className="mx-auto mt-5 max-w-xl text-sm text-teal-50 md:text-base">
          Keep your records in one place, see what a visit will likely cost before you go, and get answers about your
          own paperwork in plain language.
        </p>

        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => go("patient")}
            className="rounded-full bg-pink-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-pink-700/30 transition hover:bg-pink-700"
          >
            Patient demo · {DEMO_USERS.patient.name}
          </button>
          <button
            onClick={() => go("clinician")}
            className="rounded-full border border-white/40 bg-white/15 px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/25"
          >
            Clinician demo · {DEMO_USERS.clinician.name}
          </button>
        </div>
        <p className="mt-3 text-xs text-teal-100">Two demo accounts with synthetic records. No password needed.</p>
      </section>

      {/* Three floating preview cards. On phones they stack, with the cost card first. */}
      <section className="mx-auto mt-10 grid max-w-5xl gap-4 px-4 md:mt-14 md:grid-cols-3 md:items-end">
        <div className={GLASS_CARD}>
          <CardTitle icon="file" title="Records in one place" />
          <ul className="mt-4 flex flex-col gap-3">
            {SAMPLE_RECORDS.map((record) => (
              <li key={record.type} className="rounded-xl bg-slate-50 p-3">
                <TypeBadge type={record.type} />
                <p className="mt-1 text-xs text-slate-600">{record.note}</p>
              </li>
            ))}
          </ul>
          <CardLink onClick={() => go("patient")}>Open the vault as {PATIENT_FIRST_NAME}</CardLink>
        </div>

        <CostPreview onOpen={() => go("patient", "/patient/cost")} />

        <div className={GLASS_CARD}>
          <CardTitle icon="chat" title="Answers from your records" />
          <div className="mt-4 flex flex-col gap-2">
            {SAMPLE_CHAT.map((msg, i) => (
              <ChatBubble key={i} msg={msg} />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">{NOT_A_DOCTOR_LINE}</p>
          <CardLink onClick={() => go("patient", "/patient/chat")}>Ask a question as {PATIENT_FIRST_NAME}</CardLink>
        </div>
      </section>

      {/* How it works: the visit loop */}
      <section id="how" className="mx-auto max-w-5xl px-4 pt-16 md:pt-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">One loop around a clinic visit</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-slate-500">
          Built for students and young adults who are managing their own health care for the first time.
        </p>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full transition hover:border-teal-300">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-medium">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy */}
      <section id="privacy" className="mx-auto max-w-5xl px-4 pt-16 md:pt-24">
        <Card className="md:p-8">
          <h2 className="text-xl font-semibold tracking-tight">Private by design</h2>
          <p className="mt-1 text-sm text-slate-500">Designed with HIPAA in mind.</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {PRIVACY_POINTS.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-slate-700">
                <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                {point}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <footer className="px-4 pb-10 pt-12 text-center text-xs text-slate-500">
        <p>Demo with synthetic records only. Designed with HIPAA in mind.</p>
        <button
          onClick={() => {
            resetDemoData();
            setReset(true);
          }}
          className="mt-2 underline"
        >
          {reset ? "Demo data reset ✓" : "Reset demo data"}
        </button>
      </footer>
    </main>
  );
}

// ---------- small pieces used above

// Heading at the top of a white floating card: a small icon and a title.
function CardTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
        <Icon name={icon} className="h-4 w-4" />
      </span>
      {title}
    </div>
  );
}

// Text button at the bottom of a white floating card.
function CardLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="mt-4 text-sm font-medium text-teal-700 hover:underline">
      {children} →
    </button>
  );
}

// The pink card in the middle: a small live cost check.
// Tapping a service asks lib/api.ts for an estimate at each care setting, the same call the full Costs screen makes.
// So when the real cost model is connected in lib/api.ts, this card shows its numbers with no change here.
function CostPreview({ onOpen }: { onOpen: () => void }) {
  const [code, setCode] = useState(PREVIEW_SERVICES[0].code);
  // The latest answer, saved together with the service code it belongs to.
  const [result, setResult] = useState<{ code: string; estimates: Estimate[] } | null>(null);
  // True until the answer for the selected service has arrived.
  const loading = result?.code !== code;

  useEffect(() => {
    let cancelled = false;
    Promise.all(SETTINGS.map((setting) => estimateCost(code, setting, PREVIEW_ZIP)))
      .then((list) => {
        if (!cancelled) setResult({ code, estimates: list });
      })
      .catch(() => {
        // If the request fails, show a short message instead of a broken card.
        if (!cancelled) setResult({ code, estimates: [] });
      });
    // If the user picks another service before this answer arrives, ignore the old answer.
    return () => {
      cancelled = true;
    };
  }, [code]);

  const estimates = result?.estimates ?? [];
  // The cheapest place to go is the one with the lowest typical price.
  const cheapest = estimates.length > 0 ? estimates.reduce((a, b) => (b.typical < a.typical ? b : a)) : null;
  // The longest bar belongs to the most expensive setting. The other bars are drawn relative to it.
  const maxHigh = Math.max(1, ...estimates.map((e) => e.high));

  return (
    <div className="order-first rounded-3xl bg-gradient-to-b from-pink-600 to-rose-600 p-5 text-white shadow-2xl shadow-pink-900/30 transition duration-300 hover:-translate-y-1 md:order-none md:pb-7">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
            <Icon name="dollar" className="h-4 w-4" />
          </span>
          Cost before you go
        </div>
        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium">Estimate</span>
      </div>

      {/* Service buttons. The selected one is white. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {PREVIEW_SERVICES.map((service) => (
          <button
            key={service.code}
            onClick={() => setCode(service.code)}
            aria-pressed={service.code === code}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              service.code === code ? "bg-white text-pink-700" : "bg-white/20 text-white hover:bg-white/30"
            }`}
          >
            {service.label}
          </button>
        ))}
      </div>

      {/* While new numbers load, the old ones stay on screen, slightly faded. */}
      <div className={`min-h-[17rem] transition-opacity ${loading ? "opacity-60" : ""}`}>
        {cheapest ? (
          <>
            <div className="mt-5 text-center">
              <div className="text-5xl font-semibold tracking-tight">
                ${cheapest.low}–${cheapest.high}
              </div>
              <div className="mt-1 text-xs">
                {serviceLabel(cheapest.service_code)} · Lowest: {cheapest.setting}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 text-slate-700">
              <ul className="flex flex-col gap-2.5">
                {estimates.map((e) => (
                  <li key={e.setting}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{e.setting}</span>
                      <span className="text-slate-500">
                        ${e.low}–${e.high}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          e === cheapest ? "bg-teal-500" : "bg-pink-400"
                        }`}
                        style={{ width: `${(e.high / maxHigh) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">{cheapest.caveat}</p>
            </div>
          </>
        ) : (
          <p className="pt-10 text-center text-sm">{loading ? "Estimating…" : "Estimate not available right now."}</p>
        )}
      </div>

      <button
        onClick={onOpen}
        className="mt-4 w-full rounded-full bg-white px-4 py-2 text-sm font-medium text-pink-700 transition hover:bg-pink-50"
      >
        Full cost check as {PATIENT_FIRST_NAME} →
      </button>
    </div>
  );
}
