import { env } from "@/env";
import { buildDefaultAvailability } from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import { ProviderItem, ProviderSearchOptions } from "@/lib/types";
import { ContentProvider } from "@/server/providers/base";
import { defaultLocale } from "@/i18n/config";

interface AnilistMedia {
  id: number;
  title: {
    english?: string | null;
    romaji?: string | null;
  };
  startDate?: {
    year?: number | null;
  };
  description?: string | null;
  genres?: string[] | null;
  coverImage?: {
    medium?: string | null;
  };
  averageScore?: number | null;
  popularity?: number | null;
  siteUrl?: string | null;
}

interface AnilistResponse {
  data?: {
    Page?: {
      media?: AnilistMedia[];
    };
    Media?: AnilistMedia | null;
  };
  errors?: Array<{ message: string }>;
}

const querySearch = `
  query SearchMedia($search: String!, $perPage: Int!) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id
        title {
          english
          romaji
        }
        startDate { year }
        description(asHtml: false)
        genres
        coverImage { medium }
        averageScore
        popularity
        siteUrl
      }
    }
  }
`;

const queryById = `
  query MediaById($id: Int!) {
    Media(id: $id) {
      id
      title { english romaji }
      startDate { year }
      description(asHtml: false)
      genres
      coverImage { medium }
      averageScore
      popularity
      siteUrl
    }
  }
`;

export class AnilistProvider implements ContentProvider {
  readonly name = "anilist" as const;

  supports(type: ProviderSearchOptions["type"]): boolean {
    return !type || type === "anime" || type === "any";
  }

  async search(query: string, options: ProviderSearchOptions = {}): Promise<ProviderItem[]> {
    const perPage = options.limit ?? 10;
    const payload = await this.executeGraphQL(querySearch, { search: query, perPage });
    const media = payload.data?.Page?.media ?? [];
    return media.map((item) => this.mapMedia(item));
  }

  async fetchById(id: string): Promise<ProviderItem | null> {
    const numericId = Number.parseInt(id, 10);
    if (Number.isNaN(numericId)) {
      return null;
    }
    const payload = await this.executeGraphQL(queryById, { id: numericId });
    const media = payload.data?.Media;
    if (!media) {
      return null;
    }
    return this.mapMedia(media);
  }

  private async executeGraphQL(query: string, variables: Record<string, unknown>): Promise<AnilistResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(env.ANILIST_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`AniList API error: ${response.status}`);
      }
      const json = (await response.json()) as AnilistResponse;
      if (json.errors?.length) {
        throw new Error(`AniList API error: ${json.errors.map((error) => error.message).join(", ")}`);
      }
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapMedia(media: AnilistMedia): ProviderItem {
    const title = media.title?.english?.trim() || media.title?.romaji?.trim() || "";
    const titleLang = media.title?.english ? "english" : media.title?.romaji ? "romaji" : undefined;
    const year = media.startDate?.year ?? undefined;
    const genres = media.genres?.filter(Boolean) ?? [];
    const popularityRaw = media.averageScore ?? media.popularity ?? undefined;
    const synopsis = media.description ? stripTags(media.description) : null;
    const providerUrl = media.siteUrl ?? null;
    return {
      id: `anilist-${media.id}`,
      source: "anilist",
      sourceId: String(media.id),
      type: "anime",
      title,
      titleLang,
      year,
      synopsis,
      genres,
      posterUrl: media.coverImage?.medium ?? null,
      popularityRaw,
      providerUrl,
      availability: buildDefaultAvailability(title, "anime", defaultLocale),
      franchiseKey: computeFranchiseKey(title),
    };
  }
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, " ").trim();
}

