import type { MetadataRoute } from "next";

import { env } from "@/env";
import { encodeSlug } from "@/lib/slug";
import { getStrings } from "@/i18n/strings";
import { locales } from "@/i18n/config";
import { TOP_SIMILAR_GUIDES } from "@/config/similar-guides";

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://recomeai.com";

const HUB_CATEGORIES: Array<"movies" | "series" | "anime" | "books"> = ["movies", "series", "anime", "books"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  for (const locale of locales) {
    const strings = getStrings(locale);
    const localeBase = `${siteUrl}/${locale}`;
    entries.push({
      url: localeBase,
      lastModified: now,
      changeFrequency: "weekly",
      priority: locale === locales[0] ? 0.9 : 0.8,
    });

    const hubGuides = new Set<string>();
    for (const category of HUB_CATEGORIES) {
      const slug = strings.hubs[category].slug;
      entries.push({
        url: `${localeBase}/${slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.7,
      });
      strings.hubs[category].guides.forEach((guide) => {
        hubGuides.add(encodeSlug(guide.anchor));
      });
    }
    (TOP_SIMILAR_GUIDES[locale] ?? []).forEach((guide) => hubGuides.add(guide.slug));

    hubGuides.forEach((slug) => {
      entries.push({
        url: `${localeBase}/recommendations/similar-to/${slug}`,
        lastModified: now,
        changeFrequency: "daily",
        priority: 0.65,
      });
    });
  }

  return entries;
}


