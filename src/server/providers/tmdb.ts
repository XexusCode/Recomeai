import { env } from "@/env";
import {
  buildDefaultAvailability,
  buildProviderAvailability,
  createLocalizationPayload,
  mergeAvailability,
} from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import type {
  AvailabilityLink,
  ProviderItem,
  ProviderItemLocalization,
  ProviderName,
  ProviderSearchOptions,
} from "@/lib/types";
import { ContentProvider, filterByType } from "@/server/providers/base";
import { defaultLocale, getLocaleConfig, locales, type Locale } from "@/i18n/config";

type TmdbMediaType = "movie" | "tv";

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: "movie" | "tv" | string;
  genre_ids?: number[];
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  origin_country?: string[]; // For TV shows
  original_language?: string;
}

interface TmdbSearchResponse {
  results?: TmdbSearchResult[];
}

interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
}

interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
}

interface TmdbCreditsResponse {
  crew?: TmdbCrewMember[];
  cast?: TmdbCastMember[];
}

interface TmdbDetailResponse {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genres?: Array<{ id: number; name: string }>;
  popularity?: number;
  vote_average?: number;
  vote_count?: number;
  homepage?: string | null;
  media_type?: "movie" | "tv";
  origin_country?: string[]; // For TV shows
  production_countries?: Array<{ iso_3166_1: string; name: string }>; // For movies
  original_language?: string;
  created_by?: Array<{ id: number; name: string }>; // For TV shows
}

interface TmdbWatchProvidersResponse {
  results?: Record<string, TmdbWatchProviderRegion>;
}

interface TmdbWatchProviderRegion {
  link?: string;
  flatrate?: TmdbWatchProvider[];
  subscription?: TmdbWatchProvider[];
  buy?: TmdbWatchProvider[];
  rent?: TmdbWatchProvider[];
  ads?: TmdbWatchProvider[];
  free?: TmdbWatchProvider[];
}

interface TmdbWatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority: number;
}

