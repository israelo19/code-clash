"use client";

import type { User } from "./types";

// Who is signed in.
//
// The backend keeps the session. After a correct sign-in it gives the browser a
// cookie that page scripts cannot read, and the browser sends it back with every
// /api request. So nothing secret is stored here: this file only remembers, for
// the screens, the user the backend last told us about.

let cached: User | null = null;

// Other files can ask to be told when the user changes, so they can forget
// anything that belonged to the previous user (the chat so far, for example).
const whenUserChanges: (() => void)[] = [];
export function onUserChange(forget: () => void) {
  whenUserChanges.push(forget);
}
function setUser(user: User | null) {
  if (user?.id !== cached?.id) whenUserChanges.forEach((forget) => forget());
  cached = user;
}

// The signed-in user, asked from the backend (GET /api/me). Null if nobody is.
export async function fetchUser(): Promise<User | null> {
  try {
    const reply = await fetch("/api/me", { cache: "no-store" });
    setUser(reply.ok ? ((await reply.json()) as { user: User }).user : null);
  } catch {
    setUser(null);
  }
  return cached;
}

// The user from the last check. Screens inside AppShell can use this directly,
// because AppShell only shows them after the check has passed.
export function signedInUser(): User | null {
  return cached;
}

// Called by the sign-in form once the backend has accepted the password.
export function rememberUser(user: User | null) {
  setUser(user);
}

// End the session on the backend, then forget the user here.
export async function signOut() {
  setUser(null);
  try {
    await fetch("/api/logout", { method: "POST", headers: { "X-CareVault-Request": "1" } });
  } catch {}
}
