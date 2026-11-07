import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { siteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/value`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/how-it-works`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/guides`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...GUIDES.map((g) => ({ url: `${siteUrl}/${g.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
