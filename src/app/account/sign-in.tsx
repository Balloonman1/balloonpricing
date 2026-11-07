"use client";

import { useState } from "react";
import { Button, Field, TextInput } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SignIn({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  return (
    <form
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        const client = getBrowserClient();
        if (!client) return setState("error");
        setState("sending");
        const redirect = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
        const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        setState(error ? "error" : "sent");
      }}
    >
      <Field label="Email" htmlFor="email" className="flex-1">
        <TextInput id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </Button>
      {state === "sent" && <p role="status" className="text-sm text-sage sm:basis-full">Check your email for the sign-in link.</p>}
      {state === "error" && <p role="alert" className="text-sm text-[#9a3412] sm:basis-full">The sign-in link could not be sent. Check the address and try again.</p>}
    </form>
  );
}
