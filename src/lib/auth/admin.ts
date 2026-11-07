import "server-only";
import { cookies } from "next/headers";
import { hmac, safeEqual, sha256 } from "@/lib/security";

export const ADMIN_COOKIE = "bb_admin";
const SESSION_HOURS = 12;
const DEMO_PASSWORD = "bluebook-demo";

/**
 * Administrator password. Production requires ADMIN_PASSWORD. Outside production a
 * documented demo password is used so the dashboard works in local demo mode.
 */
export function adminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  return process.env.NODE_ENV === "production" ? null : DEMO_PASSWORD;
}

export function usingDemoPassword(): boolean {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET || adminPassword();
  if (!s) throw new Error("Admin is not configured");
  return sha256(`bluebook-admin:${s}`);
}

export function checkPassword(candidate: string): boolean {
  const pw = adminPassword();
  if (!pw) return false;
  return safeEqual(sha256(candidate), sha256(pw));
}

export function createSessionValue(now = Date.now()): string {
  const expires = now + SESSION_HOURS * 3600 * 1000;
  return `${expires}.${hmac(secret(), String(expires))}`;
}

export function verifySessionValue(value: string | undefined, now = Date.now()): boolean {
  if (!value || !adminPassword()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig) return false;
  if (Number(exp) < now) return false;
  return safeEqual(sig, hmac(secret(), exp));
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(ADMIN_COOKIE)?.value);
}

export async function setAdminSession() {
  const store = await cookies();
  store.set(ADMIN_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
