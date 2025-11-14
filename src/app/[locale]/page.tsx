"use client";

import clsx from "clsx";
import { use, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  BoltIcon,
  CalendarDaysIcon,
  FaceSmileIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

import { Autocomplete } from "@/components/Autocomplete";
import { PopularitySlider } from "@/components/PopularitySlider";
import { RecommendationGrid } from "@/components/RecommendationGrid";
import { TypeSegmentedControl } from "@/components/TypeSegmentedControl";
import { YearRangeSlider } from "@/components/YearRangeSlider";
import { env } from "@/env";
import { encodeSlug } from "@/lib/slug";
import type { RecommendationPayload, Suggestion } from "@/lib/types";
import type { Locale } from "@/i18n/config";
import { format, getStrings, getTypeLabel } from "@/i18n/strings";
import { mapGuideCategoryToType, TOP_SIMILAR_GUIDES } from "@/config/similar-guides";

type TypeOption = "all" | "movie" | "tv" | "anime" | "book";
type RecommendationMode = "search" | "random";
type QuickChipConfig = {
  id: string;
  label: string;
  mode: RecommendationMode;
  query?: string;
  type?: TypeOption;
  yearRange?: [number | null, number | null];
  popMin?: number;
  icon?: ReactNode;
};

interface RecommendationResponse {
  anchor: RecommendationPayload | null;
  items: RecommendationPayload[];
}

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://recomeai.com";

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

export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = use(params);
  const locale = resolvedParams.locale as Locale;
  const PAGE_SIZE = 10;
  const BATCH_LIMIT = 100;

  const [type, setType] = useState<TypeOption>("all");
  const [query, setQuery] = useState("");
  const [yearRange, setYearRange] = useState<[number | null, number | null]>([null, null]);
  const [popularityMin, setPopularityMin] = useState<number | null>(40);
  const [allRecommendations, setAllRecommendations] = useState<RecommendationPayload[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [anchor, setAnchor] = useState<RecommendationPayload | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string>("");
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [activeYearChip, setActiveYearChip] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<RecommendationMode>("search");
  const [statusMessage, setStatusMessage] = useState<{ type: "info" | "error"; text: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultsSectionRef = useRef<HTMLElement | null>(null);
  const [shouldScrollToResults, setShouldScrollToResults] = useState(false);
  const topGuides = useMemo(() => (TOP_SIMILAR_GUIDES[locale] ?? []).slice(0, 12), [locale]);
  const hasTopGuides = topGuides.length > 0;

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const strings = useMemo(() => getStrings(locale), [locale]);
  const requestSignature = useMemo(
    () =>
      JSON.stringify({
        locale,
        query: query.trim(),
        type,
        yearMin: yearRange[0],
        yearMax: yearRange[1],
        popMin: popularityMin,
      }),
    [locale, query, type, yearRange, popularityMin],
  );
  const displayRecommendations = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return allRecommendations.slice(start, start + PAGE_SIZE);
  }, [allRecommendations, pageIndex]);
  const totalPages = Math.ceil(allRecommendations.length / PAGE_SIZE);
  const hasMorePages = totalPages > 0 && pageIndex + 1 < totalPages;
  const isFullBatch = allRecommendations.length >= BATCH_LIMIT;
  const canFetchNextBatch = totalPages > 0 && !hasMorePages && isFullBatch;
  const showLoadMore =
    !isPending &&
    allRecommendations.length > 0 &&
    (hasMorePages || canFetchNextBatch);
  const isRandomMode = currentMode === "random";

  const quickChips: QuickChipConfig[] = useMemo(
    () => [
      {
        id: "comedy",
        label: strings.home.chips.comedy,
        mode: "search" as RecommendationMode,
        query: strings.home.chips.comedy,
        icon: <FaceSmileIcon className="h-4 w-4" />,
      },
      {
        id: "crime",
        label: strings.home.chips.crime,
        mode: "search" as RecommendationMode,
        query: strings.home.chips.crime,
        icon: <ShieldCheckIcon className="h-4 w-4" />,
      },
      {
        id: "anime",
        label: strings.home.chips.anime,
        mode: "search" as RecommendationMode,
        query: strings.home.chips.anime,
        type: "anime" as TypeOption,
        icon: <SparklesIcon className="h-4 w-4" />,
      },
      {
        id: "year2024",
        label: strings.home.chips.year2024,
        mode: "random" as RecommendationMode,
        yearRange: [2024, 2024] as [number, number],
        icon: <CalendarDaysIcon className="h-4 w-4" />,
      },
    ],
    [strings.home.chips],
  );

  const surpriseChip: QuickChipConfig = useMemo(
    () => ({
      id: "surprise",
      label: strings.home.chips.surprise,
      mode: "random" as RecommendationMode,
      icon: <BoltIcon className="h-4 w-4" />,
    }),
    [strings.home.chips.surprise],
  );

  const yearQuickOptions = useMemo(
    () => [
      {
        id: "year-latest",
        label: strings.home.yearChips.latest,
        range: [currentYear - 1, currentYear] as [number, number],
      },
      {
        id: "year-2010s",
        label: strings.home.yearChips.decade2010,
        range: [2010, 2019] as [number, number],
      },
      {
        id: "year-2000s",
        label: strings.home.yearChips.decade2000,
        range: [2000, 2009] as [number, number],
      },
      {
        id: "year-1990s",
        label: strings.home.yearChips.decade1990,
        range: [1990, 1999] as [number, number],
      },
    ],
    [strings.home.yearChips, currentYear],
  );

  useEffect(() => {
    if (lastSignature && lastSignature !== requestSignature) {
      setAllRecommendations([]);
      setPageIndex(0);
      setAnchor(null);
    }
  }, [requestSignature, lastSignature]);

  useEffect(() => {
    if (!query.trim() && !activeChip && !activeYearChip && allRecommendations.length === 0 && !isPending) {
      setStatusMessage((current) => {
        if (current?.type === "error") return current;
        return { type: "info", text: strings.home.emptyPrompt };
      });
    }
  }, [query, activeChip, activeYearChip, allRecommendations.length, isPending, strings.home.emptyPrompt]);

  useEffect(() => {
    if (!activeChip) return;
    const chip = [...quickChips, surpriseChip].find((entry) => entry.id === activeChip);
    if (!chip) return;
    if (chip.mode === "search") {
      const expected = (chip.query ?? "").trim().toLowerCase();
      if (query.trim().toLowerCase() !== expected) {
        setActiveChip(null);
      }
    }
  }, [activeChip, quickChips, surpriseChip, query]);
  const typeLabelSingular = useMemo(() => {
    return (value: RecommendationPayload["type"] | Suggestion["type"] | TypeOption) =>
      getTypeLabel(locale, value as any);
  }, [locale]);
  const typeOptionLabels = useMemo(() => {
    return {
      all: getTypeLabel(locale, "all", { plural: true }),
      movie: getTypeLabel(locale, "movie", { plural: true }),
      tv: getTypeLabel(locale, "tv", { plural: true }),
      anime: getTypeLabel(locale, "anime", { plural: true }),
      book: getTypeLabel(locale, "book", { plural: true }),
    } as const;
  }, [locale]);
  const yearSliderLabels = useMemo(
    () => ({
      min: (value: string | number) =>
        format(strings.home.slider.year.minLabel, { value }),
      max: (value: string | number) =>
        format(strings.home.slider.year.maxLabel, { value }),
      any: strings.home.slider.year.any,
      ariaMin: strings.home.slider.year.ariaMin,
      ariaMax: strings.home.slider.year.ariaMax,
      instructions: strings.home.slider.year.instructions,
    }),
    [strings.home.slider.year, format],
  );
  const popularityLabels = useMemo(
    () => ({
      minLabel: strings.home.slider.popularity.minLabel,
      noMinimum: strings.home.slider.popularity.noMinimum,
      aria: strings.home.slider.popularity.aria,
      clear: strings.home.slider.popularity.clear,
      instructions: strings.home.slider.popularity.instructions,
      inputLabel: strings.home.slider.popularity.inputLabel,
    }),
    [strings.home.slider.popularity],
  );
  const autocompleteMessages = useMemo(
    () => ({
      ariaLabel: strings.home.autocomplete.ariaLabel,
      loading: strings.home.autocomplete.loading,
      error: strings.home.autocomplete.error,
      empty: strings.home.autocomplete.empty,
      minChars: strings.home.autocomplete.minChars,
      select: strings.home.autocomplete.select,
      pressEnter: strings.home.autocomplete.pressEnter,
      yearUnknown: strings.common.labels.yearUnknown,
      romaji: strings.home.autocomplete.romaji,
    }),
    [strings],
  );

  const handleResetFilters = useCallback(() => {
    setType("all");
    setYearRange([null, null]);
    setPopularityMin(40);
    setQuery("");
    setSelectedSuggestion(null);
    setAllRecommendations([]);
    setPageIndex(0);
    setAnchor(null);
    setLastSignature(null);
    setLastQuery("");
    setCurrentMode("search");
    setActiveChip(null);
    setActiveYearChip(null);
    setStatusMessage({ type: "info", text: strings.home.emptyPrompt });
  }, [strings.home.emptyPrompt]);

  const handleSelection = (selection: { suggestion?: Suggestion; query: string }) => {
    setQuery(selection.query);
    setSelectedSuggestion(selection.suggestion ?? null);
    if (selection.suggestion && type === "all") {
      setType(selection.suggestion.type as TypeOption);
    }
    setActiveChip(null);
    setActiveYearChip(null);
    setStatusMessage(null);
  };

  const fetchRecommendationsBatch = useCallback(
    async (
      options: {
        searchQuery?: string;
        mode: "search" | "random";
        signature: string;
      },
    ) => {
      try {
        const params = new URLSearchParams();
        if (options.mode === "search") {
          params.set("query", options.searchQuery ?? "");
        } else {
          params.set("mode", "random");
        }
        if (type !== "all") params.set("type", type);
        if (yearRange[0]) params.set("yearMin", String(yearRange[0]));
        if (yearRange[1]) params.set("yearMax", String(yearRange[1]));
        if (popularityMin && popularityMin > 0) params.set("popMin", String(popularityMin));
        params.set("limit", String(BATCH_LIMIT));
        params.set("locale", locale);

        setPageIndex(0);
        setAllRecommendations([]);
        setStatusMessage(null);

        const response = await fetch(`/api/recommendations?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const body = (await response.json()) as RecommendationResponse;
        const items = body.items ?? [];
        setAllRecommendations(items);
        setAnchor(body.anchor ?? null);
        setLastSignature(options.signature);
        setLastQuery(options.searchQuery ?? "");
        setCurrentMode(options.mode);
        setShouldScrollToResults(items.length > 0);
        if (items.length === 0) {
          if (options.mode === "search" && options.searchQuery) {
            setStatusMessage({
              type: "error",
              text: format(strings.home.noResults, { query: options.searchQuery }),
            });
          } else {
            setStatusMessage({ type: "info", text: strings.home.emptyPrompt });
          }
        } else {
          setStatusMessage(null);
        }
      } catch (error) {
        console.error(error);
        toast.error(strings.common.messages.fetchError);
        setStatusMessage({ type: "error", text: strings.home.fetchFailed });
      }
    },
    [type, yearRange, popularityMin, locale, strings.common.messages.fetchError, strings.home.emptyPrompt, strings.home.fetchFailed, strings.home.noResults],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    const mode: RecommendationMode = trimmedQuery ? "search" : "random";

    if (showLoadMore && !isPending && currentMode === mode) {
      handleShowMore();
      return;
    }

    setStatusMessage(null);
    const signature = requestSignature;
    startTransition(() => {
      fetchRecommendationsBatch({
        searchQuery: mode === "search" ? trimmedQuery : undefined,
        mode,
        signature,
      });
    });
    if (mode === "search") {
      setActiveChip(null);
      setActiveYearChip(null);
    }
  };

  const handleShowMore = () => {
    if (isPending) return;
    if (hasMorePages) {
      setPageIndex((current) => Math.min(current + 1, totalPages - 1));
      return;
    }
    if (canFetchNextBatch) {
      setStatusMessage(null);
      const signature = requestSignature;
      startTransition(() => {
        if (currentMode === "search") {
          const queryForLoad = lastQuery || query.trim();
          if (!queryForLoad) {
            return;
          }
          fetchRecommendationsBatch({ searchQuery: queryForLoad, mode: "search", signature });
        } else {
          fetchRecommendationsBatch({ mode: "random", signature });
        }
      });
    }
  };

  const handleQuickChip = (chip: QuickChipConfig) => {
    const newType = chip.type ?? "all";
    const newYearRange = chip.yearRange ?? [null, null];
    const newQuery = chip.mode === "search" ? chip.query ?? "" : "";
    const newPopMin = chip.popMin ?? popularityMin ?? undefined;

    setType(newType);
    setYearRange(newYearRange);
    if (chip.popMin !== undefined) {
      setPopularityMin(chip.popMin);
    }
    setQuery(newQuery);
    setSelectedSuggestion(null);
    setActiveChip(chip.id);
    setActiveYearChip(null);
    setLastSignature(null);
    setLastQuery(chip.mode === "search" ? newQuery.trim() : "");
    setStatusMessage({ type: "info", text: strings.home.readyPrompt });
  };

  const yearLowerBound = 1960;
  const yearUpperBound = currentYear;

  const handleYearQuickRange = (chipId: string, range: [number | null, number | null]) => {
    setYearRange(range);
    setActiveYearChip(chipId);
    setActiveChip(null);
    setStatusMessage({ type: "info", text: strings.home.readyPrompt });
  };

  const handleYearInputChange = (kind: "min" | "max", rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    const clamped = Number.isNaN(parsed)
      ? null
      : Math.max(yearLowerBound, Math.min(parsed, yearUpperBound));
    let [currentMin, currentMax] = yearRange;
    if (kind === "min") {
      currentMin = clamped;
    } else {
      currentMax = clamped;
    }
    if (
      typeof currentMin === "number" &&
      typeof currentMax === "number" &&
      currentMin >= currentMax
    ) {
      if (kind === "min") {
        currentMax = Math.min(currentMin + 1, yearUpperBound);
      } else {
        currentMin = Math.max(currentMax - 1, yearLowerBound);
      }
    }
    setYearRange([currentMin ?? null, currentMax ?? null]);
    setActiveYearChip(null);
    setStatusMessage({ type: "info", text: strings.home.readyPrompt });
  };

  const anchorTitleRaw = anchor?.title ?? selectedSuggestion?.title ?? query;
  const anchorTitle = anchorTitleRaw?.trim() ?? "";
  const anchorYear = anchor?.year ?? selectedSuggestion?.year ?? null;
  const anchorTypeLabel = anchor?.type
    ? typeLabelSingular(anchor.type)
    : selectedSuggestion?.type
    ? typeLabelSingular(selectedSuggestion.type)
    : type !== "all"
    ? typeLabelSingular(type)
    : null;
  const anchorMetaParts = [anchorTypeLabel ?? null, anchorYear ?? null].filter(Boolean);
  const hasAnchorInfo = Boolean(anchorTitle);
  const similarPageHref = hasAnchorInfo ? `/${locale}/recommendations/similar-to/${encodeSlug(anchorTitle)}` : null;

  const structuredData = buildStructuredData(locale, strings);
  const breadcrumbStructured = useMemo(
    () =>
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: strings.common.appName,
            item: `${siteUrl}/${locale}`,
          },
        ],
      }),
    [locale, strings.common.appName],
  );

  const itemListStructured = useMemo(() => {
    if (displayRecommendations.length === 0) {
      return null;
    }
    const itemListElement = displayRecommendations.map((item, index) => {
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
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: strings.common.sections.recommendationsHeading,
      inLanguage: locale,
      itemListElement,
      numberOfItems: displayRecommendations.length,
    });
  }, [displayRecommendations, locale, strings.common.sections.recommendationsHeading]);

  const buttonLabel = useMemo(() => {
    if (isPending) {
      return strings.common.messages.generating;
    }
    if (showLoadMore && currentMode === "search") {
      return strings.home.loadMoreButton;
    }
    if (showLoadMore && currentMode === "random") {
      return strings.home.loadMoreButton;
    }
    if (!query.trim()) {
      return strings.home.getRandomButton;
    }
    return strings.common.buttons.submit;
  }, [isPending, showLoadMore, currentMode, query, strings]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true" ||
          target.getAttribute("role") === "textbox");

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (isTypingContext) return;
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !isTypingContext) {
        if (searchInputRef.current) {
          event.preventDefault();
          searchInputRef.current.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => {
      window.removeEventListener("keydown", handleGlobalShortcut);
    };
  }, [searchInputRef]);

  useEffect(() => {
    if (!shouldScrollToResults || isPending) {
      return;
    }
    if (displayRecommendations.length === 0) {
      setShouldScrollToResults(false);
      return;
    }
    const node = resultsSectionRef.current;
    if (!node) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      setShouldScrollToResults(false);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [shouldScrollToResults, isPending, displayRecommendations.length]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 pb-20 pt-6 sm:px-6 sm:pt-12 lg:px-8 lg:pt-16"
    >
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: breadcrumbStructured }}
      />
      {itemListStructured && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: itemListStructured }}
        />
      )}
      <section className="space-y-6">
        <header className="space-y-3 text-center sm:text-left">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-5xl lg:text-6xl">
            {strings.home.heroTitle}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 sm:text-lg lg:text-xl">
            {strings.home.heroSubtitle}
          </p>
        </header>
        <div className="space-y-4 md:sticky md:top-4 md:z-40">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-white/40 bg-gradient-to-br from-white/95 via-slate-50/90 to-blue-50/70 p-4 shadow-[0_25px_85px_rgba(15,23,42,0.25)] backdrop-blur-lg max-sm:-mx-6 max-sm:rounded-none max-sm:border-0 max-sm:bg-white max-sm:p-4 max-sm:shadow-none max-sm:backdrop-blur-none sm:p-6 dark:border-slate-800/70 dark:from-slate-950/95 dark:via-slate-900/80 dark:to-blue-950/40"
          >
            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[2.2fr,1fr] lg:gap-8">
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1">
                    <label htmlFor="search-input" className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {strings.home.searchLabel}
                    </label>
                    <Autocomplete
                      onSelect={handleSelection}
                      onQueryChange={(value) => {
                        setQuery(value);
                        if (value.trim().length === 0) {
                          setActiveChip(null);
                          setStatusMessage({ type: "info", text: strings.home.emptyPrompt });
                        } else {
                          setStatusMessage(null);
                        }
                      }}
                      initialQuery={query}
                      placeholder={strings.home.autocomplete.placeholder}
                      messages={autocompleteMessages}
                      typeLabel={(type) => typeLabelSingular(type)}
                      inputRef={searchInputRef}
                    />
                  </div>
                  <div className="flex gap-2 sm:flex-none">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center rounded-xl border border-slate-200/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                    >
                      {strings.common.buttons.resetFilters}
                    </button>
                    <button
                      type="submit"
                      className="relative inline-flex items-center rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-2 text-sm font-bold text-white shadow-[0_15px_35px_rgba(59,130,246,0.45)] transition hover:translate-y-[-1px] hover:shadow-[0_20px_40px_rgba(79,70,229,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isPending}
                    >
                      {buttonLabel}
                    </button>
                  </div>
                </div>
                <div className="-mx-4 flex gap-2 overflow-x-auto pb-1 pl-4 pr-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {[...quickChips, surpriseChip].map((chip) => {
                    const isActive = activeChip === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleQuickChip(chip)}
                        className={clsx(
                          "group relative shrink-0 overflow-hidden rounded-2xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                          isActive
                            ? "border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-500/40 dark:hover:bg-blue-950/40",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {chip.icon && <span className={clsx("text-blue-500", isActive && "text-white")}>{chip.icon}</span>}
                          {chip.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-4">
                <div className="min-h-[170px] rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-inner dark:border-slate-700 dark:bg-slate-900/70">
                  {selectedSuggestion?.posterUrl ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedSuggestion.posterUrl}
                        alt={format(strings.home.selectedPosterAlt, { title: selectedSuggestion.title })}
                        className="h-28 w-20 rounded-lg object-cover shadow-md sm:h-32 sm:w-24"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                          {selectedSuggestion.title}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {typeLabelSingular(selectedSuggestion.type)} • {selectedSuggestion.year ?? strings.common.labels.yearUnknown}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-blue-600 dark:text-blue-300">
                          {strings.home.anchorHeading}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
                      <SparklesIcon className="h-6 w-6 text-blue-500 dark:text-blue-300" />
                      <p>{strings.home.randomNotice}</p>
                    </div>
                  )}
                </div>
                {statusMessage && (
                  <div
                    className={clsx(
                      "rounded-2xl px-4 py-3 text-sm",
                      statusMessage.type === "error"
                        ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-200"
                        : "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>{statusMessage.text}</span>
                      {statusMessage.type === "error" && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-sm font-semibold underline decoration-current"
                        >
                          {strings.common.buttons.resetFilters}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="space-y-1.5 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center gap-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {strings.home.typeLabel}
                  </label>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400" title={strings.home.typeDescription}>
                    ⓘ
                  </span>
                </div>
                <div className="-mx-2 flex overflow-x-auto pb-1 pl-2 pr-2 sm:mx-0 sm:block sm:overflow-visible sm:px-0">
                  <TypeSegmentedControl
                    value={type}
                    onChange={(value) => {
                      setType(value);
                      setActiveChip(null);
                      setActiveYearChip(null);
                      setStatusMessage({ type: "info", text: strings.home.readyPrompt });
                    }}
                    labels={typeOptionLabels}
                    ariaLabel={strings.home.typeLabel}
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {strings.home.popularityLabel}
                </label>
                <PopularitySlider
                  value={popularityMin}
                  onChange={(val) => {
                    setPopularityMin(val);
                    setActiveChip(null);
                    setActiveYearChip(null);
                    setStatusMessage({ type: "info", text: strings.home.readyPrompt });
                  }}
                  labels={{
                    ...popularityLabels,
                    tooltipTitle: strings.home.slider.popularity.tooltipTitle,
                    tooltipBody: strings.home.slider.popularity.tooltipBody,
                  }}
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-white/60 bg-white/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 sm:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {strings.home.yearRangeLabel}
                </label>
                <div className="space-y-3">
                  <div className="-mx-4 flex gap-2 overflow-x-auto pb-1 pl-4 pr-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                    {yearQuickOptions.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleYearQuickRange(chip.id, chip.range)}
                        className={clsx(
                          "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
                          activeYearChip === chip.id
                            ? "border-blue-600 bg-blue-600 text-white shadow"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20",
                        )}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span>{strings.home.slider.year.inputMinPlaceholder}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        placeholder={strings.home.slider.year.inputMinPlaceholder}
                        value={yearRange[0] ?? ""}
                        min={yearLowerBound}
                        max={yearUpperBound - 1}
                        onChange={(event) => handleYearInputChange("min", event.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <span>{strings.home.slider.year.inputMaxPlaceholder}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        placeholder={strings.home.slider.year.inputMaxPlaceholder}
                        value={yearRange[1] ?? ""}
                        min={yearLowerBound + 1}
                        max={yearUpperBound}
                        onChange={(event) => handleYearInputChange("max", event.target.value)}
                      />
                    </label>
                  </div>
                  <YearRangeSlider
                    value={yearRange}
                    onChange={(val) => {
                      setYearRange(val);
                      setActiveChip(null);
                      setActiveYearChip(null);
                      setStatusMessage({ type: "info", text: strings.home.readyPrompt });
                    }}
                    min={yearLowerBound}
                    max={yearUpperBound}
                    labels={yearSliderLabels}
                  />
                </div>
              </div>
            </div>
          </form>
        </div>
      </section>

      {hasAnchorInfo && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {strings.home.anchorHeading}
          </h2>
          <div className="mt-2 text-base font-medium text-slate-800 dark:text-slate-100">
            <span>{anchorTitle}</span>
            {anchorMetaParts.length > 0 && (
              <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">• {anchorMetaParts.join(" • ")}</span>
            )}
          </div>
          {similarPageHref && (
            <div className="mt-4">
              {/* The original code had Link here, but Link is not imported.
                  Assuming this was a placeholder for a future import or intended to be removed.
                  For now, keeping the structure but removing the Link component. */}
              <a
                href={similarPageHref}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
              >
                {format(strings.common.buttons.viewSimilarGuide, { title: anchorTitle })}
              </a>
            </div>
          )}
        </section>
      )}

      {hasTopGuides && (
        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              {strings.home.similarGuidesHeading}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{strings.home.similarGuidesDescription}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topGuides.map((guide) => {
              const typeKey = mapGuideCategoryToType(guide.category);
              return (
                <Link
                  key={`${locale}-${guide.slug}`}
                  href={`/${locale}/recommendations/similar-to/${guide.slug}`}
                  className="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-slate-900 transition group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-200">
                      {guide.title}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {typeLabelSingular(typeKey)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-300">{guide.description}</p>
                  <span className="text-xs font-semibold text-blue-600 transition group-hover:text-blue-700 dark:text-blue-300 dark:group-hover:text-blue-200">
                    {strings.home.similarGuidesCta}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(displayRecommendations.length > 0 || isPending) && (
        <section className="space-y-4" ref={resultsSectionRef}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {strings.common.sections.recommendationsHeading}
            </h2>
            {isPending && (
              <span className="text-sm text-slate-600 dark:text-slate-400">{strings.common.messages.generating}</span>
            )}
          </div>
          {isRandomMode && !isPending && (
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {strings.home.randomNotice}
            </p>
          )}
          {showLoadMore && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleShowMore}
                disabled={isPending}
                className="inline-flex items-center rounded-xl border border-blue-200 bg-white px-6 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500/40 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30"
              >
                {strings.home.loadMoreButton}
              </button>
            </div>
          )}
          {isPending && displayRecommendations.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                <p className="text-sm text-slate-600 dark:text-slate-400">{strings.common.messages.analyzing}</p>
              </div>
            </div>
          ) : (
            <>
              <RecommendationGrid
                items={displayRecommendations}
                isLoading={isPending}
                locale={locale}
                emptyMessage={strings.common.messages.infoNoResults}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}

function buildStructuredData(locale: Locale, strings: ReturnType<typeof getStrings>) {
  const pageUrl = `${siteUrl}/${locale}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: strings.common.appName,
    url: pageUrl,
    inLanguage: locale,
    description: strings.seo.homeDescription,
    applicationCategory: "EntertainmentApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Hybrid search blending semantic vectors with PostgreSQL full-text",
      "AI reranking with Cohere and LLM fallbacks",
      "Franchise deduplication and diversity optimization",
      "Cross-media recommendations for film, TV, anime, and books",
    ],
    potentialAction: {
      "@type": "SearchAction",
      target: `${pageUrl}?query={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}


