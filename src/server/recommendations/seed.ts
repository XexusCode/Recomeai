import { Prisma, type Source } from "@prisma/client";

import { getEmbeddings } from "@/server/embeddings";
import { prisma } from "@/server/db/client";
import { searchProviders } from "@/server/providers/registry";
import { ProviderItem, ProviderSearchOptions, RecommendationPayload } from "@/lib/types";
import { RecommendationFilters } from "@/server/recommendations/retrieve";

export interface SeedResolution {
  embedding: number[];
  anchor: RecommendationPayload | null;
  providerFallback?: ProviderItem | null;
}

export async function resolveSeed(
  query: string,
  filters: RecommendationFilters,
): Promise<SeedResolution> {
  console.log(`[Seed] Resolving seed for query: "${query}" with filters:`, JSON.stringify(filters));
  
  const local = await findLocalSeed(query, filters);
  if (local) {
    console.log(`[Seed] Found local seed: "${local.anchor?.title}" [${local.anchor?.id}]`);
    return local;
  }
  console.log(`[Seed] No local seed found, trying providers`);

  const providerItem = await resolveFromProviders(query, filters);
  if (!providerItem) {
    console.log(`[Seed] No provider item found, using query embedding`);
    const embeddings = getEmbeddings();
    const [vector] = await embeddings.embed([query]);
    return { embedding: vector ?? [], anchor: null, providerFallback: null };
  }

  console.log(`[Seed] Found provider item: "${providerItem.title}" (${providerItem.type}) [${providerItem.id}]`);
  const embeddings = getEmbeddings();
  const text = buildEmbeddingText(providerItem);
  const [vector] = await embeddings.embed([text]);
  return {
    embedding: vector ?? [],
    anchor: providerToPayload(providerItem),
    providerFallback: providerItem,
  };
}

async function findLocalSeed(
  query: string,
  filters: RecommendationFilters,
): Promise<SeedResolution | null> {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`i.embedding IS NOT NULL`,
    Prisma.sql`similarity(i.title, ${query}) > 0.35`,
    Prisma.sql`i."titleNorm" @@ websearch_to_tsquery('english', ${query})`,
  ];
  if (filters.type) {
    const normalizedType = filters.type === "series" ? "tv" : filters.type;
    const sanitized = normalizedType.replace(/'/g, "''");
    clauses.push(Prisma.sql`i."type" = ${Prisma.raw(`'${sanitized}'::"ItemType"`)}`);
  }
  let where = clauses[0];
  for (let index = 1; index < clauses.length; index += 1) {
    where = Prisma.sql`${where} AND ${clauses[index]}`;
  }
  const row = await prisma.$queryRaw<{ embedding: string; id: string } | null>(Prisma.sql`
    SELECT
      i.id,
      i.embedding::text AS embedding,
      i.title,
      i.type,
      i.year,
      i.genres,
      i.synopsis,
      i."posterUrl",
      i.popularity,
      i."providerUrl",
      i.availability,
      i."franchiseKey",
      i.source
    FROM "Item" i
    WHERE ${where}
    ORDER BY similarity(i.title, ${query}) DESC
    LIMIT 1
  `);
  if (!row) {
    return null;
  }
  const embedding = parseVector(row.embedding);
  const anchor: RecommendationPayload = {
    id: row.id,
    title: (row as any).title,
    type: (row as any).type,
    year: (row as any).year,
    genres: (row as any).genres ?? [],
    synopsis: (row as any).synopsis,
    posterUrl: (row as any).posterUrl,
    popularity: (row as any).popularity ?? 0,
    providerUrl: (row as any).providerUrl,
    availability: ((row as any).availability ?? []) as RecommendationPayload["availability"],
    franchiseKey: (row as any).franchiseKey ?? null,
    source: (row as any).source,
    reason: undefined,
    score: 1,
  };
  return { embedding, anchor };
}

async function resolveFromProviders(
  query: string,
  filters: RecommendationFilters,
): Promise<ProviderItem | null> {
  const items = await searchProviders(query, {
    limit: 5,
    type: filters.type as ProviderSearchOptions["type"],
  });
  if (!items.length) {
    return null;
  }
  return items[0];
}

function buildEmbeddingText(item: ProviderItem): string {
  const lines = [item.title];
  if (item.genres?.length) {
    lines.push(item.genres.join(", "));
  }
  if (item.synopsis) {
    lines.push(item.synopsis);
  }
  return lines.join("\n");
}

function providerToPayload(item: ProviderItem): RecommendationPayload {
  // Map ProviderName (which can include "tmdb") to Source
  // Note: tmdb is in the Source enum in Prisma
  let mappedSource: Source | undefined;
  if (item.source === "mock") {
    mappedSource = "mock";
  } else if (item.source === "omdb") {
    mappedSource = "omdb";
  } else if (item.source === "anilist") {
    mappedSource = "anilist";
  } else if (item.source === "googlebooks") {
    mappedSource = "googlebooks";
  } else if (item.source === "tmdb") {
    mappedSource = "tmdb" as Source;
  }
  
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    year: item.year ?? null,
    genres: item.genres ?? [],
    synopsis: item.synopsis ?? null,
    posterUrl: item.posterUrl ?? null,
    popularity: 0,
    providerUrl: item.providerUrl ?? null,
    availability: item.availability ?? [],
    franchiseKey: item.franchiseKey ?? null,
    score: 0,
    source: mappedSource,
    reason: undefined,
  };
}

function parseVector(raw: string | null | undefined): number[] {
  if (!raw) {
    return [];
  }
  return raw
    .replace(/^[\[(\s]+|[\])\s]+$/g, "")
    .split(/[\s,]+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));
}

