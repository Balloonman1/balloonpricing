import Link from "next/link";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/guides", label: "Guides" },
  { href: "/account", label: "My valuations" },
];

export function SiteHeader() {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line-soft bg-ivory/90 backdrop-blur supports-[backdrop-filter]:bg-ivory/75">
      <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <Link href="/" aria-label="Balloon Bluebook home" className="shrink-0">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label="Main" className="hidden items-center gap-1 text-[0.94rem] md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-muted hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link href="/value" className="ml-1 whitespace-nowrap rounded-md bg-navy-900 px-3 py-2 text-sm font-medium text-ivory hover:bg-navy-800 sm:px-4 sm:text-[0.94rem]">
            <span className="sm:hidden">Value it</span>
            <span className="max-sm:hidden">Value my balloon</span>
          </Link>
          <MobileMenu items={[...NAV, { href: "/value", label: "Value my balloon" }]} />
        </div>
      </div>
    </header>
  );
}
