import type { Metadata } from "next";
import Link from "next/link";
import { GUIDES } from "@/content/guides";

export const metadata: Metadata = {
  title: "Guides to hot air balloon values",
  description: "Plain-language guides to used hot air balloon prices, depreciation and values by manufacturer.",
  alternates: { canonical: "/guides" },
};

export default function GuidesIndex() {
  const general = GUIDES.filter((g) => !g.manufacturer);
  const makers = GUIDES.filter((g) => g.manufacturer);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl sm:text-5xl">Guides</h1>
      <p className="mt-3 max-w-2xl text-muted">How used balloon values are worked out, and what to know about each manufacturer.</p>
      <ul className="mt-10 divide-y divide-line border-y border-line">
        {general.map((g) => (
          <li key={g.slug}>
            <Link href={`/${g.slug}`} className="block py-5 hover:text-flame-deep">
              <span className="font-serif text-xl">{g.title}</span>
              <span className="mt-1 block text-[0.95rem] text-muted">{g.description}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mt-14 text-2xl">By manufacturer</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {makers.map((g) => (
          <Link key={g.slug} href={`/${g.slug}`} className="rounded-full border border-line bg-paper px-4 py-2 hover:border-navy-500">
            {g.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
