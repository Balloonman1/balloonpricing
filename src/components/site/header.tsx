import Link from "next/link";
import { Logo } from "./logo";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/guides", label: "Guides" },
  { href: "/account", label: "My valuations" },
];

export function SiteHeader() {
  return (
    <header className="no-print border-b border-line-soft bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-ivory/75 sticky top-0 z-30">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Balloon Bluebook home" className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-[0.94rem]">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hidden rounded-md px-3 py-2 text-muted hover:text-ink md:inline-block">
              {n.label}
            </Link>
          ))}
          <Link href="/value" className="ml-2 rounded-md bg-navy-900 px-4 py-2 font-medium text-ivory hover:bg-navy-800">
            Value my balloon
          </Link>
        </nav>
      </div>
    </header>
  );
}
