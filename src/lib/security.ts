import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Unguessable URL-safe token (default 24 bytes = 192 bits). */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Human-readable reference such as BB-20261107-7K4Q2M. */
export function referenceNumber(date = new Date()): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `BB-${ymd}-${suffix}`;
}

/* Best-effort in-memory rate limiter (per server instance). */
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10000) {
      for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    }
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
