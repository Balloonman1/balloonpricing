import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ValueAltimeter } from "@/components/report/gauges";
import { ButtonLink } from "@/components/ui";
import { CATALOG } from "@/lib/catalog";
import { getActiveConfigSafe } from "@/lib/data";
import { formatUsd } from "@/lib/engine/math";
import type { ValuationInput } from "@/lib/engine/types";
import { valuate } from "@/lib/engine/valuate";
import { siteUrl } from "@/lib/env";

export const revalidate = 3600;

const SAMPLE: ValuationInput = {
  manufacturer: "Cameron",
  model: "O-90",
  volumeCuFt: 90000,
  year: 2012,
  hours: 210,
  category: "sport",
  scope: "complete_system",
  envelope: { fabric: "polyester", condition: "B", appearance: "warm", heavyBranding: false },
  basket: { manufacturer: "Cameron", year: 2012, condition: "B" },
  burner: { manufacturer: "Cameron", model: "Super Doubles", modelId: "burner-cameron-super-doubles", glow: "non_glow" },
  tanks: [{ manufacturer: "Worthington", material: "aluminum", capacity: "10", quantity: 3 }],
  accessories: [{ key: "inflation_fan" }],
  askingPriceCents: 2_450_000,
};

const STEPS = [
  { title: "Replacement cost", body: "We start from what an equivalent new envelope costs today, by volume, or from your own quote." },
  { title: "Hours", body: "Flight hours use up a share of an economic reference life: 600 hours for sport and commercial envelopes, 400 for racers, 450 for special shapes." },
  { title: "Age", body: "Envelopes lose about 2% a year for the first 20 years, then depreciation steepens to 5% a year." },
  { title: "Condition, fabric, appearance", body: "Each adjustment is shown on the report. Nylon takes 5% off. Hard-to-resell colors or heavy branding take up to 20% off." },
  { title: "Hardware", body: "Basket, burner, tanks and accessories are valued separately, each with its own age and condition. Known used values are never depreciated twice." },
  { title: "Policies and range", body: "Age and brand policies cap legacy systems. You get a fair market value, a selling range and a listing price with room to negotiate." },
];

