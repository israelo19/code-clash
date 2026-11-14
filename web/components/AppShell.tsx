"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/config";
import { currentUser, signOut } from "@/lib/session";
import type { Role, User } from "@/lib/types";
import { Icon } from "./Icon";

const NAV: Record<Role, { href: string; label: string; icon: string }[]> = {
  patient: [
    { href: "/patient", label: "Records", icon: "home" },
    { href: "/patient/upload", label: "Upload", icon: "upload" },
    { href: "/patient/cost", label: "Costs", icon: "dollar" },
    { href: "/patient/chat", label: "Companion", icon: "chat" },
    { href: "/patient/share", label: "Share", icon: "share" },
  ],
  clinician: [{ href: "/clinician", label: "Open a code", icon: "key" }],
};

// Phone: top bar + bottom tab bar. Laptop (md and up): left sidebar.
export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = currentUser();
    if (!u || u.role !== role) router.replace("/");
    // Reading the demo account from localStorage has to happen in the browser, after the first render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setUser(u);
  }, [role, router]);

  if (!user) return null;

  const items = NAV[role];
  const isActive = (href: string) =>
    href === `/${role}` ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const logout = () => {
    signOut();
    router.replace("/");
  };

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Sidebar, laptop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 px-2 text-lg font-semibold text-teal-700">{APP_NAME}</div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(it.href) ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon name={it.icon} />
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-200 pt-4">
          <div className="px-2 text-sm font-medium">{user.name}</div>
          <div className="px-2 text-xs capitalize text-slate-500">{role}</div>
          <button onClick={logout} className="mt-2 flex items-center gap-2 px-2 text-sm text-slate-500 hover:text-slate-800">
            <Icon name="logout" className="h-4 w-4" /> Switch account
          </button>
        </div>
      </aside>

      {/* Top bar, phone */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <span className="font-semibold text-teal-700">{APP_NAME}</span>
        <button onClick={logout} className="text-xs text-slate-500">
          {user.name} · Switch
        </button>
      </header>

      <main className={`flex-1 px-4 py-5 md:px-10 md:py-8 ${items.length > 1 ? "pb-24 md:pb-8" : ""}`}>
        <div className="mx-auto w-full max-w-3xl">{children}</div>
      </main>

      {/* Bottom tabs, phone */}
      {items.length > 1 && (
        <nav className="fixed inset-x-0 bottom-0 z-10 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive(it.href) ? "text-teal-700" : "text-slate-500"
              }`}
            >
              <Icon name={it.icon} />
              {it.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
