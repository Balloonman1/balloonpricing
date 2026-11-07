import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { CATALOG } from "@/lib/catalog";
import { getActiveConfigSafe } from "@/lib/data";
import { formatUsd, pct } from "@/lib/engine/math";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "How it works",
  description: "The Balloon Bluebook valuation method: replacement cost, hours, age, condition, fabric, appearance, hardware, policies, confidence and listing price.",
  alternates: { canonical: "/how-it-works" },
};

export default async function HowItWorks() {
  const active = await getActiveConfigSafe();
  const c = active.snapshot;
  const firefly = c.brandPolicies.find((p) => p.manufacturer === "Firefly" && p.active);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-4xl sm:text-5xl">How it works</h1>
      <p className="mt-4 text-[1.1rem] text-muted">
        Every valuation follows the same steps in the same order, using deterministic rules. No software guesses prices, and no comparable sales are invented. The figures below are the current pricing
        rules (version {active.version}).
      </p>

      <div className="prose-bb mt-6 text-[1.04rem] leading-relaxed">
        <h2>1. Replacement cost</h2>
        <p>
          The starting point is what an equivalent new envelope costs today. A quote you provide always takes priority. Otherwise sport and commercial envelopes use reference prices by volume,
          interpolated between sizes:
        </p>
        <table>
          <thead>
            <tr>
              <th>Volume</th>
              <th>New reference</th>
            </tr>
          </thead>
          <tbody>
            {c.envelopePrices.map((p) => (
              <tr key={p.volumeCuFt}>
                <td>{p.volumeCuFt.toLocaleString("en-US")} cu ft</td>
                <td>{formatUsd(p.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Racers use {formatUsd(c.racerEnvelopeCents)} and special shapes start at {formatUsd(c.specialShapeEnvelopeCents)}. Volumes outside the table are extrapolated, labeled on the report, and lower
          the confidence level.
        </p>

        <h2>2. Flight hours</h2>
        <p>
          Hours use up a share of an economic reference life: {c.referenceHours.sport} hours for sport, {c.referenceHours.commercial} for commercial, {c.referenceHours.racer} for racers and{" "}
          {c.referenceHours.special_shape} for special shapes. The remaining share is applied to the replacement cost and never goes below zero. These are valuation assumptions, not
          manufacturer-approved service lives.
        </p>

        <h2>3. Age</h2>
        <p>
          Depreciation is based on the current calendar year, so a valuation done next year reflects an extra year of age. It runs at about 2% a year to 20 years, then 5% a year to{" "}
          {pct(c.envelopeAgeCurve[c.envelopeAgeCurve.length - 1].depreciation)} at {c.envelopeAgeCurve[c.envelopeAgeCurve.length - 1].age} years. See{" "}
          <Link href="/hot-air-balloon-depreciation-explained">the full table</Link>.
        </p>

        <h2>4. Condition, fabric and appearance</h2>
        <ul>
          <li>
            Condition multipliers: A ×{c.conditionMultipliers.A}, B ×{c.conditionMultipliers.B}, C ×{c.conditionMultipliers.C}, D ×{c.conditionMultipliers.D}, E ×{c.conditionMultipliers.E}. Each component
            has its own condition. Unknown condition uses C and is disclosed.
          </li>
          <li>
            Fabric: nylon ×{c.fabricMultipliers.nylon}; polyester and Hyperlast ×1.00. Mixed fabric is weighted only when the full breakdown is known.
          </li>
          <li>
            Appearance: unattractive or non-warm colors, or heavy commercial branding, take {pct(c.appearanceDeductions.unattractive)} off the envelope. Both together still take a single{" "}
            {pct(c.appearanceDeductions.maxCombined)}.
          </li>
          <li>Envelope features such as a parachute top or turning vents are recorded. They change the value only where a price has been configured.</li>
        </ul>

        <h2>5. Hardware</h2>
        <p>
          Baskets start from a {formatUsd(c.basketNewCents)} new-equivalent reference, a provisional allocation of a typical basket-and-burner price, and follow their own age schedule from their own year.
          Burners with a known used price use it directly; others use a generic estimate. Tanks are {formatUsd(c.tankPrices.aluminumCents)} each for aluminum and {formatUsd(c.tankPrices.steel["10"])},{" "}
          {formatUsd(c.tankPrices.steel["15"])} or {formatUsd(c.tankPrices.steel["20"])} for 10, 15 or 20 gallon steel. Accessories are added only when you select them. A known used value is never
          depreciated a second time.
        </p>

        <h2>6. Resale policies</h2>
        <p>
          Complete systems with envelopes {c.agePolicy.capStartAge} to {c.agePolicy.capEndAge} years old are capped at {formatUsd(c.agePolicy.capMaxCents)}. Systems over {c.agePolicy.legacyAfterAge} years
          old have no recommended resale value, and the report suggests gifting or donating them.
          {firefly?.maxValueCents ? ` Firefly systems are capped at ${formatUsd(firefly.maxValueCents)}.` : ""} Raven systems carry a $0 standard resale recommendation. Hardware that can be reused is
          still shown separately.
        </p>
        <p>
          These are commercial valuation preferences. They do not mean a balloon is unsafe or unairworthy, and nothing in a Balloon Bluebook report is a regulatory finding.
        </p>

        <h2>7. Fair value, range and listing price</h2>
        <p>
          The fair market value is the amount an informed buyer and seller might agree on in normal conditions. The listing price adds {pct(c.listingMarkup)} to leave room to negotiate, and never exceeds
          a policy maximum. The selling range depends on confidence:
        </p>
        <ul>
          <li>High (±{pct(c.confidenceRanges.high)}): complete details supported by at least {c.minVerifiedComparablesForHigh} verified completed sales of similar balloons.</li>
          <li>Moderate (±{pct(c.confidenceRanges.moderate)}): complete details valued with expert rules.</li>
          <li>Low (±{pct(c.confidenceRanges.low)}): essential details missing, unknown equipment, or prices outside the reference range.</li>
        </ul>
        <p>These ranges express modeling uncertainty. They are not statistical confidence intervals, and Balloon Bluebook does not claim a measured accuracy percentage.</p>

        <h2>8. Asking price comparison</h2>
        <p>
          When you enter a seller&rsquo;s asking price it is compared with the fair value: more than 15% below is a potential bargain, within 15% is within tolerance, 15% to 30% above is overpriced, and 30%
          or more above is significantly overpriced. An asking price above the estimate can reflect details this tool does not capture.
        </p>

        <h2>Improving with real sales</h2>
        <p>
          Verified completed sales are recorded separately from asking prices and reported sales. Each one is compared with what the model would have predicted. Adjustments are suggested only when
          several sales agree, and nothing changes until an administrator approves it as a new pricing version.
        </p>

        <h2>Data sources</h2>
        <p>
          Model names and typical volumes come from the Balloon History Archive registry ({CATALOG.recordCount.toLocaleString("en-US")} balloons), sourced from The HAB Database. They help fill in the form
          and carry no prices. Newer models can always be typed in.
        </p>
      </div>
      <ButtonLink href="/value" variant="flame" size="lg" className="mt-10">
        Value my balloon
      </ButtonLink>
    </div>
  );
}
