import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Panel } from "@/components/ui";
import { GUIDE_BY_SLUG, GUIDES } from "@/content/guides";
import { modelsFor } from "@/lib/catalog";
import { getActiveConfigSafe } from "@/lib/data";
import { siteUrl } from "@/lib/env";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDE_BY_SLUG[slug];
  if (!g) return {};
  return { title: g.title, description: g.description, alternates: { canonical: `/${g.slug}` }, openGraph: { title: g.title, description: g.description, url: `/${g.slug}` } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = GUIDE_BY_SLUG[slug];
  if (!g) notFound();
  const config = (await getActiveConfigSafe()).snapshot;
  const models = g.manufacturer ? modelsFor(g.manufacturer).slice(0, 12) : [];

  const ld: object[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: g.title,
      description: g.description,
      mainEntityOfPage: `${siteUrl}/${g.slug}`,
      publisher: { "@type": "Organization", name: "Balloon Bluebook" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
        { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
        { "@type": "ListItem", position: 3, name: g.title, item: `${siteUrl}/${g.slug}` },
      ],
    },
  ];
  if (g.faq) {
    ld.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1fr_300px]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <article>
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/guides" className="hover:text-ink">
            Guides
          </Link>
        </nav>
        <h1 className="mt-2 text-4xl sm:text-5xl">{g.title}</h1>
        <div className="prose-bb mt-6 text-[1.05rem] leading-relaxed">{g.body(config)}</div>

        {models.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl">Common {g.manufacturer} models</h2>
            <p className="mt-2 max-w-2xl text-muted">The most frequently registered {g.manufacturer} models in the Balloon History Archive registry, with their usual volume. Use these as a guide; your data plate is authoritative.</p>
            <Panel className="mt-4 overflow-x-auto">
              <table className="w-full text-[0.95rem]">
                <thead>
                  <tr className="border-b border-line text-left text-sm text-muted">
                    <th className="px-4 py-2.5 font-normal">Model</th>
                    <th className="px-4 py-2.5 text-right font-normal">Typical volume</th>
                    <th className="px-4 py-2.5 text-right font-normal">Years built</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.model} className="border-b border-line-soft last:border-0">
                      <td className="px-4 py-2">{m.model}</td>
                      <td className="tabular px-4 py-2 text-right">{m.volumeCuFt ? `${m.volumeCuFt.toLocaleString("en-US")} cu ft` : ""}</td>
                      <td className="tabular px-4 py-2 text-right">{m.yearMin && m.yearMax ? (m.yearMin === m.yearMax ? m.yearMin : `${m.yearMin} to ${m.yearMax}`) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </section>
        )}

        {g.faq && (
          <section className="mt-12">
            <h2 className="text-2xl">Questions</h2>
            <dl className="mt-4 divide-y divide-line">
              {g.faq.map((f) => (
                <div key={f.q} className="py-4">
                  <dt className="font-medium">{f.q}</dt>
                  <dd className="mt-1.5 max-w-[68ch] text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Panel className="p-6">
          <p className="font-serif text-xl">What is your balloon worth?</p>
          <p className="mt-2 text-sm text-muted">Free, about two minutes, no account needed.</p>
          <ButtonLink href="/value" variant="flame" className="mt-5 w-full">
            Value my balloon
          </ButtonLink>
        </Panel>
        <nav aria-label="More guides" className="mt-6">
          <p className="text-sm font-medium">More guides</p>
          <ul className="mt-2 space-y-1.5 text-[0.93rem]">
            {GUIDES.filter((x) => x.slug !== g.slug).map((x) => (
              <li key={x.slug}>
                <Link href={`/${x.slug}`} className="text-muted hover:text-ink">
                  {x.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
