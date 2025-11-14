import { env } from "@/env";
import { buildDefaultAvailability } from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import { ProviderItem, ProviderSearchOptions } from "@/lib/types";
import { ContentProvider } from "@/server/providers/base";
import { defaultLocale } from "@/i18n/config";

type GoogleBooksItem = {
  id: string;
  volumeInfo?: {
    title?: string;
    publishedDate?: string;
    authors?: string[];
    categories?: string[];
    description?: string;
    infoLink?: string;
    imageLinks?: {
      thumbnail?: string;
    };
    averageRating?: number;
  };
  saleInfo?: {
    buyLink?: string;
  };
};

interface GoogleBooksResponse {
  items?: GoogleBooksItem[];
}

export class GoogleBooksProvider implements ContentProvider {
  readonly name = "googlebooks" as const;

  supports(type: ProviderSearchOptions["type"]): boolean {
    return !type || type === "book" || type === "any";
  }

  async search(query: string, options: ProviderSearchOptions = {}): Promise<ProviderItem[]> {
    const url = new URL("https://www.googleapis.com/books/v1/volumes");
    url.searchParams.set("q", query);
    url.searchParams.set("maxResults", String(Math.min(options.limit ?? 10, 20)));
    url.searchParams.set("orderBy", "relevance");
    url.searchParams.set("langRestrict", "en");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
    let data: GoogleBooksResponse = {};
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Google Books API error: ${response.status}`);
      }
      data = (await response.json()) as GoogleBooksResponse;
    } finally {
      clearTimeout(timeout);
    }
    return (data.items ?? []).map((item) => this.mapItem(item)).filter(Boolean) as ProviderItem[];
  }

  async discover(options: {
    category?: string;
    year?: number;
    pages?: number;
    limit?: number;
  }): Promise<ProviderItem[]> {
    const allItems: ProviderItem[] = [];
    const pages = Math.max(1, Math.min(options.pages ?? 1, 5)); // Google Books maxResults is 40, so we can get ~200 per category
    
    // Build query based on category and year
    let queryParts: string[] = [];
    if (options.category) {
      // Use subject: for category searches (without quotes works better)
      queryParts.push(`subject:${options.category}`);
    } else {
      // Default to fiction if no category
      queryParts.push("fiction");
    }
    if (options.year) {
      queryParts.push(`publishedDate:${options.year}`);
    }
    
    const baseQuery = queryParts.join("+");
    
    for (let page = 0; page < pages; page += 1) {
      const url = new URL("https://www.googleapis.com/books/v1/volumes");
      url.searchParams.set("q", baseQuery);
      url.searchParams.set("maxResults", "40"); // Google Books max is 40
      url.searchParams.set("startIndex", String(page * 40));
      url.searchParams.set("orderBy", "relevance");
      url.searchParams.set("langRestrict", "en");
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          console.warn(`Google Books discover failed for page ${page + 1}: ${response.status}`);
          break;
        }
        const data = (await response.json()) as GoogleBooksResponse;
        const items = (data.items ?? [])
          .map((item) => this.mapItem(item))
          .filter((item): item is ProviderItem => Boolean(item));
        allItems.push(...items);
        
        if (allItems.length >= (options.limit ?? 200)) {
          break;
        }
        
        // If we got less than 40 items, we've reached the end
        if (items.length < 40) {
          break;
        }
      } catch (error) {
        console.warn(`Google Books discover error for page ${page + 1}:`, error);
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
    
    return allItems.slice(0, options.limit ?? 200);
  }

  async fetchById(id: string): Promise<ProviderItem | null> {
    const url = new URL(`https://www.googleapis.com/books/v1/volumes/${id}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as GoogleBooksItem | null;
      return data ? this.mapItem(data) : null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapItem(item: GoogleBooksItem): ProviderItem | null {
    const title = item.volumeInfo?.title?.trim();
    if (!title) {
      return null;
    }
    const published = item.volumeInfo?.publishedDate;
    const year = published ? Number.parseInt(published.slice(0, 4), 10) : undefined;
    const synopsis = item.volumeInfo?.description ?? null;
    const genres = item.volumeInfo?.categories ?? [];
    // Use categories as tags (normalize to lowercase)
    const tags = item.volumeInfo?.categories?.map((cat) => cat.toLowerCase().trim()).filter(Boolean) ?? [];
    const popularityRaw = item.volumeInfo?.averageRating ?? null;
    const providerUrl = item.volumeInfo?.infoLink ?? item.saleInfo?.buyLink ?? null;
    const availability = [
      ...buildDefaultAvailability(title, "book", defaultLocale),
      ...(item.saleInfo?.buyLink
        ? [{ label: "Compra directa", type: "buy" as const, url: item.saleInfo.buyLink, affiliate: false }]
        : []),
    ];

    return {
      id: `googlebooks-${item.id}`,
      source: "googlebooks",
      sourceId: item.id,
      type: "book",
      title,
      year: Number.isFinite(year) ? year : undefined,
      synopsis,
      genres,
      tags: tags.length > 0 ? tags : undefined,
      posterUrl: item.volumeInfo?.imageLinks?.thumbnail ?? null,
      popularityRaw,
      providerUrl,
      availability,
      franchiseKey: computeFranchiseKey(title),
    };
  }
}