interface TmdbDiscoverOptions {
  mediaType: TmdbMediaType;
  pages?: number;
  sortBy?: string;
  year?: number;
  withGenres?: string;
  language?: string;
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export class TmdbProvider implements ContentProvider {
  readonly name: ProviderName = "tmdb";

  supports(type: ProviderSearchOptions["type"]): boolean {
    if (!env.TMDB_API_KEY) return false;
    if (!type || type === "any") return true;
    // TMDb supports movies, TV shows, and we can detect anime from TV shows
    return type === "movie" || type === "tv" || type === "series" || type === "anime";
  }

  async search(query: string, options: ProviderSearchOptions = {}): Promise<ProviderItem[]> {
    if (!env.TMDB_API_KEY) {
      return [];
    }
    const url = new URL(`${env.TMDB_API_BASE ?? "https://api.themoviedb.org/3"}/search/multi`);
    url.searchParams.set("api_key", env.TMDB_API_KEY);
    url.searchParams.set("query", query);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("include_adult", "false");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TMDb search failed: ${response.status}`);
    }
    const data = (await response.json()) as TmdbSearchResponse;
    const limit = options.limit ?? 20;
    const items = (data.results ?? [])
      .map((result) => this.mapSearchResult(result))
      .filter((item): item is ProviderItem => Boolean(item));
    return filterByType(items, options.type).slice(0, limit);
  }

  async fetchById(id: string): Promise<ProviderItem | null> {
    if (!env.TMDB_API_KEY) {
      return null;
    }
    const [type, rawId] = id.split(":");
    const numericId = Number.parseInt(rawId ?? id, 10);
    if (!Number.isFinite(numericId)) {
      return null;
    }
    // Normalize type: anime is stored as "anime" but TMDb API uses "tv"
    const tmdbType = type === "anime" ? "tv" : type;
    const detailResult = await this.fetchDetailWithLanguage(numericId, tmdbType === "tv" ? "tv" : "movie", defaultLocale);
    if (!detailResult) {
      return null;
    }
    const baseDetail = detailResult.detail;
    
    // Fetch credits to get creators/directors and cast
    const credits = await this.fetchCreators(numericId, tmdbType === "tv" ? "tv" : "movie");
    
    // Fetch keywords/tags
    const keywords = await this.fetchKeywords(numericId, tmdbType === "tv" ? "tv" : "movie");
    
    const item = this.mapDetail(baseDetail, tmdbType === "tv" ? "tv" : "movie", credits.creators, credits.cast, keywords);
    if (!item) {
      return null;
    }
    const watchProviders = await this.fetchWatchAvailability(
      baseDetail.id,
      tmdbType === "tv" ? "tv" : "movie",
      item.title,
      item.type,
      defaultLocale,
    );
    const defaultAvailability = buildDefaultAvailability(item.title, item.type, defaultLocale);
    const merged = mergeAvailability(watchProviders, defaultAvailability);
    item.availability = merged.length ? merged : defaultAvailability;
    const additionalLocalizations = await this.fetchLocalizations(
      `tmdb-${item.type}:${detailResult.detail.id}`,
      locales.filter((loc) => loc !== defaultLocale),
    );
    item.localizations = [
      createLocalizationPayload(defaultLocale, item.title, item.type, item.synopsis, item.availability),
      ...additionalLocalizations,
    ];
    return item;
  }

  async discover(options: TmdbDiscoverOptions): Promise<ProviderItem[]> {
    if (!env.TMDB_API_KEY) {
      return [];
    }
    const base = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
    const path = options.mediaType === "tv" ? "/discover/tv" : "/discover/movie";
    const pages = Math.max(1, Math.min(options.pages ?? 1, 20));
    const items: ProviderItem[] = [];

    for (let page = 1; page <= pages; page += 1) {
      const url = new URL(`${base}${path}`);
      url.searchParams.set("api_key", env.TMDB_API_KEY);
      url.searchParams.set("language", options.language ?? "en-US");
      url.searchParams.set("include_adult", "false");
      url.searchParams.set("page", String(page));
      if (options.sortBy) {
        url.searchParams.set("sort_by", options.sortBy);
      }
      if (options.year) {
        if (options.mediaType === "movie") {
          url.searchParams.set("primary_release_year", String(options.year));
        } else {
          url.searchParams.set("first_air_date_year", String(options.year));
        }
      }
      if (options.withGenres) {
        url.searchParams.set("with_genres", options.withGenres);
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`TMDb discover failed: ${response.status}`);
      }
      const data = (await response.json()) as TmdbSearchResponse;
      const mapped = (data.results ?? [])
        .map((result) => this.mapSearchResult({ ...result, media_type: options.mediaType }))
        .filter((item): item is ProviderItem => Boolean(item));
      items.push(...mapped);
    }

    return items;
  }

  private mapSearchResult(result: TmdbSearchResult): ProviderItem | null {
    const mediaType = result.media_type === "tv" || result.media_type === "movie" ? result.media_type : undefined;
    if (!mediaType) {
      return null;
    }
    const title = mediaType === "movie" ? result.title : result.name;
    if (!title) {
      return null;
    }
    const year = this.extractYear(mediaType === "movie" ? result.release_date : result.first_air_date);
    // Detect anime: for both movies and TV shows, check if origin_country includes JP and has Animation genre
    // Note: genre_ids 16 is Animation, but we don't have genre names in search results
    // So we'll rely on fetchById to properly detect anime
    const detectedType = this.isAnime(result.genre_ids, result.origin_country, result.original_language)
      ? "anime"
      : mediaType;
    return {
      id: `tmdb-${detectedType}:${result.id}`,
      source: "tmdb",
      sourceId: `${result.id}`,
      type: detectedType,
      title,
      synopsis: result.overview ?? null,
      year,
      genres: [],
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path.startsWith("/") ? result.poster_path : `/${result.poster_path}`}`
        : null,
      // Use vote_average (user rating 0-10) instead of popularity
      // vote_average represents actual user ratings, which is more meaningful
      // Only use popularity as fallback if vote_average is null/undefined (not if it's 0, as 0 is a valid rating)
      popularityRaw: result.vote_average != null ? result.vote_average : result.popularity ?? null,
      voteCount: result.vote_count ?? null,
      providerUrl: this.buildProviderUrl(mediaType, result.id),
      availability: buildDefaultAvailability(title, detectedType, defaultLocale),
      franchiseKey: computeFranchiseKey(title),
    };
  }

