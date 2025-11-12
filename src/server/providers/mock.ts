import fs from "node:fs";
import path from "node:path";

import { ProviderItem, ProviderSearchOptions } from "@/lib/types";
import { ContentProvider } from "@/server/providers/base";

interface SeedItem {
  id: string;
  source: string;
  sourceId: string;
  type: ProviderItem["type"];
  title: string;
  year?: number;
  genres?: string[];
  synopsis?: string;
  popularity?: number;
  popularityRaw?: number;
  posterUrl?: string;
  franchiseKey?: string;
  providerUrl?: string;
  availability?: ProviderItem["availability"];
}

let cache: ProviderItem[] | null = null;

function loadSeed(): ProviderItem[] {
  if (cache) {
    return cache;
  }
  const filePath = path.join(process.cwd(), "prisma", "seed", "seed.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw) as SeedItem[];
  cache = parsed.map((item) => ({
    id: item.id,
    source: "mock",
    sourceId: item.sourceId,
    type: item.type,
    title: item.title,
    year: item.year,
    genres: item.genres ?? [],
    synopsis: item.synopsis ?? null,
    posterUrl: item.posterUrl ?? null,
    popularityRaw: item.popularityRaw ?? null,
    providerUrl: item.providerUrl ?? null,
    availability: item.availability ?? [],
    franchiseKey: item.franchiseKey ?? null,
  }));
  return cache;
}

export class MockProvider implements ContentProvider {
  readonly name = "mock" as const;

  supports(): boolean {
    return true;
  }

  async search(query: string, options: ProviderSearchOptions = {}): Promise<ProviderItem[]> {
    const lower = query.toLowerCase();
    const results = loadSeed().filter((item) => {
      if (options.type && options.type !== "any") {
        const normalizedType = options.type === "series" ? "tv" : options.type;
        if (item.type !== normalizedType) return false;
      }
      return item.title.toLowerCase().includes(lower);
    });
    return results.slice(0, options.limit ?? 20);
  }

  async fetchById(id: string): Promise<ProviderItem | null> {
    return loadSeed().find((item) => item.id === id) ?? null;
  }
}

