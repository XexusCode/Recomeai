import { enabledProviders } from "@/env";
import {
  ProviderItem,
  ProviderName,
  ProviderSearchOptions,
  Suggestion,
} from "@/lib/types";
import { normalizeForComparison } from "@/lib/text";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { AnilistProvider } from "@/server/providers/anilist";
import { ContentProvider } from "@/server/providers/base";
import { GoogleBooksProvider } from "@/server/providers/googleBooks";
import { MockProvider } from "@/server/providers/mock";
import { OmdbProvider } from "@/server/providers/omdb";
import { TmdbProvider } from "@/server/providers/tmdb";

let cachedProviders: Map<ProviderName, ContentProvider> | null = null;

function instantiateProviders(): Map<ProviderName, ContentProvider> {
  if (cachedProviders) {
    return cachedProviders;
  }
  const map = new Map<ProviderName, ContentProvider>();
  if (enabledProviders.has("mock")) {
    map.set("mock", new MockProvider());
  }
  if (enabledProviders.has("omdb")) {
    map.set("omdb", new OmdbProvider());
  }
  if (enabledProviders.has("anilist")) {
    map.set("anilist", new AnilistProvider());
  }
  if (enabledProviders.has("googlebooks")) {
    map.set("googlebooks", new GoogleBooksProvider());
  }
  if (enabledProviders.has("tmdb" as ProviderName)) {
    map.set("tmdb" as ProviderName, new TmdbProvider());
  }
  cachedProviders = map;
  return map;
}

export function getProviders(): ContentProvider[] {
  return Array.from(instantiateProviders().values());
}

export function getProvider(name: ProviderName): ContentProvider | undefined {
  return instantiateProviders().get(name);
}

export async function searchProviders(
  query: string,
  options: ProviderSearchOptions & { providers?: ProviderName[] } = {},
): Promise<ProviderItem[]> {
  const providers = options.providers
    ? options.providers
        .map((name) => getProvider(name))
        .filter((provider): provider is ContentProvider => Boolean(provider))
    : getProviders();
  const promises = providers
    .filter((provider) => provider.supports(options.type ?? "any"))
    .map((provider) =>
      provider
        .search(query, options)
        .then((items) => {
          // Filter out non-Latin titles immediately after search
          const filtered = items.filter((item) => {
            const isValid = hasLatinCharacters(item.title);
            if (!isValid && item.title) {
              console.warn(`[Provider ${provider.name}] Filtered non-Latin title: "${item.title}"`);
            }
            return isValid;
          });
          return filtered.map((item) => ({ ...item, source: provider.name }));
        })
        .catch(() => []),
    );
  const results = await Promise.all(promises);
  return results.flat();
}

export function toSuggestions(items: ProviderItem[], limit = 12, query?: string): Suggestion[] {
  const seen = new Set<string>();
  const allSuggestions: Array<{ suggestion: Suggestion; score: number }> = [];
  
  // Normalize query for comparison
  const normalizedQuery = query ? normalizeForComparison(query).toLowerCase() : "";
  
  for (const item of items) {
    // Filter out non-Latin titles (STRICT: reject any title with non-Latin characters)
    // Double-check to ensure no non-Latin titles slip through
    if (!item.title || !item.title.trim() || !hasLatinCharacters(item.title)) {
      // Log filtered items for debugging
      if (item.title && item.title.trim()) {
        console.warn(`[toSuggestions] Filtered non-Latin title: "${item.title}"`);
      }
      continue;
    }
    
    const key = `${normalizeForComparison(item.title)}-${item.year ?? ""}-${item.type}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    
    const suggestion: Suggestion = {
      id: item.id,
      title: item.title,
      type: item.type,
      year: item.year ?? null,
      source: item.source,
      sourceId: item.sourceId,
      titleLang: item.titleLang,
      posterUrl: item.posterUrl ?? null,
    };
    
    // Calculate relevance score for sorting
    let score = 0;
    if (normalizedQuery) {
      const normalizedTitle = normalizeForComparison(item.title).toLowerCase();
      
      // Exact match (case-insensitive): highest priority
      if (normalizedTitle === normalizedQuery) {
        score = 1000;
      }
      // Starts with query: high priority
      else if (normalizedTitle.startsWith(normalizedQuery)) {
        score = 500;
      }
      // Contains query: medium priority
      else if (normalizedTitle.includes(normalizedQuery)) {
        score = 100;
      }
      // Word boundary match: lower priority
      else if (normalizedTitle.split(/\s+/).some(word => word.startsWith(normalizedQuery))) {
        score = 50;
      }
      // No match: lowest priority
      else {
        score = 0;
      }
    }
    
    allSuggestions.push({ suggestion, score });
  }
  
  // Sort by score (descending), then by original order for same score
  allSuggestions.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // If same score, maintain original order (items come pre-sorted by providers)
    return 0;
  });
  
  // Return top suggestions up to limit
  return allSuggestions.slice(0, limit).map(({ suggestion }) => suggestion);
}