  private async fetchKeywords(id: number, mediaType: TmdbMediaType): Promise<string[]> {
    if (!env.TMDB_API_KEY) {
      return [];
    }
    try {
      const base = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
      const path = mediaType === "tv" ? `/tv/${id}/keywords` : `/movie/${id}/keywords`;
      const url = new URL(`${base}${path}`);
      url.searchParams.set("api_key", env.TMDB_API_KEY);
      
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as { keywords?: Array<{ id: number; name: string }>; results?: Array<{ id: number; name: string }> };
      // TMDb returns different structures for movies vs TV: movies use "keywords", TV uses "results"
      const keywords = data.keywords ?? data.results ?? [];
      return keywords.map((k) => k.name.toLowerCase().trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async fetchCreators(id: number, mediaType: TmdbMediaType): Promise<{ creators: string[]; cast: string[] }> {
    if (!env.TMDB_API_KEY) {
      return { creators: [], cast: [] };
    }
    try {
      const base = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
      const path = mediaType === "tv" ? `/tv/${id}/credits` : `/movie/${id}/credits`;
      const url = new URL(`${base}${path}`);
      url.searchParams.set("api_key", env.TMDB_API_KEY);
      
      const response = await fetch(url);
      if (!response.ok) {
        return { creators: [], cast: [] };
      }
      const credits = (await response.json()) as TmdbCreditsResponse;
      
      const creators: string[] = [];
      
      // For TV shows: get creators from created_by (from detail) and showrunners from crew
      if (mediaType === "tv" && credits.crew) {
        const showrunners = credits.crew
          .filter((member) => member.job === "Executive Producer" || member.job === "Creator")
          .map((member) => member.name);
        creators.push(...showrunners);
      }
      
      // For movies: get directors from crew
      if (mediaType === "movie" && credits.crew) {
        const directors = credits.crew
          .filter((member) => member.job === "Director")
          .map((member) => member.name);
        creators.push(...directors);
      }
      
      // Get top 3 cast members (by order, which usually indicates importance)
      const cast: string[] = [];
      if (credits.cast && credits.cast.length > 0) {
        const topCast = credits.cast
          .slice(0, 3)
          .map((member) => member.name)
          .filter(Boolean);
        cast.push(...topCast);
      }
      
      // Remove duplicates and return
      return {
        creators: Array.from(new Set(creators)),
        cast: Array.from(new Set(cast)),
      };
    } catch {
      return { creators: [], cast: [] };
    }
  }

  private mapDetail(result: TmdbDetailResponse, mediaType: TmdbMediaType, creators: string[] = [], cast: string[] = [], tags: string[] = []): ProviderItem | null {
    const title = mediaType === "movie" ? result.title : result.name;
    if (!title) {
      return null;
    }
    const year = this.extractYear(mediaType === "movie" ? result.release_date : result.first_air_date);
    const genres = result.genres?.map((genre) => genre.name) ?? [];
    
    // Add created_by from detail response for TV shows
    const allCreators = mediaType === "tv" && result.created_by
      ? [...creators, ...result.created_by.map((c) => c.name)]
      : creators;
    const uniqueCreators = Array.from(new Set(allCreators));
    
    // Detect anime based on genres and country of origin (for both movies and TV shows)
    // More strict detection: must have Animation genre AND be from Japan
    const isAnimation = genres.some((g) => {
      const genreLower = g.toLowerCase();
      return genreLower === "animation" || genreLower === "anime" || genreLower === "anime & manga";
    });
    const originCountries = mediaType === "tv" 
      ? result.origin_country ?? []
      : result.production_countries?.map((c) => c.iso_3166_1) ?? [];
    const isJapanese = originCountries.includes("JP") || result.original_language === "ja";
    // Detect anime for both movies and TV shows
    // Only classify as anime if it has Animation genre AND is Japanese
    const detectedType = isAnimation && isJapanese ? "anime" : mediaType;
    return {
      id: `tmdb-${detectedType}:${result.id}`,
      source: "tmdb",
      sourceId: `${result.id}`,
      type: detectedType,
      title,
      synopsis: result.overview ?? null,
      year,
      genres,
      tags: tags.length > 0 ? tags : undefined,
      creators: uniqueCreators.length > 0 ? uniqueCreators : undefined,
      cast: cast.length > 0 ? cast : undefined,
      posterUrl: result.poster_path
        ? `${TMDB_IMAGE_BASE}${result.poster_path.startsWith("/") ? result.poster_path : `/${result.poster_path}`}`
        : null,
      // Use vote_average (user rating 0-10) instead of popularity
      // vote_average represents actual user rating, which is more meaningful
      // Only use popularity as fallback if vote_average is null/undefined (not if it's 0, as 0 is a valid rating)
      popularityRaw: result.vote_average != null ? result.vote_average : result.popularity ?? null,
      voteCount: result.vote_count ?? null,
      providerUrl: result.homepage ?? this.buildProviderUrl(mediaType, result.id),
      availability: buildDefaultAvailability(title, detectedType, defaultLocale),
      franchiseKey: computeFranchiseKey(title),
    };
  }

  private async fetchWatchAvailability(
    id: number,
    mediaType: TmdbMediaType,
    title: string,
    detectedType: ProviderItem["type"],
    locale: Locale,
  ): Promise<AvailabilityLink[]> {
    if (!env.TMDB_API_KEY) {
      return [];
    }
    const base = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
    const path = mediaType === "tv" ? `/tv/${id}/watch/providers` : `/movie/${id}/watch/providers`;
    const url = new URL(`${base}${path}`);
    url.searchParams.set("api_key", env.TMDB_API_KEY);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return [];
      }
      const data = (await response.json()) as TmdbWatchProvidersResponse;
      const region = getLocaleConfig(locale).tmdbRegion;
      const regionData = data.results?.[region];
      if (!regionData) {
        return [];
      }

      type AvailabilityLinkType = NonNullable<ProviderItem["availability"]>[number]["type"];

      const typePriority: Record<AvailabilityLinkType, number> = {
        stream: 3,
        rent: 2,
        buy: 1,
        read: 0,
      };

      const aggregated = new Map<
        number,
        {
          link: AvailabilityLink;
          priority: number;
          displayPriority: number;
        }
      >();

      const collect = (offers: TmdbWatchProvider[] | undefined, type: AvailabilityLinkType) => {
        if (!offers?.length) {
          return;
        }
        offers.forEach((offer) => {
          const link = buildProviderAvailability(offer.provider_name, type, title, locale);
          if (!link) {
            return;
          }
          const existing = aggregated.get(offer.provider_id);
          const newPriority = typePriority[type] ?? 0;
          if (!existing || newPriority > existing.priority) {
            aggregated.set(offer.provider_id, {
              link,
              priority: newPriority,
              displayPriority: offer.display_priority ?? 999,
            });
          }
        });
      };

      collect(regionData.flatrate, "stream");
      collect(regionData.subscription, "stream");
      collect(regionData.ads, "stream");
      collect(regionData.free, "stream");
      collect(regionData.buy, "buy");
      collect(regionData.rent, "rent");

      return Array.from(aggregated.values())
        .sort((a, b) => a.displayPriority - b.displayPriority || b.priority - a.priority)
        .map((entry) => entry.link);
    } catch {
      return [];
    }
  }

  private buildProviderUrl(mediaType: TmdbMediaType, id: number): string {
    return mediaType === "movie" ? `https://www.themoviedb.org/movie/${id}` : `https://www.themoviedb.org/tv/${id}`;
  }

  private extractYear(date?: string | null): number | undefined {
    if (!date) {
      return undefined;
    }
    const parsed = Number.parseInt(date.slice(0, 4), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Detects if a movie or TV show is anime based on genre IDs and country/language of origin.
   * Genre ID 16 = Animation in TMDb.
   * This is a best-effort detection for search results (which don't have full genre names).
   * For movies, originCountry may be undefined, so we rely on originalLanguage.
   */
  private isAnime(genreIds?: number[], originCountry?: string[], originalLanguage?: string): boolean {
    if (!genreIds || !genreIds.includes(16)) {
      // No Animation genre
      return false;
    }
    // Check if it's from Japan (originCountry for TV shows, originalLanguage for both)
    const isJapanese = originCountry?.includes("JP") || originalLanguage === "ja";
    return isJapanese;
  }

  async fetchLocalizations(id: string, localesToFetch: Locale[]): Promise<ProviderItemLocalization[]> {
    if (!env.TMDB_API_KEY) {
      return [];
    }
    const [prefixedType, rawId] = id.split(":");
    const numericId = Number.parseInt(rawId ?? "", 10);
    if (!Number.isFinite(numericId)) {
      return [];
    }
    const baseType = prefixedType === "anime" ? "tv" : (prefixedType as TmdbMediaType);
    const localizations: ProviderItemLocalization[] = [];
    for (const locale of localesToFetch) {
      const detail = await this.fetchDetailWithLanguage(numericId, baseType, locale);
      if (!detail) {
        continue;
      }
      const mapped = this.mapDetail(detail.detail, baseType, [], []);
      if (!mapped) {
        continue;
      }
      const availability = await this.fetchWatchAvailability(detail.detail.id, baseType, mapped.title, mapped.type, locale);
      const localization = createLocalizationPayload(
        locale,
        mapped.title,
        mapped.type,
        mapped.synopsis,
        availability.length ? availability : undefined,
      );
      localizations.push(localization);
    }
    return localizations;
  }

  private async fetchDetailWithLanguage(
    id: number,
    mediaType: TmdbMediaType,
    locale: Locale,
  ): Promise<{ detail: TmdbDetailResponse } | null> {
    if (!env.TMDB_API_KEY) {
      return null;
    }
    const base = env.TMDB_API_BASE ?? "https://api.themoviedb.org/3";
    const path = mediaType === "tv" ? `/tv/${id}` : `/movie/${id}`;
    const url = new URL(`${base}${path}`);
    url.searchParams.set("api_key", env.TMDB_API_KEY);
    url.searchParams.set("language", getLocaleConfig(locale).tmdbLanguage);
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as TmdbDetailResponse;
    return { detail: data };
  }
}
