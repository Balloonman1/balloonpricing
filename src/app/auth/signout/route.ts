import { NextResponse } from "next/server";
import { getUserClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const client = await getUserClient();
  if (client) await client.auth.signOut();
  return NextResponse.redirect(new URL("/account", req.url), 303);
}
