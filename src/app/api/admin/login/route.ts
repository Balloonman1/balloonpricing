import { fail, json, readJson } from "@/lib/api";
import { adminPassword, checkPassword, setAdminSession } from "@/lib/auth/admin";
import { clientIp, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  if (!adminPassword()) return fail("The administrator dashboard is not configured. Set ADMIN_PASSWORD.", 503);
  if (!rateLimit(`admin-login:${clientIp(req)}`, 8, 15 * 60_000)) return fail("Too many attempts. Try again in 15 minutes.", 429);
  const body = (await readJson(req).catch(() => ({}))) as { password?: string };
  if (!body.password || !checkPassword(body.password)) return fail("That password is not correct.", 401);
  await setAdminSession();
  return json({ ok: true });
}
