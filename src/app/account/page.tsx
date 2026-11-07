import type { Metadata } from "next";
import Link from "next/link";
import { Panel } from "@/components/ui";
import { getRepository } from "@/lib/data";
import { formatUsd } from "@/lib/engine/math";
import { publicAuthEnabled } from "@/lib/env";
import { getCurrentUser } from "@/lib/supabase/server";
import { reportTitle } from "@/components/report/labels";
import { DeviceList } from "./device-list";
import { SignIn } from "./sign-in";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My valuations", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  const saved = user ? await getRepository().listValuationsForUser(user.id) : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl">My valuations</h1>
      <p className="mt-3 max-w-2xl text-muted">Valuations are private. They open in the browser that created them, or anywhere once saved to an account.</p>

      {publicAuthEnabled && (
        <section className="mt-10">
          <h2 className="text-2xl">Account</h2>
          {user ? (
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted">Signed in as {user.email}</p>
                <form action="/auth/signout" method="post">
                  <button className="text-sm text-flame-deep underline underline-offset-4">Sign out</button>
                </form>
              </div>
              {saved.length ? (
                <Panel className="mt-4">
                  <ul className="divide-y divide-line-soft">
                    {saved.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-3 p-4 sm:p-5">
                        <div>
                          <Link href={`/valuation/${v.id}`} className="font-medium hover:text-flame-deep">
                            {reportTitle(v.input)}
                          </Link>
                          <p className="tabular text-sm text-muted">{v.referenceNumber}</p>
                        </div>
                        <span className="tabular font-serif text-xl">{formatUsd(v.result.fairMarketValueCents)}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              ) : (
                <p className="mt-4 text-muted">Nothing saved to your account yet. Open a valuation and choose Save to account.</p>
              )}
            </div>
          ) : (
            <Panel className="mt-4 p-6">
              <p className="mb-4 text-muted">Sign in to keep valuations across devices. No password needed.</p>
              <SignIn next={next} />
            </Panel>
          )}
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl">On this device</h2>
        <div className="mt-4">
          <DeviceList />
        </div>
      </section>
    </div>
  );
}
