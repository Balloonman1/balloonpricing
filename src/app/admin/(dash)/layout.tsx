import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth/admin";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pricing", label: "Pricing rules" },
  { href: "/admin/versions", label: "Versions" },
  { href: "/admin/comparables", label: "Comparable sales" },
  { href: "/admin/calibration", label: "Calibration" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const repo = getRepository();
  const active = await repo.getActiveConfig();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <nav aria-label="Administration" className="flex flex-wrap gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-[0.94rem] text-muted hover:bg-paper hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>
            Active pricing v{active.version}
            {repo.mode === "demo" && " · demo storage"}
          </span>
          <form action="/api/admin/logout" method="post">
            <button className="text-flame-deep underline underline-offset-4">Sign out</button>
          </form>
        </div>
      </div>
      <div className="pt-8">{children}</div>
    </div>
  );
}
