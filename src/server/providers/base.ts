import { env, enabledProviders } from "@/env";
import { ProviderItem, ProviderItemLocalization, ProviderName, ProviderSearchOptions } from "@/lib/types";
import type { Locale } from "@/i18n/config";

export interface ContentProvider {
  readonly name: ProviderName;
  search(query: string, options?: ProviderSearchOptions): Promise<ProviderItem[]>;
  fetchById?(id: string): Promise<ProviderItem | null>;
  fetchLocalizations?(id: string, locales: Locale[]): Promise<ProviderItemLocalization[]>;
  supports(type: ProviderSearchOptions["type"]): boolean;
}

export async function providerFetch<T>(
  input: string | URL,
  init?: RequestInit,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Provider request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function providerEnabled(name: ProviderName): boolean {
  return enabledProviders.has(name);
}

export function filterByType(
  items: ProviderItem[],
  type?: ProviderSearchOptions["type"],
): ProviderItem[] {
  if (!type || type === "any") {
    return items;
  }
  return items.filter((item) => {
    if (type === "series") {
      return item.type === "tv";
    }
    return item.type === type;
  });
}

