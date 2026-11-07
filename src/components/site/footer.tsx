import Link from "next/link";
import { DISCLAIMER } from "./disclaimer";
import { Logo } from "./logo";

const COLS = [
  {
    title: "Values",
    links: [
      { href: "/hot-air-balloon-value-calculator", label: "Value calculator" },
      { href: "/used-hot-air-balloon-prices", label: "Used balloon prices" },
      { href: "/how-much-is-a-used-hot-air-balloon-worth", label: "What is a used balloon worth?" },
      { href: "/hot-air-balloon-depreciation-explained", label: "Depreciation explained" },
    ],
  },
  {
    title: "Manufacturers",
    links: [
      { href: "/cameron-balloon-values", label: "Cameron" },
      { href: "/aerostar-balloon-values", label: "Aerostar" },
      { href: "/lindstrand-balloon-values", label: "Lindstrand" },
      { href: "/ultramagic-balloon-values", label: "Ultramagic" },
      { href: "/kubicek-balloon-values", label: "Kubicek" },
    ],
  },
  {
    title: "Balloon Bluebook",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/account", label: "My valuations" },
      { href: "/value", label: "Start a valuation" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-24 bg-navy-950 text-ivory/80">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo inverted />
            <p className="mt-4 max-w-xs text-sm text-ivory/60">Know what your balloon is really worth.</p>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h2 className="font-sans text-sm font-semibold text-ivory">{c.title}</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-ivory">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-4xl border-t border-white/10 pt-6 text-xs leading-relaxed text-ivory/55">{DISCLAIMER}</p>
        <p className="mt-4 text-xs text-ivory/40">
          Model list compiled from the Balloon History Archive registry, sourced from The HAB Database. © {new Date().getFullYear()} Balloon Bluebook.
        </p>
      </div>
    </footer>
  );
}
