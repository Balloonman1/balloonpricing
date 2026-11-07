import { NextResponse } from "next/server";
import { getUserClient } from "@/lib/supabase/server";

/** Completes the magic-link sign-in and returns to a same-site path. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/account";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/account";
  const client = await getUserClient();
  if (client && code) await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next, url.origin));
}
