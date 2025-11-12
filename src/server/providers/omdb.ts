import { env } from "@/env";
import { buildDefaultAvailability } from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import { ProviderItem, ProviderSearchOptions } from "@/lib/types";
import { ContentProvider, providerFetch } from "@/server/providers/base";
import { defaultLocale } from "@/i18n/config";

type OmdbType = "movie" | "series" | "episode";

interface OmdbSearchResponse {
  Search?: Array<{
    imdbID: string;
    Title: string;
    Year?: string;
    Type: OmdbType;
    Poster?: string;
  }>;
  Error?: string;
}

interface OmdbDetailResponse {
  imdbID: string;
  Title: string;
  Year?: string;
  Type: OmdbType;
  Plot?: string;
  Genre?: string;
  imdbRating?: string;
  Poster?: string;
  Website?: string;
}

const typeMap: Record<OmdbType, ProviderItem["type"]> = {
  movie: "movie",
  series: "tv",
  episode: "tv",
};

export class OmdbProvider implements ContentProvider {
  readonly name = "omdb" as const;

  supports(type: ProviderSearchOptions["type"]): boolean {
    if (!env.OMDB_API_KEY) return false;
    if (!type || type === "any") return true;
    return type === "movie" || type === "tv" || type === "series";
  }

  async search(query: string, options: ProviderSearchOptions = {}): Promise<ProviderItem[]> {
    if (!env.OMDB_API_KEY) {
      return [];
    }
    const typeParam = options.type === "tv" || options.type === "series" ? "series" : options.type === "movie" ? "movie" : undefined;
    const url = new URL(env.OMDB_API_URL ?? "https://www.omdbapi.com/");
    url.searchParams.set("apikey", env.OMDB_API_KEY);
    url.searchParams.set("s", query);
    if (typeParam) {
      url.searchParams.set("type", typeParam);
    }
    const data = await providerFetch<OmdbSearchResponse>(url);
    if (!data.Search) {
      return [];
    }
    const limit = options.limit ?? 10;
    return data.Search.slice(0, limit).map((item) => this.mapSearchItem(item));
  }

  async fetchById(id: string): Promise<ProviderItem | null> {
    if (!env.OMDB_API_KEY) {
      return null;
    }
    const url = new URL(env.OMDB_API_URL ?? "https://www.omdbapi.com/");
    url.searchParams.set("apikey", env.OMDB_API_KEY);
    url.searchParams.set("i", id);
    url.searchParams.set("plot", "short");
    const data = await providerFetch<OmdbDetailResponse>(url);
    if (!data?.imdbID || !typeMap[data.Type]) {
      return null;
    }
    return this.mapDetailItem(data);
  }

  private mapSearchItem(item: NonNullable<OmdbSearchResponse["Search"]>[number]): ProviderItem {
    const year = parseInt((item.Year ?? "").slice(0, 4), 10);
    return {
      id: `omdb-${item.imdbID}`,
      sourceId: item.imdbID,
      source: "omdb",
      type: typeMap[item.Type],
      title: item.Title,
      year: Number.isFinite(year) ? year : undefined,
      genres: [],
      synopsis: null,
      posterUrl: item.Poster && item.Poster !== "N/A" ? item.Poster : null,
      providerUrl: `https://www.imdb.com/title/${item.imdbID}`,
      availability: buildDefaultAvailability(item.Title, typeMap[item.Type], defaultLocale),
    };
  }

  private mapDetailItem(item: OmdbDetailResponse): ProviderItem {
    const type = typeMap[item.Type];
    const year = parseInt((item.Year ?? "").slice(0, 4), 10);
    const genres = item.Genre ? item.Genre.split(",").map((entry) => entry.trim()) : [];
    const popularityRaw = item.imdbRating ? Number.parseFloat(item.imdbRating) : undefined;
    const providerUrl = item.Website && item.Website !== "N/A" ? item.Website : `https://www.imdb.com/title/${item.imdbID}`;
    return {
      id: `omdb-${item.imdbID}`,
      source: "omdb",
      sourceId: item.imdbID,
      type,
      title: item.Title,
      year: Number.isFinite(year) ? year : undefined,
      synopsis: item.Plot && item.Plot !== "N/A" ? item.Plot : null,
      genres,
      posterUrl: item.Poster && item.Poster !== "N/A" ? item.Poster : null,
      popularityRaw,
      providerUrl,
      availability: buildDefaultAvailability(item.Title, type, defaultLocale),
      franchiseKey: computeFranchiseKey(item.Title),
    } as ProviderItem;
  }
}

