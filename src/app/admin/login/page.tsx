import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminPassword, isAdmin, usingDemoPassword } from "@/lib/auth/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administrator sign-in", robots: { index: false, follow: false } };

export default async function AdminLogin() {
  if (await isAdmin()) redirect("/admin");
  const configured = Boolean(adminPassword());
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="text-3xl">Administrator sign-in</h1>
      {configured ? (
        <>
          <p className="mt-3 text-muted">Pricing rules, comparable sales and valuation analytics.</p>
          <LoginForm />
          {usingDemoPassword() && (
            <p className="mt-6 rounded-md bg-gold-soft px-4 py-3 text-sm text-[#5f4a2a]">
              Local demo mode{isSupabaseConfigured() ? "" : " without a database"}. The password is <code className="font-medium">bluebook-demo</code>. Set ADMIN_PASSWORD before deploying.
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-muted">The dashboard is turned off because ADMIN_PASSWORD is not set for this deployment.</p>
      )}
    </div>
  );
}
