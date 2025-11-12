import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import { RecommendationGrid } from "@/components/RecommendationGrid";
import { env } from "@/env";
import { encodeSlug } from "@/lib/slug";
import type { RecommendationPayload } from "@/lib/types";
import { getStrings } from "@/i18n/strings";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { buildRandomRecommendations } from "@/server/recommendations/pipeline";
import { TOP_SIMILAR_GUIDES } from "@/config/similar-guides";

type HubCategory = "movies" | "series" | "anime" | "books";

const CATEGORY_TYPE: Record<HubCategory, "movie" | "tv" | "anime" | "book"> = {
  movies: "movie",
  series: "tv",
  anime: "anime",
  books: "book",
};

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://recomeai.com";

export const HUB_PAGE_REVALIDATE = 60 * 60; // hourly refresh

const ACTION_TYPE: Record<RecommendationPayload["type"], "WatchAction" | "ReadAction"> = {
  movie: "WatchAction",
  tv: "WatchAction",
  anime: "WatchAction",
  book: "ReadAction",
};

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

export function createHubPage(category: HubCategory) {
  const generateMetadata = async ({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> => {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;
    if (!isLocale(locale)) {
      notFound();
    }
    const strings = getStrings(locale);
    const hub = strings.hubs[category];
    const path = `/${locale}/${hub.slug}`;
    const languages = Object.fromEntries(
      locales.map((loc) => [loc, `/${loc}/${getStrings(loc).hubs[category].slug}`]),
    );

    return {
      title: hub.metaTitle,
      description: hub.metaDescription,
      alternates: {
        canonical: path,
        languages,
      },
      openGraph: {
        title: hub.metaTitle,
        description: hub.metaDescription,
        url: `${siteUrl}${path}`,
        siteName: "Recomeai",
        locale,
        type: "website",
        images: [
          {
            url: `${siteUrl}/opengraph-image.png`,
            width: 1200,
            height: 630,
            alt: hub.metaTitle,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: hub.metaTitle,
        description: hub.metaDescription,
        images: [`${siteUrl}/opengraph-image.png`],
      },
    };
  };

  const Page = async ({ params }: { params: Promise<{ locale: string }> }) => {
    const resolvedParams = await params;
    const locale = resolvedParams.locale;
    if (!isLocale(locale)) {
      notFound();
    }

    const strings = getStrings(locale);
    const hub = strings.hubs[category];
    const guideMap = new Map<string, { title: string; anchor: string; description: string }>();
    hub.guides.forEach((guide) => {
      const slug = encodeSlug(guide.anchor);
      guideMap.set(slug, {
        title: guide.title,
        anchor: slug,
        description: guide.description,
      });
    });

    const topGuides = (TOP_SIMILAR_GUIDES[locale] ?? []).filter((guide) => guide.category === category);
    topGuides.forEach((guide) => {
      if (!guideMap.has(guide.slug)) {
        guideMap.set(guide.slug, {
          title: guide.title,
          anchor: guide.slug,
          description: guide.description,
        });
      }
    });
    const displayedGuides = Array.from(guideMap.values()).slice(0, 9);

    const [spotlightResult, discoveryResult] = await Promise.all([
      buildRandomRecommendations({
        locale,
        type: CATEGORY_TYPE[category],
        popMin: 60,
        limit: 12,
      }),
      buildRandomRecommendations({
        locale,
        type: CATEGORY_TYPE[category],
        popMin: 15,
        limit: 12,
      }),
    ]);

    const seen = new Set<string>();
    const spotlightItems: RecommendationPayload[] = [];
    for (const item of spotlightResult.items) {
      if (!seen.has(item.id)) {
        spotlightItems.push(item);
        seen.add(item.id);
      }
      if (spotlightItems.length >= 6) {
        break;
      }
    }

    const discoveryItems: RecommendationPayload[] = [];
    for (const item of discoveryResult.items) {
      if (!seen.has(item.id)) {
        discoveryItems.push(item);
        seen.add(item.id);
      }
      if (discoveryItems.length >= 6) {
        break;
      }
    }

    const combinedForSchema = [...spotlightItems, ...discoveryItems].slice(0, 12);
    const slugPath = `/${locale}/${hub.slug}`;

    const itemListElements = combinedForSchema.map((item, index) => {
      const defaultUrl = `${siteUrl}/${locale}/recommendations/similar-to/${encodeSlug(item.title)}`;
      const canonicalUrl = item.providerUrl ?? defaultUrl;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": schemaTypeFor(item.type),
          name: item.title,
          url: canonicalUrl,
          image: item.posterUrl ?? undefined,
          description: item.synopsis ?? undefined,
          potentialAction: {
            "@type": ACTION_TYPE[item.type],
            target: canonicalUrl,
          },
        },
      };
    });

    const itemListJsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: hub.heroTitle,
      url: `${siteUrl}${slugPath}#spotlight`,
      numberOfItems: itemListElements.length,
      itemListElement: itemListElements,
      inLanguage: locale,
    };

    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${siteUrl}${slugPath}#breadcrumb`,
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
          name: hub.breadcrumb,
          item: `${siteUrl}${slugPath}`,
        },
      ],
    };

    const collectionJsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: hub.metaTitle,
      description: hub.metaDescription,
      url: `${siteUrl}${slugPath}`,
      inLanguage: locale,
      breadcrumb: {
        "@id": `${siteUrl}${slugPath}#breadcrumb`,
      },
      mainEntity: itemListJsonLd,
    };

    return (
      <main
        id="main-content"
        className="mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-4 pb-24 pt-12 sm:px-6 lg:px-8"
      >
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
        />
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />

        <header className="space-y-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">{hub.breadcrumb}</span>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl">{hub.heroTitle}</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">{hub.heroSubtitle}</p>
          <p className="text-base text-slate-600 dark:text-slate-400">{hub.intro}</p>
        </header>

        <section id="spotlight" className="space-y-8">
          <RecommendationGrid
            items={spotlightItems}
            locale={locale as Locale}
            title={hub.sections[0]?.title}
            description={hub.sections[0]?.description}
          />
          {discoveryItems.length > 0 && (
            <RecommendationGrid
              items={discoveryItems}
              locale={locale as Locale}
              title={hub.sections[1]?.title}
              description={hub.sections[1]?.description}
            />
          )}
        </section>

        {displayedGuides.length > 0 && (
          <section className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{hub.guidesHeading}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{hub.guidesDescription}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {displayedGuides.map((guide) => (
                <article
                  key={guide.anchor}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{guide.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{guide.description}</p>
                  <Link
                    href={`/${locale}/recommendations/similar-to/${guide.anchor}`}
                    className="mt-3 inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                  >
                    {strings.common.buttons.viewSimilarGuide.replace("{{title}}", guide.title)}
                  </Link>
                </article>
              ))}
            </div>
          </section>
        )}

        {hub.faq.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{hub.faqHeading}</h2>
            <div className="space-y-3">
              {hub.faq.map((entry) => (
                <details
                  key={entry.question}
                  className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 dark:border-slate-800 dark:bg-slate-900"
                >
                  <summary className="cursor-pointer text-base font-semibold text-slate-900 outline-none transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 group-open:text-blue-700 dark:text-slate-100 dark:group-open:text-blue-200">
                    {entry.question}
                  </summary>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{entry.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </main>
    );
  };

  return {
    generateMetadata,
    Page,
  };
}
