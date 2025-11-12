import { enabledProviders } from "@/env";
import {
  ProviderItem,
  ProviderName,
  ProviderSearchOptions,
  Suggestion,
} from "@/lib/types";
import { normalizeForComparison } from "@/lib/text";
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
        .then((items) => items.map((item) => ({ ...item, source: provider.name })))
        .catch(() => []),
    );
  const results = await Promise.all(promises);
  return results.flat();
}

export function toSuggestions(items: ProviderItem[], limit = 12): Suggestion[] {
  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const item of items) {
    const key = `${normalizeForComparison(item.title)}-${item.year ?? ""}-${item.type}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push({
      id: item.id,
      title: item.title,
      type: item.type,
      year: item.year ?? null,
      source: item.source,
      sourceId: item.sourceId,
      titleLang: item.titleLang,
      posterUrl: item.posterUrl ?? null,
    });
    if (suggestions.length >= limit) {
      break;
    }
  }
  return suggestions;
}

