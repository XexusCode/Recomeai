import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecommendationCard } from "@/components/RecommendationCard";
import { env } from "@/env";
import { normalizeProviderLabel } from "@/lib/availability";
import { decodeSlug, encodeSlug } from "@/lib/slug";
import type { RecommendationPayload } from "@/lib/types";
import { buildRecommendations } from "@/server/recommendations/pipeline";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { format, getStrings, getTypeLabel } from "@/i18n/strings";
import { TOP_SIMILAR_GUIDES } from "@/config/similar-guides";

interface SimilarPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  const params: Array<{ locale: string; slug: string }> = [];
  for (const locale of locales) {
    const strings = getStrings(locale);
    const slugs = new Set<string>();

    const hubs = Object.values(strings.hubs ?? {});
    hubs.forEach((hub) => {
      hub.guides?.forEach((guide) => {
        const slug = encodeSlug(guide.anchor);
        slugs.add(slug);
      });
    });
    const topGuides = TOP_SIMILAR_GUIDES[locale] ?? [];
    topGuides.forEach((guide) => {
      slugs.add(guide.slug);
    });

    slugs.forEach((slug) => {
      params.push({ locale, slug });
    });
  }
  return params;
}

interface SimilarData {
  anchor: RecommendationPayload;
  items: RecommendationPayload[];
  query: string;
  slug: string;
}

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://recomeai.com";

export const revalidate = 86400;

const getSimilarData = cache(async (locale: Locale, slug: string): Promise<SimilarData> => {
  const query = decodeSlug(slug);
  if (!query) {
    notFound();
  }

  const result = await buildRecommendations({ query, limit: 10, locale });
  if (!result.anchor || !result.items.length) {
    notFound();
  }

  return {
    anchor: result.anchor,
    items: result.items,
    query,
    slug,
  };
});

