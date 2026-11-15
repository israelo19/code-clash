"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkLogin } from "@/lib/api";
import { DEMO_LOGINS } from "@/lib/mockData";
import type { Role } from "@/lib/types";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { Button } from "./ui";

// The sign-in screen, shared by two pages:
//   /signin            -> patient   (app/signin/page.tsx)
//   /signin/clinician  -> clinician (app/signin/clinician/page.tsx)
// The email and password boxes start filled in with the demo account, so one tap on "Sign in" is enough.
// checkLogin() in lib/api.ts asks the backend if the details are right. If they are, the backend
// starts a session (a cookie the browser keeps) and we open that side of the app.

// The words that change between the patient and the clinician version.
const COPY: Record<Role, { headline: string; subtitle: string; points: { icon: string; text: string }[] }> = {
  patient: {
    headline: "Sign in to your health vault",
    subtitle: "Everything about your care, in one place.",
    points: [
      { icon: "chat", text: "Ask the companion about your records" },
      { icon: "dollar", text: "Check what a visit will likely cost" },
      { icon: "upload", text: "Add a document from a photo" },
      { icon: "file", text: "Look at your records on a timeline" },
    ],
  },
  clinician: {
    headline: "Sign in to view shared records",
    subtitle: "See only what a patient chose to share with you.",
    points: [
      { icon: "key", text: "Open records with a share code" },
      { icon: "note", text: "Add a visit note to the patient timeline" },
      { icon: "check", text: "Every view is logged for the patient" },
    ],
  },
};

// "idle" = waiting for the user, "checking" = sign-in in progress,
// "wrong" = email or password did not match, "failed" = the check itself could not run.
type Status = "idle" | "checking" | "wrong" | "failed";

const INPUT_STYLE =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200";

export function SignInForm({ role }: { role: Role }) {
  const router = useRouter();
  const demo = DEMO_LOGINS[role];
  const copy = COPY[role];

  const [email, setEmail] = useState(demo.email);
  const [password, setPassword] = useState(demo.password);
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const submit = async () => {
    setStatus("checking");
    try {
      const user = await checkLogin(role, email, password);
      if (!user) {
        setStatus("wrong");
        return;
      }
      router.push(`/${role}`); // open the patient or clinician side
    } catch {
      setStatus("failed");
    }
  };

  // Put the demo account back into the boxes (after a typo, for example).
  const fillDemo = () => {
    setEmail(demo.email);
    setPassword(demo.password);
    setStatus("idle");
  };

  // Look of the Patient / Clinician switch. The current one is white.
  const tab = (active: boolean) =>
    `rounded-full py-2 text-center transition ${
      active ? "bg-white text-teal-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
    }`;

  return (
    <main className="signin-bg relative isolate flex min-h-dvh flex-col">
      {/* Dots at the edges, same decoration as the home page. */}
      <div aria-hidden className="hero-dots absolute inset-0 -z-10" />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
        <Logo tone="light" />
        <Link href="/" className="text-sm text-teal-50 hover:underline">
          ← Back to home
        </Link>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 pb-10 md:grid-cols-2">
        {/* Left side, laptop only: what you can do after signing in. */}
        <section className="hidden text-white md:block">
          <p className="text-4xl font-medium tracking-tight">{copy.headline}</p>
          <p className="mt-3 text-teal-50">{copy.subtitle}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {copy.points.map((point) => (
              <li key={point.text} className="flex items-center gap-3 text-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon name={point.icon} className="h-4 w-4" />
                </span>
                {point.text}
              </li>
            ))}
          </ul>
        </section>

        {/* The sign-in card */}
        <section className="mx-auto w-full max-w-md rounded-3xl border border-white/70 bg-white p-6 shadow-2xl shadow-teal-950/30">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">
            {role === "patient" ? "Sign in to open your records." : "Sign in to open shared records."}
          </p>

          {/* Patient / Clinician switch. Each side is its own page, so these are links. */}
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 text-sm font-medium">
            <Link href="/signin" aria-current={role === "patient" ? "page" : undefined} className={tab(role === "patient")}>
              Patient
            </Link>
            <Link
              href="/signin/clinician"
              aria-current={role === "clinician" ? "page" : undefined}
              className={tab(role === "clinician")}
            >
              Clinician
            </Link>
          </div>

          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault(); // stop the browser from reloading the page
              submit();
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Email</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus("idle");
                }}
                className={INPUT_STYLE}
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Password</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setStatus("idle");
                  }}
                  className={`${INPUT_STYLE} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-teal-700"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {status === "wrong" && (
              <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                That email and password do not match an account.
              </p>
            )}
            {status === "failed" && (
              <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                Could not sign in right now. Please try again.
              </p>
            )}

            <Button disabled={status === "checking"} className="flex w-full items-center justify-center gap-2">
              {status === "checking" && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {status === "checking" ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <button type="button" onClick={fillDemo} className="mt-4 w-full text-center text-sm font-medium text-teal-700 hover:underline">
            Fill in the demo account
          </button>

          <p className="mt-5 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            Demo with synthetic records only. Not HIPAA compliant: do not enter real health information.
          </p>
        </section>
      </div>
    </main>
  );
}
