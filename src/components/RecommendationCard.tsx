"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

import { AvailabilityLogo } from "@/components/AvailabilityLogo";
import { SafeImage } from "@/components/SafeImage";
import { normalizeProviderLabel } from "@/lib/availability";
import type { AvailabilityLink, RecommendationPayload } from "@/lib/types";
import { format, getStrings, getTypeLabel } from "@/i18n/strings";
import type { Locale } from "@/i18n/config";
import type { MutableRefObject } from "react";

const ACTION_TYPE: Record<RecommendationPayload["type"], "WatchAction" | "ReadAction"> = {
  movie: "WatchAction",
  tv: "WatchAction",
  anime: "WatchAction",
  book: "ReadAction",
};

interface RecommendationCardProps {
  item?: RecommendationPayload;
  placeholder?: boolean;
  locale: Locale;
}

export function RecommendationCard({ item, placeholder = false, locale }: RecommendationCardProps) {
  if (placeholder || !item) {
    return (
      <div
        data-testid="recommendation-card-placeholder"
        className="flex h-full flex-col rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-400 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-600"
      >
        <span className="mb-2 inline-flex h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="mb-4 h-40 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mb-6 h-4 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const strings = getStrings(locale);
  const actionLabels = strings.common.card.actions;
  const availabilityHeading = strings.common.card.availabilityHeading;
  const availabilityEmpty = strings.common.card.availabilityEmpty;
  const typeBadge = getTypeLabel(locale, item.type);
  const yearLabel = item.year ?? strings.common.labels.yearUnknown;
  const sourceMeta = resolveSourceMeta(item.source);
  const bulletPoints = buildBulletPoints(item, strings.common.card.bullets, typeBadge);
  const synopsis = item.synopsis ? truncateText(item.synopsis, 220) : null;
  const primaryActionRef = useRef<HTMLAnchorElement | null>(null);
  const matchScore = Math.min(
    100,
    Math.max(
      1,
      item.score ? Math.round(item.score * 100) : Math.round(Math.min(100, Math.max(0, item.popularity ?? 0))),
    ),
  );
  const structuredData = useMemo(() => {
    const schemaType = schemaTypeFor(item.type);
    const base: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": schemaType,
      name: item.title,
      inLanguage: locale,
    };

    if (synopsis || item.reason) {
      base.description = synopsis ?? item.reason ?? undefined;
    }
    if (item.posterUrl) {
      base.image = item.posterUrl;
    }
    if (item.genres?.length) {
      base.genre = item.genres.slice(0, 5);
    }
    if (item.year) {
      base.datePublished = `${item.year}`;
    }
    if (item.providerUrl) {
      base.url = item.providerUrl;
      base.potentialAction = {
        "@type": ACTION_TYPE[item.type],
        target: item.providerUrl,
      };
    }
    if (item.popularity && item.popularity > 0) {
      const ratingValue = Math.min(5, Math.max(1, Number((item.popularity / 20).toFixed(2))));
      base.aggregateRating = {
        "@type": "AggregateRating",
        ratingValue: ratingValue.toFixed(2),
        ratingCount: Math.max(50, Math.round(item.popularity)),
        bestRating: "5",
        worstRating: "1",
      };
    }
    return JSON.stringify(base);
  }, [item, locale, synopsis]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = (event) => {
    if (event.defaultPrevented) return;
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const target = primaryActionRef.current ?? event.currentTarget.querySelector<HTMLAnchorElement>("a");
      target?.click();
    }
  };

  return (
    <article
      data-testid="recommendation-card"
      className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg transition hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-800 dark:bg-slate-900"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <div className="relative h-60 w-full bg-slate-100 dark:bg-slate-800">
        <SafeImage
          src={item.posterUrl}
          alt={item.title}
          fill
          sizes="(max-width:768px) 100vw, 33vw"
          className="object-cover"
          fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">{strings.common.card.noPoster}</div>}
        />
        <span className="absolute left-4 top-4 rounded-full bg-slate-900/80 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          {typeBadge}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-300">
            {strings.common.card.matchLabel} {matchScore}%
          </span>
          <div className="relative h-1.5 flex-1 rounded-full bg-slate-200/70 dark:bg-slate-700/70">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
              style={{ width: `${matchScore}%` }}
            />
          </div>
        </div>
        <header className="flex flex-col gap-2">
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {item.providerUrl ? (
              <Link href={item.providerUrl} target="_blank" rel="noopener noreferrer" ref={primaryActionRef}>
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span>{yearLabel}</span>
            <span>• {typeBadge}</span>
            <span>• {format(strings.common.card.popularity, { value: Math.round(item.popularity) })}</span>
          </div>
        </header>
        {bulletPoints.length > 0 && (
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            {bulletPoints.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-blue-500 dark:bg-blue-300" aria-hidden="true" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
        {synopsis && (
          <p className="text-sm text-slate-600 dark:text-slate-300">{synopsis}</p>
        )}
        <div className="mt-auto space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
              {availabilityHeading}
            </h4>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {renderAvailabilityLinks(
                item,
                strings.common.card.ariaLabel,
                strings.common.card.titleTemplate,
                actionLabels,
                availabilityEmpty,
                item.providerUrl ? undefined : primaryActionRef,
              )}
            </ul>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
              <span>{format(strings.common.card.infoLabel, { source: sourceMeta.label })}</span>
            </div>
            <Link
              href={sourceMeta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-blue-600 hover:underline dark:text-blue-300"
            >
              {strings.common.card.infoCta}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function renderAvailabilityLinks(
  item: RecommendationPayload,
  ariaTemplate: string,
  titleTemplate: string,
  actions: Record<AvailabilityLink["type"] | "visit", string>,
  emptyLabel: string,
  primaryActionRef?: MutableRefObject<HTMLAnchorElement | null>,
) {
  const links = item.availability.filter(
    (link) => link.label.trim().toLowerCase() !== "justwatch",
  );

  if (!links.length) {
    return (
      <li className="text-sm text-slate-600 dark:text-slate-400">{emptyLabel}</li>
    );
  }

  const typePriority: Record<AvailabilityLink["type"], number> = {
    stream: 0,
    buy: 1,
    rent: 2,
    read: 3,
  };

  const byLabel = new Map<string, AvailabilityLink>();
  for (const link of links) {
    const normalized = normalizeProviderLabel(link.label);
    const key = normalized.toLowerCase();
    const existing = byLabel.get(key);
    if (!existing) {
      byLabel.set(key, { ...link, label: normalized });
      continue;
    }

    const existingPriority = typePriority[existing.type];
    const nextPriority = typePriority[link.type];

    const shouldReplace =
      nextPriority < existingPriority ||
      (nextPriority === existingPriority && !!link.affiliate && !existing.affiliate);

    if (shouldReplace) {
      byLabel.set(key, { ...link, label: normalized });
    }
  }

  const uniqueLinks = Array.from(byLabel.values())
    .sort((a, b) => typePriority[a.type] - typePriority[b.type])
    .slice(0, 5);

  return uniqueLinks.map((link, index) => {
    const brand = getBrandFromUrl(link.url, link.label);
    const actionLabel = actions[link.type] ?? actions.visit;
    const ariaLabel = format(ariaTemplate, { action: actionLabel, provider: link.label });
    const title = format(titleTemplate, { action: actionLabel, provider: link.label });
    return (
      <li key={`${item.id}-${link.label}-${link.url}`} className="flex flex-col items-center gap-1 text-xs">
        <Link
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          title={title}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
          ref={index === 0 ? primaryActionRef : undefined}
        >
          <AvailabilityLogo icon={brand.icon} name={brand.name} initials={brand.initials} />
        </Link>
        <span className="line-clamp-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
          {link.label}
        </span>
      </li>
    );
  });
}

function getBrandFromUrl(url: string, fallbackLabel: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const normalizedLabel = normalizeProviderLabel(fallbackLabel);
    let icon = `https://logo.clearbit.com/${hostname}`;
    let name = hostname;
    if (normalizedLabel === "Amazon Prime Video") {
      icon = "https://logo.clearbit.com/primevideo.com";
      name = "primevideo.com";
    } else if (normalizedLabel === "Disney+") {
      icon = "https://logo.clearbit.com/disneyplus.com";
      name = "disneyplus.com";
    } else if (normalizedLabel === "Netflix") {
      icon = "https://logo.clearbit.com/netflix.com";
      name = "netflix.com";
    } else if (normalizedLabel === "Hulu") {
      icon = "https://logo.clearbit.com/hulu.com";
      name = "hulu.com";
    } else if (normalizedLabel === "Apple TV" || normalizedLabel === "Apple TV+") {
      icon = "https://logo.clearbit.com/apple.com";
      name = "apple.com";
    } else if (normalizedLabel === "YouTube") {
      icon = "https://logo.clearbit.com/youtube.com";
      name = "youtube.com";
    } else if (normalizedLabel === "Google Play") {
      icon = "https://logo.clearbit.com/play.google.com";
      name = "play.google.com";
    } else if (normalizedLabel === "Peacock") {
      icon = "https://logo.clearbit.com/peacocktv.com";
      name = "peacocktv.com";
    } else if (normalizedLabel === "Movistar Plus+") {
      icon = "https://logo.clearbit.com/movistarplus.es";
      name = "movistarplus.es";
    } else if (normalizedLabel === "SkyShowtime") {
      icon = "https://logo.clearbit.com/skyshowtime.com";
      name = "skyshowtime.com";
    }
    return {
      icon,
      name,
      initials: (fallbackLabel?.trim() || hostname || "?")
        .split(/\s+/)
        .map((chunk) => chunk[0]?.toUpperCase() ?? "")
        .join("")
        .slice(0, 2),
    };
  } catch {
    const initials = (fallbackLabel?.trim() || "?")
      .split(/\s+/)
      .map((chunk) => chunk[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);
    return { icon: null, name: fallbackLabel, initials: initials || "?" };
  }
}

function buildBulletPoints(
  item: RecommendationPayload,
  templates: { genre: string; popularity: string; reason: string },
  typeLabel: string,
): string[] {
  const bullets: string[] = [];
  const primaryGenre = item.genres?.[0];
  if (primaryGenre) {
    bullets.push(format(templates.genre, { genre: primaryGenre }));
  } else {
    bullets.push(format(templates.genre, { genre: typeLabel }));
  }
  bullets.push(format(templates.popularity, { score: Math.round(item.popularity) }));
  const reasonSummary = item.reason ? truncateText(item.reason, 160) : null;
  if (reasonSummary) {
    bullets.push(format(templates.reason, { summary: reasonSummary }));
  }
  return bullets.slice(0, 3);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
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

function resolveSourceMeta(source?: RecommendationPayload["source"] | null): { label: string; url: string } {
  const normalized = typeof source === "string" ? source.toLowerCase() : undefined;
  switch (normalized) {
    case "tmdb":
      return { label: "TMDb", url: "https://www.themoviedb.org/" };
    case "omdb":
      return { label: "OMDb", url: "https://www.omdbapi.com/" };
    case "anilist":
      return { label: "AniList", url: "https://anilist.co/" };
    case "googlebooks":
      return { label: "Google Books", url: "https://books.google.com/" };
    case "mock":
      return { label: "Recomeai Mock Catalog", url: "https://recomeai.com/privacy" };
    default:
      return { label: "Recomeai", url: "https://recomeai.com/privacy" };
  }
}

