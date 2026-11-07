import Link from "next/link";
import type { ReactNode } from "react";
import { formatUsd, pct } from "@/lib/engine/math";
import type { ValuationConfig } from "@/lib/engine/types";

export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Registry manufacturer name, for manufacturer pages. */
  manufacturer?: string;
  faq?: { q: string; a: string }[];
  body: (c: ValuationConfig) => ReactNode;
}

const Cta = ({ children = "Value my balloon" }: { children?: ReactNode }) => (
  <p>
    <Link href="/value">{children}</Link>
  </p>
);

function AgeTable({ c }: { c: ValuationConfig }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Envelope age</th>
          <th>Depreciation</th>
        </tr>
      </thead>
      <tbody>
        {c.envelopeAgeCurve.map((p) => (
          <tr key={p.age}>
            <td>{p.age === 0 ? "New" : `${p.age} year${p.age === 1 ? "" : "s"}`}</td>
            <td>{pct(p.depreciation)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EnvelopeTable({ c }: { c: ValuationConfig }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Envelope volume</th>
          <th>New reference price</th>
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
  );
}

function TankTable({ c }: { c: ValuationConfig }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Tank</th>
          <th>Used value each</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Aluminum, any size</td>
          <td>{formatUsd(c.tankPrices.aluminumCents)}</td>
        </tr>
        {(["10", "15", "20"] as const).map((k) => (
          <tr key={k}>
            <td>Steel, {k} gallons</td>
            <td>{formatUsd(c.tankPrices.steel[k])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const manufacturerBody = (intro: ReactNode) =>
  function ManufacturerBody(c: ValuationConfig): ReactNode {
    return (
    <>
      {intro}
      <h2>How Balloon Bluebook values these balloons</h2>
      <p>
        The calculation is the same as for any other make unless an administrator has set a manufacturer-specific rule. It starts from the price of a new equivalent envelope of the same volume, then
        applies flight hours, age, condition, fabric and appearance. Basket, burner, tanks and accessories are valued separately and added.
      </p>
      <p>
        If you have a current quote for a new envelope from the manufacturer or a dealer, enter it. It replaces the generic size-based reference ({formatUsd(c.envelopePrices[0].priceCents)} at{" "}
        {c.envelopePrices[0].volumeCuFt.toLocaleString("en-US")} cu ft up to {formatUsd(c.envelopePrices[c.envelopePrices.length - 1].priceCents)} at{" "}
        {c.envelopePrices[c.envelopePrices.length - 1].volumeCuFt.toLocaleString("en-US")} cu ft) and usually gives a tighter estimate.
      </p>
      <h2>What to have ready</h2>
      <ul>
        <li>Model and volume from the data plate or logbook</li>
        <li>Year of manufacture and total envelope hours</li>
        <li>Fabric type, and the share of each fabric if the envelope is mixed</li>
        <li>Basket and burner make, model and year, and whether the burner is Glow capable</li>
        <li>Tank material and capacity. Aluminum and steel tanks are priced very differently</li>
      </ul>
      <Cta />
    </>
    );
  };

export const GUIDES: Guide[] = [
  {
    slug: "hot-air-balloon-value-calculator",
    title: "Hot Air Balloon Value Calculator",
    description: "Free calculator for used hot air balloon values: envelope only, complete systems, or individual baskets, burners and tanks. Transparent, line-by-line results.",
    body: (c) => (
      <>
        <p>
          Balloon Bluebook estimates what a used hot air balloon is worth from the details that drive resale price: replacement cost, flight hours, age, condition, fabric, appearance and the
          equipment that comes with it. It takes about two minutes and needs no account.
        </p>
        <Cta>Start the calculator</Cta>
        <h2>What you get</h2>
        <ul>
          <li>An estimated fair market value and a reasonable selling range</li>
          <li>A recommended listing price, set {pct(c.listingMarkup)} above fair value to leave room to negotiate</li>
          <li>A value for each component: envelope, basket, burner, tanks and accessories</li>
          <li>A comparison with the seller&rsquo;s asking price, if you enter one</li>
          <li>A confidence level that drops when details are missing, with the missing items listed</li>
          <li>A PDF report with a reference number and the pricing version used</li>
        </ul>
        <h2>What you can value</h2>
        <p>
          A complete balloon system, an envelope on its own, a basket and burner system, or individual pieces of equipment. Each is handled separately, so a basket is never marked down for the age
          of an envelope it is not sold with.
        </p>
        <h2>What the calculator does not do</h2>
        <p>
          It does not inspect the balloon or decide whether it is airworthy. Hours and age are used as economic measures only. An annual inspection by a qualified inspector, under the regulations
          that apply where the balloon is registered, is the only way to establish airworthiness.
        </p>
      </>
    ),
  },
  {
    slug: "used-hot-air-balloon-prices",
    title: "Used Hot Air Balloon Prices",
    description: "How used hot air balloon prices are set: envelope replacement cost, hours, age, condition and equipment. Reference prices used by Balloon Bluebook.",
    body: (c) => (
      <>
        <p>
          Used balloon prices vary widely because a balloon is several assets sold together. The envelope usually carries most of the value and loses it fastest. Baskets, burners and tanks hold
          value longer and can be resold on their own.
        </p>
        <h2>Envelope reference prices</h2>
        <p>Balloon Bluebook starts from what an equivalent new envelope costs. These are the current reference prices; sizes in between are interpolated.</p>
        <EnvelopeTable c={c} />
        <p>
          Racers use a {formatUsd(c.racerEnvelopeCents)} reference and special shapes start at {formatUsd(c.specialShapeEnvelopeCents)}, since shapes vary too much for a size table. A real quote for
          your envelope always takes priority.
        </p>
        <h2>Fuel tanks</h2>
        <p>Tanks are valued at used-market prices and are not depreciated further.</p>
        <TankTable c={c} />
        <h2>Burners</h2>
        <p>
          Burners with a known used-market price are valued at that price, for example the Cameron Super Doubles and the non-Glow Aerostar Zone V Double. Other burners use a generic estimate based
          on age and condition, and the report says so.
        </p>
        <h2>Asking prices are not selling prices</h2>
        <p>
          Listings show what sellers hope to get. They are a poor guide to what balloons actually sell for, which is why Balloon Bluebook never treats an asking price as a sale. If you are looking at
          a listing, enter the asking price to see how it compares with the estimated fair value.
        </p>
        <Cta />
      </>
    ),
  },
  {
    slug: "how-much-is-a-used-hot-air-balloon-worth",
    title: "How Much Is a Used Hot Air Balloon Worth?",
    description: "What a used hot air balloon is worth depends on envelope hours, age, condition and equipment. Here is how to estimate it, step by step.",
    faq: [
      {
        q: "What affects a used hot air balloon's value the most?",
        a: "Envelope hours and envelope age. The envelope is usually the most valuable part of a system and loses value with every flight hour and every year, with depreciation steepening after 20 years.",
      },
      {
        q: "Does a recent annual inspection make a balloon worth more?",
        a: "An inspection confirms the balloon met the standard on that day. It does not by itself make an envelope excellent. Condition is judged separately from the inspection date.",
      },
      {
        q: "Are old balloons worth anything?",
        a: "Under Balloon Bluebook's standard policy, complete systems 31 to 35 years old are capped below $5,000, and systems over 35 years old have no recommended resale value. Baskets, burners and tanks can still be worth money on their own, and the report shows that separately.",
      },
      {
        q: "Is an online valuation the same as an appraisal?",
        a: "No. It is an estimate from consistent pricing rules and the details you enter. It is not a certified appraisal, an inspection, or an airworthiness determination.",
      },
    ],
    body: (c) => (
      <>
        <p>
          A used hot air balloon is worth what an informed buyer will pay for its envelope, plus what its hardware is worth. The envelope is the expensive part to replace and the part that wears out,
          so most of the work is estimating how much envelope life is left.
        </p>
        <h2>Step 1: Price a new envelope</h2>
        <p>
          Find what an equivalent new envelope costs today. A dealer quote is best. Without one, Balloon Bluebook uses reference prices by volume, from {formatUsd(c.envelopePrices[0].priceCents)} for{" "}
          {c.envelopePrices[0].volumeCuFt.toLocaleString("en-US")} cu ft.
        </p>
        <h2>Step 2: Account for hours</h2>
        <p>
          Envelopes are given an economic reference life of {c.referenceHours.sport} hours for sport and commercial balloons, {c.referenceHours.racer} for racers and {c.referenceHours.special_shape} for
          special shapes. An envelope with 150 of {c.referenceHours.sport} hours has used a quarter of that life. These are valuation assumptions, not manufacturer limits.
        </p>
        <h2>Step 3: Account for age</h2>
        <p>
          Fabric ages whether or not it flies. Balloon Bluebook takes about 2% a year off for the first 20 years, then 5% a year, reaching {pct(c.envelopeAgeCurve[c.envelopeAgeCurve.length - 1].depreciation)} at{" "}
          {c.envelopeAgeCurve[c.envelopeAgeCurve.length - 1].age} years. See <Link href="/hot-air-balloon-depreciation-explained">depreciation explained</Link>.
        </p>
        <h2>Step 4: Adjust for condition, fabric and appearance</h2>
        <p>
          Condition ranges from A (excellent, ×{c.conditionMultipliers.A}) to E (poor, ×{c.conditionMultipliers.E}). Nylon envelopes take {pct(1 - c.fabricMultipliers.nylon)} off; polyester and Hyperlast
          take nothing off. Color schemes that are hard to resell, or heavy commercial branding, take up to {pct(c.appearanceDeductions.maxCombined)} off, and the two do not stack.
        </p>
        <h2>Step 5: Add the hardware</h2>
        <p>
          Value the basket and burner on their own age and condition, and add tanks and accessories at used-market prices. Do not depreciate a used price twice: if you already know what a burner sells
          for used, that is its value.
        </p>
        <h2>Step 6: Check the policies</h2>
        <p>
          Very old systems and some legacy brands sell for little regardless of the arithmetic. Balloon Bluebook caps complete systems aged {c.agePolicy.capStartAge} to {c.agePolicy.capEndAge} years at{" "}
          {formatUsd(c.agePolicy.capMaxCents)} and recommends gifting systems over {c.agePolicy.legacyAfterAge} years old. These are commercial resale policies, not statements about airworthiness.
        </p>
        <Cta>Run these steps automatically</Cta>
      </>
    ),
  },
  {
    slug: "hot-air-balloon-depreciation-explained",
    title: "Hot Air Balloon Depreciation Explained",
    description: "How hot air balloon envelopes, baskets and burners depreciate with hours and age, and why depreciation accelerates after 20 years.",
    body: (c) => (
      <>
        <p>
          Balloon Bluebook depreciates an envelope two ways at once: by the share of its economic hour life used, and by its age in years. The two are multiplied, because an old envelope with few
          hours and a young envelope with many hours both have less life left than a new one.
        </p>
        <h2>Hours</h2>
        <p>
          Remaining value from hours is one minus hours used divided by the reference hours, never below zero. A sport envelope with 300 of {c.referenceHours.sport} reference hours keeps{" "}
          {pct(Math.max(0, 1 - 300 / c.referenceHours.sport))} of its value on this measure before age and condition.
        </p>
        <h2>Age</h2>
        <p>Age depreciation is gradual for 20 years, then steepens. Ages between rows are interpolated.</p>
        <AgeTable c={c} />
        <p>
          This curve is an expert calibration, not a statistical market index. It is reviewed against verified completed sales as they are collected, and every change is saved as a new pricing
          version so older reports can be reproduced.
        </p>
        <h2>Baskets and burners</h2>
        <p>Baskets, and burners without a known used price, follow a simpler age schedule based on their own year, not the envelope&rsquo;s:</p>
        <table>
          <thead>
            <tr>
              <th>Age</th>
              <th>Remaining value</th>
            </tr>
          </thead>
          <tbody>
            {c.hardwareAgeBands.map((b, i) => {
              const next = c.hardwareAgeBands[i + 1];
              return (
                <tr key={b.minAge}>
                  <td>{next ? `${b.minAge} to ${next.minAge - 1} years` : `${b.minAge}+ years`}</td>
                  <td>{pct(b.remaining)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <h2>Depreciation is not airworthiness</h2>
        <p>
          An envelope at the end of its economic reference life may still pass inspection, and a young one may not. Age and hours here measure resale value only. Airworthiness is decided by
          inspection under the applicable regulations.
        </p>
        <Cta />
      </>
    ),
  },
  {
    slug: "cameron-balloon-values",
    title: "Cameron Balloon Values",
    manufacturer: "Cameron",
    description: "Estimate the value of a used Cameron hot air balloon: O, Z, V, N, C and A series envelopes, baskets and burners.",
    body: manufacturerBody(
      <p>
        Cameron Balloons was founded in Bristol, England, in 1971 and has built more balloons than almost any other maker, so Cameron envelopes are common in the used market. Model names combine a series
        letter with the volume in thousands of cubic feet: an O-90 is about 90,000 cu ft, an A-210 about 210,000.
      </p>,
    ),
  },
  {
    slug: "aerostar-balloon-values",
    title: "Aerostar Balloon Values",
    manufacturer: "Aerostar",
    description: "Estimate the value of a used Aerostar hot air balloon, including RX and S-series envelopes and Zone V burners.",
    body: manufacturerBody(
      <p>
        The Aerostar line grew out of Raven Industries in Sioux Falls, South Dakota, where the modern hot air balloon was developed around 1960. Aerostar is valued with the standard method. Raven-branded
        systems follow a separate legacy policy, so choose the name on the data plate.
      </p>,
    ),
  },
  {
    slug: "lindstrand-balloon-values",
    title: "Lindstrand Balloon Values",
    manufacturer: "Lindstrand",
    description: "Estimate the value of a used Lindstrand hot air balloon by model, volume, hours, age and equipment.",
    body: manufacturerBody(
      <p>
        Lindstrand balloons are associated with the Swedish engineer Per Lindstrand and were built in England, with envelopes also produced in the United States. Model names usually give the volume in
        thousands of cubic feet followed by a series letter, such as 90A or 77X.
      </p>,
    ),
  },
  {
    slug: "ultramagic-balloon-values",
    title: "Ultramagic Balloon Values",
    manufacturer: "Ultramagic",
    description: "Estimate the value of a used Ultramagic hot air balloon: M, N and S series envelopes, baskets and burners.",
    body: manufacturerBody(
      <p>
        Ultramagic builds balloons in Igualada, near Barcelona, Spain. Its M series covers sport sizes, the N series large commercial envelopes and the S series competition designs. The number in the
        model name is the volume in thousands of cubic feet.
      </p>,
    ),
  },
  {
    slug: "kubicek-balloon-values",
    title: "Kubicek Balloon Values",
    manufacturer: "Kubicek",
    description: "Estimate the value of a used Kubicek hot air balloon by BB model, volume, hours, age, fabric and equipment.",
    body: manufacturerBody(
      <p>
        Kubicek Balloons builds balloons in Brno, Czech Republic. Its BB model numbers give the volume in hundreds of cubic meters, so a BB26 is about 2,600 cubic meters, roughly 90,000 cu ft. Enter
        the volume in cubic feet when you value one.
      </p>,
    ),
  },
];

export const GUIDE_BY_SLUG = Object.fromEntries(GUIDES.map((g) => [g.slug, g]));