export default async function Home() {
  const config = await getActiveConfigSafe();
  const sample = valuate(SAMPLE, config.snapshot);
  const hasPhoto = existsSync(path.join(process.cwd(), "public", "hero.jpg"));
  const modelCount = CATALOG.manufacturers.reduce((n, m) => n + m.models.length, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Balloon Bluebook",
    url: siteUrl,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    description: "Hot air balloon value calculator for used envelopes, complete systems and equipment.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-stretch gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
          <div className="animate-rise flex flex-col justify-center">
            <p className="text-[0.95rem] text-flame-deep">Know what your balloon is really worth.</p>
            <h1 className="mt-4 text-[2.7rem] leading-[1.05] sm:text-[3.6rem] lg:text-[4.1rem]">What&rsquo;s your hot air balloon really worth?</h1>
            <p className="mt-6 max-w-xl text-[1.1rem] leading-relaxed text-muted">
              Get an instant estimate of your hot air balloon&rsquo;s fair market value based on manufacturer, model, age, flight hours, fabric, condition, and equipment.
            </p>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-ink">
              No inflated asking prices. No guesswork disguised as market data. Just transparent valuations based on a consistent pricing methodology.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/value" variant="flame" size="lg">
                Value my balloon
              </ButtonLink>
              <ButtonLink href="/how-it-works" variant="secondary" size="lg">
                How it works
              </ButtonLink>
            </div>
            <p className="mt-6 text-sm text-muted">Free. No account or email needed. About two minutes.</p>
          </div>

          <div className="relative min-h-[360px] overflow-hidden rounded-[14px] bg-navy-900 lg:min-h-[540px]">
            {hasPhoto ? (
              <Image src="/hero.jpg" alt="Hot air balloon inflating at sunrise" fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
            ) : (
              <HeroIllustration />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/85 to-transparent p-6 pt-20">
              <p className="text-sm text-ivory/75">Example estimate</p>
              <p className="tabular font-serif text-3xl text-ivory">{formatUsd(sample.fairMarketValueCents)}</p>
              <p className="text-sm text-ivory/75">2012 Cameron O-90 system, 210 hours</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sample report */}
      <section className="border-y border-line-soft bg-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-20">
          <div>
            <h2 className="text-3xl sm:text-4xl">A report you can check line by line</h2>
            <p className="mt-4 max-w-lg text-muted">
              Every valuation shows the replacement cost it started from, each adjustment it applied and why, and what it assumed where details were missing. Here is the example above, computed live
              with the current pricing rules.
            </p>
            <dl className="mt-8 grid max-w-md grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <dt className="text-sm text-muted">Fair market value</dt>
                <dd className="tabular font-serif text-2xl">{formatUsd(sample.fairMarketValueCents)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Selling range</dt>
                <dd className="tabular text-lg">
                  {formatUsd(sample.rangeLowCents)} to {formatUsd(sample.rangeHighCents)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Recommended listing</dt>
                <dd className="tabular text-lg">{formatUsd(sample.listingPriceCents)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Seller asking</dt>
                <dd className="tabular text-lg">
                  {formatUsd(SAMPLE.askingPriceCents!)}{" "}
                  {sample.asking?.percent !== null && sample.asking?.percent !== undefined && (
                    <span className="text-sm text-muted">
                      ({sample.asking.percent >= 0 ? "+" : ""}
                      {sample.asking.percent.toFixed(0)}%)
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            <ButtonLink href="/value" className="mt-9">
              Value my balloon
            </ButtonLink>
          </div>
          <div className="grid gap-6 rounded-[var(--radius-panel)] border border-line bg-ivory/50 p-6 sm:grid-cols-[1fr_260px]">
            <table className="w-full self-start text-[0.95rem]">
              <caption className="pb-3 text-left font-sans text-sm text-muted">Component breakdown</caption>
              <tbody>
                {sample.components.map((c) => (
                  <tr key={c.kind} className="border-t border-line-soft">
                    <td className="py-2.5 pr-3">{c.kind.charAt(0).toUpperCase() + c.kind.slice(1)}</td>
                    <td className="tabular py-2.5 text-right">{formatUsd(c.displayCents)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-navy-900 font-medium">
                  <td className="py-2.5">Fair market value</td>
                  <td className="tabular py-2.5 text-right">{formatUsd(sample.fairMarketValueCents)}</td>
                </tr>
              </tbody>
            </table>
            <div className="flex justify-center">
              <ValueAltimeter fmv={sample.fairMarketValueCents} low={sample.rangeLowCents} high={sample.rangeHighCents} listing={sample.listingPriceCents} asking={sample.asking?.askingCents} height={300} />
            </div>
          </div>
        </div>
      </section>

      {/* Method */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl sm:text-4xl">How the value is built</h2>
          <p className="mt-4 text-muted">The same rules apply to every balloon, in the same order. Nothing is invented from listings or guessed by software.</p>
        </div>
        <ol className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-navy-900 pt-5">
              <span className="tabular text-sm text-flame-deep">Step {i + 1}</span>
              <h3 className="mt-1.5 text-xl">{s.title}</h3>
              <p className="mt-2 text-[0.96rem] text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <Link href="/how-it-works" className="mt-10 inline-block text-flame-deep underline underline-offset-4">
          Read the full methodology
        </Link>
      </section>

      {/* Principles */}
      <section className="bg-navy-900 text-ivory">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
          <h2 className="text-3xl text-ivory sm:text-4xl">Honest about what it knows</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <h3 className="font-sans text-base font-semibold text-ivory">Asking prices are not sales</h3>
              <p className="mt-2 text-ivory/70">Listings tell you what sellers hope for. Only verified completed sales are used to measure accuracy, and none are invented.</p>
            </div>
            <div>
              <h3 className="font-sans text-base font-semibold text-ivory">Assumptions are labeled</h3>
              <p className="mt-2 text-ivory/70">Unknown tank material, a missing basket year or an unlisted burner is flagged on the report, and the confidence level drops to match.</p>
            </div>
            <div>
              <h3 className="font-sans text-base font-semibold text-ivory">Value is not airworthiness</h3>
              <p className="mt-2 text-ivory/70">An estimate says nothing about whether a balloon is fit to fly. That takes an inspection under the applicable regulations.</p>
            </div>
            <div>
              <h3 className="font-sans text-base font-semibold text-ivory">{modelCount.toLocaleString("en-US")} models on file</h3>
              <p className="mt-2 text-ivory/70">
                Model names and typical sizes come from a registry of {CATALOG.recordCount.toLocaleString("en-US")} balloons. Anything newer can be typed in.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturers */}
      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <h2 className="text-2xl sm:text-3xl">Values by manufacturer</h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {["Cameron", "Aerostar", "Lindstrand", "Ultramagic", "Kubicek"].map((m) => (
            <Link key={m} href={`/${m.toLowerCase()}-balloon-values`} className="rounded-full border border-line bg-paper px-4 py-2 text-[0.95rem] hover:border-navy-500">
              {m} balloon values
            </Link>
          ))}
          <Link href="/used-hot-air-balloon-prices" className="rounded-full border border-line bg-paper px-4 py-2 text-[0.95rem] hover:border-navy-500">
            Used balloon prices
          </Link>
        </div>
      </section>
    </>
  );
}

/** Fallback hero artwork: a line drawing of an envelope at dawn. Replace with public/hero.jpg. */
function HeroIllustration() {
  const gores = 9;
  return (
    <svg viewBox="0 0 560 560" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="dawn" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#12243f" />
          <stop offset="0.55" stopColor="#284468" />
          <stop offset="0.82" stopColor="#a98652" />
          <stop offset="1" stopColor="#c05f2a" />
        </linearGradient>
      </defs>
      <rect width="560" height="560" fill="url(#dawn)" />
      <path d="M0 470 C 120 440, 220 455, 320 440 S 480 430, 560 445 V560 H0Z" fill="#0b1628" opacity="0.85" />
      <g transform="translate(280 230)" fill="none" stroke="#f6f2e8" strokeWidth="1.3" opacity="0.92">
        <path d="M0 -150 C -112 -150 -150 -70 -142 -5 C -132 70 -56 120 -30 160 L 30 160 C 56 120 132 70 142 -5 C 150 -70 112 -150 0 -150 Z" />
        {Array.from({ length: gores - 1 }, (_, i) => {
          const t = (i + 1) / gores;
          const x = -142 + 284 * t;
          const mid = x * 1.02;
          return <path key={i} d={`M0 -150 C ${mid * 0.55} -150 ${mid} -80 ${mid} -5 C ${mid * 0.9} 70 ${x * 0.3} 120 ${x * 0.2} 160`} opacity="0.55" />;
        })}
        <path d="M-142 -5 C -60 12 60 12 142 -5" opacity="0.5" />
        <path d="M-118 70 C -50 82 50 82 118 70" opacity="0.4" />
        <line x1="-30" y1="160" x2="-17" y2="196" opacity="0.7" />
        <line x1="30" y1="160" x2="17" y2="196" opacity="0.7" />
        <rect x="-17" y="196" width="34" height="26" rx="2" fill="#c05f2a" stroke="none" opacity="0.95" />
      </g>
    </svg>
  );
}