export async function generateMetadata({ params }: SimilarPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const { locale, slug } = resolvedParams;
  if (!isLocale(locale)) {
    notFound();
  }

  const strings = getStrings(locale);
  const { anchor, items, query } = await getSimilarData(locale, slug);
  const typePlural = getTypeLabel(locale, anchor.type, { plural: true });
  const highlighted = items
    .slice(0, 3)
    .map((item) => item.title)
    .join(", ");

  const metadataTitle = format(strings.similar.metadataTitle, {
    typePlural,
    title: anchor.title,
    year: anchor.year ? ` (${anchor.year})` : "",
  });
  const description = format(strings.similar.metadataDescription, {
    count: items.length,
    typePlural,
    title: anchor.title,
    highlights: highlighted,
  });

  const path = `/${locale}/recommendations/similar-to/${slug}`;
  const canonicalUrl = `${siteUrl}${path}`;

  const languages = Object.fromEntries(locales.map((loc) => [loc, `${siteUrl}/${loc}/recommendations/similar-to/${slug}`]));

  return {
    title: metadataTitle,
    description,
    alternates: {
      canonical: path,
      languages,
    },
    openGraph: {
      title: metadataTitle,
      description,
      url: canonicalUrl,
      siteName: "Recomeai",
      type: "article",
      locale,
      alternateLocale: locales.filter((loc) => loc !== locale),
      images: anchor.posterUrl
        ? [{ url: anchor.posterUrl, width: 800, height: 1200, alt: anchor.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: metadataTitle,
      description,
      images: anchor.posterUrl ? [anchor.posterUrl] : undefined,
    },
  };
}

export default async function SimilarPage({ params }: SimilarPageProps) {
  const resolvedParams = await params;
  const { locale, slug } = resolvedParams;
  if (!isLocale(locale)) {
    notFound();
  }

  const { anchor, items, query } = await getSimilarData(locale, slug);
  const strings = getStrings(locale);

  const heroGenres = anchor.genres.slice(0, 3).join(", ");
  const typePlural = getTypeLabel(locale, anchor.type, { plural: true });
  const headline = format(strings.similar.headline, {
    count: items.length,
    typePlural,
    title: anchor.title,
  });
  const intro = format(strings.similar.intro, {
    title: anchor.title,
    genres: heroGenres || typePlural.toLowerCase(),
  });
  const reasonsList = items.map((item, index) => ({
    title: item.title,
    position: index + 1,
    reason: item.reason ?? summarizeSynopsis(strings, item.synopsis),
  }));
  const quickAnswers = strings.similar.quickAnswers.map((entry) => ({
    question: format(entry.question, { title: anchor.title }),
    answer: format(entry.answer, { title: anchor.title }),
  }));

  const genreCollector = new Map<string, string>();
  for (const item of items) {
    (item.genres ?? []).forEach((genre) => {
      const trimmed = genre?.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!genreCollector.has(key)) {
        genreCollector.set(key, trimmed);
      }
    });
  }
  const uniqueGenres = Array.from(genreCollector.values());
  const genreSample = uniqueGenres.slice(0, 3).join(", ") || typePlural.toLowerCase();
  const topGenres = uniqueGenres.slice(0, 5).join(", ") || typePlural.toLowerCase();

  const collectedYears = items
    .map((item) => item.year)
    .filter((year): year is number => typeof year === "number");
  if (typeof anchor.year === "number") {
    collectedYears.push(anchor.year);
  }
  let yearRangeText = strings.similar.editorialYearFallback;
  if (collectedYears.length > 0) {
    const minYear = Math.min(...collectedYears);
    const maxYear = Math.max(...collectedYears);
    yearRangeText = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`;
  }

  const providerCollector = new Map<string, string>();
  for (const item of items) {
    (item.availability ?? []).forEach((link) => {
      const normalized = normalizeProviderLabel(link.label);
      const key = normalized.toLowerCase();
      if (!providerCollector.has(key)) {
        providerCollector.set(key, normalized);
      }
    });
  }
  const providers = Array.from(providerCollector.values());
  const providerSample = providers.slice(0, 3).join(", ") || strings.similar.editorialProviderFallback;

  const editorialCopy: string[] = [];
  editorialCopy.push(
    format(strings.similar.editorialOverview, {
      typePlural,
      title: anchor.title,
      genreSample,
      yearRange: yearRangeText,
    }),
  );
  if (providers.length > 0) {
    editorialCopy.push(format(strings.similar.editorialProviders, { providerSample }));
  }
  if (uniqueGenres.length > 0) {
    editorialCopy.push(format(strings.similar.editorialGenres, { topGenres }));
  }

  const structuredData = buildStructuredData({
    anchor,
    items,
    slug,
    query,
    locale,
    strings,
    typePlural,
    faqEntries: quickAnswers,
  });

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-4 pb-24 pt-12 sm:px-6 lg:px-8"
    >
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData.collection) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData.breadcrumb) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData.itemList) }}
      />
      {structuredData.faq && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData.faq) }}
        />
      )}

      <section className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10 lg:grid-cols-[280px_1fr] lg:gap-12 dark:border-slate-800 dark:bg-slate-900">
        <figure className="relative mx-auto h-80 w-56 overflow-hidden rounded-2xl bg-slate-100 shadow-lg dark:bg-slate-800">
          {anchor.posterUrl ? (
            <Image src={anchor.posterUrl} alt={anchor.title} fill className="object-cover" sizes="224px" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">No poster available</div>
          )}
        </figure>
        <article className="space-y-4 text-slate-700 dark:text-slate-200">
          <div className="space-y-2">
            <Link
              href={`/${locale}`}
              className="inline-flex items-center text-xs font-semibold uppercase tracking-wide text-blue-600 hover:underline dark:text-blue-300"
            >
              {strings.similar.navBack}
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-4xl">{headline}</h1>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {anchor.year ?? "Year N/A"} • {getTypeLabel(locale, anchor.type)} • {heroGenres || typePlural}
            </p>
          </div>
          <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-300">{intro}</p>
          {anchor.synopsis && (
            <p className="text-base leading-relaxed text-slate-600 dark:text-slate-400">
              <strong className="text-slate-900 dark:text-slate-100">
                {format(strings.similar.aboutAnchor, { title: anchor.title })}
              </strong>{" "}
              {anchor.synopsis}
            </p>
          )}
        </article>
      </section>

      {editorialCopy.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{strings.similar.editorialHeading}</h2>
          <div className="space-y-3 text-base leading-relaxed text-slate-700 dark:text-slate-300">
            {editorialCopy.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{strings.similar.curatedHeading}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{strings.similar.curatedSubheading}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <RecommendationCard key={`${item.id}-${index}`} item={item} locale={locale} />
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{strings.similar.reasonsHeading}</h2>
        <ol className="space-y-4 text-slate-700 dark:text-slate-300">
          {reasonsList.map((entry) => (
            <li key={entry.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {entry.position}. {entry.title}
              </h3>
              <p>{entry.reason}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{strings.similar.quickAnswersHeading}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {quickAnswers.map((entry) => (
            <FAQItem key={entry.question} question={entry.question}>
              {entry.answer}
            </FAQItem>
          ))}
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg sm:p-10 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{strings.similar.moreHeading}</h2>
      </section>
    </main>
  );
}

function summarizeSynopsis(strings: ReturnType<typeof getStrings>, synopsis?: string | null): string {
  if (!synopsis) {
    return strings.similar.synopsisFallback;
  }
  if (synopsis.length <= 220) {
    return synopsis;
  }
  return `${synopsis.slice(0, 217)}…`;
}

const ACTION_TYPE: Record<RecommendationPayload["type"], "WatchAction" | "ReadAction"> = {
  movie: "WatchAction",
  tv: "WatchAction",
  anime: "WatchAction",
  book: "ReadAction",
};

function buildStructuredData({
  anchor,
  items,
  slug,
  query: _query,
  locale,
  strings,
  typePlural,
  faqEntries,
}: {
  anchor: RecommendationPayload;
  items: RecommendationPayload[];
  slug: string;
  query: string;
  locale: Locale;
  strings: ReturnType<typeof getStrings>;
  typePlural: string;
  faqEntries: Array<{ question: string; answer: string }>;
}) {
  const path = `/${locale}/recommendations/similar-to/${slug}`;
  const itemListElements = items.map((item, index) => {
    const defaultUrl = `${siteUrl}${path}#rec-${index + 1}`;
    const canonicalUrl = item.providerUrl ?? defaultUrl;
    return {
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": schemaTypeFor(item.type),
        name: item.title,
        url: canonicalUrl,
        image: item.posterUrl ?? undefined,
        description: item.reason ?? item.synopsis ?? undefined,
        potentialAction: {
          "@type": ACTION_TYPE[item.type],
          target: canonicalUrl,
        },
      },
    };
  });

  const name = format(strings.similar.metadataTitle, {
    typePlural,
    title: anchor.title,
    year: anchor.year ? ` (${anchor.year})` : "",
  });

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${siteUrl}${path}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: strings.common.appName,
        item: `${siteUrl}/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name,
        item: `${siteUrl}${path}`,
      },
    ],
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}${path}#item-list`,
    name,
    description: format(strings.similar.structuredDescription, {
      typePlural,
      title: anchor.title,
    }),
    numberOfItems: items.length,
    itemListOrder: "http://schema.org/ItemListOrderAscending",
    itemListElement: itemListElements,
    inLanguage: locale,
  };

  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description: format(strings.similar.structuredDescription, {
      typePlural,
      title: anchor.title,
    }),
    url: `${siteUrl}${path}`,
    inLanguage: locale,
    mainEntity: {
      "@id": `${siteUrl}${path}#item-list`,
    },
    breadcrumb: {
      "@id": `${siteUrl}${path}#breadcrumb`,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/${locale}?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const faq = faqEntries.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqEntries.map((entry) => ({
          "@type": "Question",
          name: entry.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: entry.answer,
          },
        })),
      }
    : null;

  return { itemList, breadcrumb, collection, faq };
}

function schemaTypeFor(type: RecommendationPayload["type"]): string {
  switch (type) {
    case "movie":
      return "Movie";
    case "tv":
    case "anime":
      return "TVSeries";
    case "book":
      return "Book";
    default:
      return "CreativeWork";
  }
}

function FAQItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{question}</h3>
      <p className="mt-2">{children}</p>
    </div>
  );
}


