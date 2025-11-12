import { env } from "@/env";
import { getLocaleConfig, type Locale } from "@/i18n/config";
import type { AvailabilityLink, ProviderItemLocalization } from "@/lib/types";

const AMAZON_DOMAINS: Record<string, string> = {
  US: "https://www.amazon.com/s",
  ES: "https://www.amazon.es/s",
  DE: "https://www.amazon.de/s",
};

const AUDIBLE_DOMAINS: Record<string, string> = {
  US: "https://www.audible.com/search",
  ES: "https://www.audible.es/search",
  DE: "https://www.audible.de/search",
};

const AFFILIATE_PARAM = "tag";

export function applyAffiliate(url: URL): URL {
  if (env.AVAILABILITY_AFFILIATE_TAG) {
    url.searchParams.set(AFFILIATE_PARAM, env.AVAILABILITY_AFFILIATE_TAG);
  }
  return url;
}

interface ProviderPattern {
  keywords: string[];
  build: (
    title: string,
    type: AvailabilityLink["type"],
    locale: Locale,
  ) => { url: string; affiliate?: boolean } | null;
}

const PROVIDER_PATTERNS: ProviderPattern[] = [
  {
    keywords: ["amazon prime", "amazon video", "amazon"],
    build: (title, type, locale) => {
      const region = getLocaleConfig(locale).availabilityRegion;
      const base = AMAZON_DOMAINS[region] ?? AMAZON_DOMAINS.US;
      const amazon = new URL(base);
      amazon.searchParams.set("k", type === "stream" ? `${title} Prime Video` : `${title}`);
      amazon.searchParams.set("i", "instant-video");
      const url = applyAffiliate(amazon).toString();
      return { url, affiliate: Boolean(env.AVAILABILITY_AFFILIATE_TAG) };
    },
  },
  {
    keywords: ["netflix"],
    build: (title, _type, locale) => ({
      url: `https://www.netflix.com/${locale}/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["disney"],
    build: (title, _type, locale) => ({
      url: `https://www.disneyplus.com/${locale}/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["hulu"],
    build: (title) => ({
      url: `https://www.hulu.com/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["apple tv", "apple tv+", "apple itunes", "itunes"],
    build: (title) => ({
      url: `https://tv.apple.com/search?term=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["google play", "google", "youtube", "play movies"],
    build: (title, type) => {
      if (type === "buy" || type === "rent") {
        return {
          url: `https://play.google.com/store/search?q=${encodeURIComponent(title)}&c=movies`,
        };
      }
      return {
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} full`)}`,
      };
    },
  },
  {
    keywords: ["vudu"],
    build: (title) => ({
      url: `https://www.vudu.com/content/movies/search?searchString=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["microsoft"],
    build: (title) => ({
      url: `https://www.microsoft.com/en-us/store/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["peacock"],
    build: (title) => ({
      url: `https://www.peacocktv.com/watch/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["paramount", "paramount+"],
    build: (title) => ({
      url: `https://www.paramountplus.com/search/?searchTerm=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["max", "hbo"],
    build: (title) => ({
      url: `https://www.max.com/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["crunchyroll"],
    build: (title) => ({
      url: `https://beta.crunchyroll.com/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["funimation"],
    build: (title) => ({
      url: `https://www.fandom.com/search?search=${encodeURIComponent(title)}+Funimation`,
    }),
  },
  {
    keywords: ["tubi"],
    build: (title) => ({
      url: `https://tubitv.com/search/${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["plex"],
    build: (title) => ({
      url: `https://watch.plex.tv/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["roku"],
    build: (title) => ({
      url: `https://therokuchannel.roku.com/search/${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["rakuten", "viki"],
    build: (title) => ({
      url: `https://www.viki.com/search?q=${encodeURIComponent(title)}`,
    }),
  },
  {
    keywords: ["audible"],
    build: (title, _type, locale) => {
      const region = getLocaleConfig(locale).availabilityRegion;
      const base = AUDIBLE_DOMAINS[region] ?? AUDIBLE_DOMAINS.US;
      const audible = new URL(base);
      audible.searchParams.set("keywords", title);
      return { url: applyAffiliate(audible).toString(), affiliate: Boolean(env.AVAILABILITY_AFFILIATE_TAG) };
    },
  },
];

const PROVIDER_LABEL_ALIASES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\s+with\s+ads?$/i, replacement: "" },
  { pattern: /\s+standard$/i, replacement: "" },
  { pattern: /\s+premium$/i, replacement: "" },
  { pattern: /\s+plan$/i, replacement: "" },
  { pattern: /\s*\((?:ads|ad\s*free)\)$/i, replacement: "" },
];

const PROVIDER_CANONICAL_NAMES: Record<string, string> = {
  "amazon prime video": "Amazon Prime Video",
  "amazon video": "Amazon Prime Video",
  "prime video": "Amazon Prime Video",
  "amazon": "Amazon Prime Video",
  "netflix": "Netflix",
  "netflix standard": "Netflix",
  "netflix premium": "Netflix",
  "hulu": "Hulu",
  "disney+": "Disney+",
  "disney plus": "Disney+",
  "apple tv+": "Apple TV+",
  "apple tv": "Apple TV",
  "apple tv app": "Apple TV",
  "peacock": "Peacock",
  "peacock premium": "Peacock",
  "peacock premium plus": "Peacock",
  "google play movies": "Google Play",
  "google play": "Google Play",
  "fandango at home": "Vudu",
  "vudu": "Vudu",
  "you tube": "YouTube",
  "youtube": "YouTube",
  "youtube tv": "YouTube",
  "philo": "Philo",
  "television española": "RTVE",
  "movistar plus": "Movistar Plus+",
  "skyshowtime": "SkyShowtime",
  "sky showtime": "SkyShowtime",
};

export function normalizeProviderLabel(rawLabel: string | undefined | null): string {
  if (!rawLabel) {
    return "";
  }
  let label = rawLabel.trim();
  for (const { pattern, replacement } of PROVIDER_LABEL_ALIASES) {
    label = label.replace(pattern, replacement).trim();
  }
  const lower = label.toLowerCase();
  if (PROVIDER_CANONICAL_NAMES[lower]) {
    return PROVIDER_CANONICAL_NAMES[lower];
  }
  return label.replace(/\s{2,}/g, " ");
}

export function buildProviderAvailability(
  providerName: string,
  type: AvailabilityLink["type"],
  title: string,
  locale: Locale,
): AvailabilityLink | null {
  const normalizedLabel = normalizeProviderLabel(providerName);
  if (!normalizedLabel) {
    return null;
  }

  const lower = normalizedLabel.toLowerCase();
  for (const pattern of PROVIDER_PATTERNS) {
    if (pattern.keywords.some((keyword) => lower.includes(keyword))) {
      const result = pattern.build(title, type, locale);
      if (result?.url) {
        return {
          label: providerName,
          type,
          url: result.url,
          affiliate: Boolean(result.affiliate),
        };
      }
    }
  }

  const query = `${title} ${providerName} ${type}`;
  const fallback = new URL("https://www.google.com/search");
  fallback.searchParams.set("q", query);
  return {
    label: providerName,
    type,
    url: fallback.toString(),
    affiliate: false,
  };
}

export function mergeAvailability(primary: AvailabilityLink[], secondary: AvailabilityLink[]): AvailabilityLink[] {
  const seen = new Map<string, AvailabilityLink>();
  const add = (link: AvailabilityLink) => {
    const key = `${link.label.toLowerCase()}|${link.type}`;
    if (!seen.has(key)) {
      seen.set(key, link);
    }
  };
  primary.forEach((link) => add(link));
  secondary.forEach((link) => add(link));
  return Array.from(seen.values());
}

export function buildDefaultAvailability(
  title: string,
  type: "movie" | "tv" | "anime" | "book",
  locale: Locale,
): AvailabilityLink[] {
  const links: AvailabilityLink[] = [];

  if (type === "movie" || type === "tv" || type === "anime") {
    const amazon = buildProviderAvailability("Amazon Prime Video", "buy", title, locale);
    const youtube = buildProviderAvailability("YouTube", "stream", title, locale);
    if (amazon) links.push(amazon);
    if (youtube) links.push(youtube);

    if (type === "anime") {
      const crunchy = buildProviderAvailability("Crunchyroll", "stream", title, locale);
      if (crunchy) links.push(crunchy);
    }
  }

  if (type === "book") {
    const region = getLocaleConfig(locale).availabilityRegion;
    const amazonBase = AMAZON_DOMAINS[region] ?? AMAZON_DOMAINS.US;
    const amazonBooks = new URL(amazonBase);
    amazonBooks.searchParams.set("k", `${title} book`);
    links.push({
      label: "Amazon Books",
      type: "buy",
      url: applyAffiliate(amazonBooks).toString(),
      affiliate: Boolean(env.AVAILABILITY_AFFILIATE_TAG),
    });
    const audibleLink = buildProviderAvailability("Audible", "buy", title, locale);
    if (audibleLink) {
      links.push(audibleLink);
    }
  }

  return mergeAvailability(links, []);
}

export function createLocalizationPayload(
  locale: Locale,
  title: string,
  type: "movie" | "tv" | "anime" | "book",
  synopsis?: string | null,
  availability?: AvailabilityLink[],
): ProviderItemLocalization {
  return {
    locale,
    title,
    synopsis: synopsis ?? null,
    availability: availability ?? buildDefaultAvailability(title, type, locale),
  };
}

