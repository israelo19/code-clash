"use client";

import { DEMO_USERS } from "./mockData";
import type { Role, User } from "./types";

// Demo sign-in only (real sign-up is cut for today). Stores which seeded account is active.
const KEY = "demo_role";

export function signIn(role: Role) {
  try {
    localStorage.setItem(KEY, role);
  } catch {}
}

export function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function currentUser(): User | null {
  try {
    const role = localStorage.getItem(KEY) as Role | null;
    return role ? DEMO_USERS[role] : null;
  } catch {
    return null;
  }
}
