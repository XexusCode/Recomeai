import { Prisma, type Source } from "@prisma/client";

import { getEmbeddings } from "@/server/embeddings";
import { prisma } from "@/server/db/client";
import { searchProviders, getProvider } from "@/server/providers/registry";
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
  const local = await findLocalSeed(query, filters);
  if (local) {
    return local;
  }

  const providerItem = await resolveFromProviders(query, filters);
  if (!providerItem) {
    const embeddings = getEmbeddings();
    const [vector] = await embeddings.embed([query]);
    return { embedding: vector ?? [], anchor: null, providerFallback: null };
  }

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
  const row = await prisma.$queryRaw<{
    embedding: string;
    id: string;
    sourceId: string;
    title: string;
    type: string;
    year: number | null;
    genres: string[];
    synopsis: string | null;
    posterUrl: string | null;
    popularity: number;
    providerUrl: string | null;
    availability: unknown;
    franchiseKey: string | null;
    source: string;
  } | null>(Prisma.sql`
    SELECT
      i.id,
      i."sourceId",
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
  
  // $queryRaw returns an array, so we need to take the first element
  const result = Array.isArray(row) ? row[0] : row;
  if (!result) {
    return null;
  }
  
  const embedding = parseVector(result.embedding);
  let anchor: RecommendationPayload = {
    id: result.id,
    title: result.title,
    type: result.type as RecommendationPayload["type"],
    year: result.year,
    genres: result.genres ?? [],
    synopsis: result.synopsis,
    posterUrl: result.posterUrl,
    popularity: result.popularity ?? 0,
    providerUrl: result.providerUrl,
    availability: (result.availability ?? []) as RecommendationPayload["availability"],
    franchiseKey: result.franchiseKey ?? null,
    source: result.source as Source,
    reason: undefined,
    score: 1,
  };

  // Always enrich TMDb anchors to ensure we have the correct posterUrl
  // TMDb URLs can become stale or the image might not exist
  if (result.source === "tmdb" && result.sourceId) {
    const provider = getProvider("tmdb");
    if (provider && typeof provider.fetchById === "function") {
      try {
        // For TMDb, we need format "movie:123" or "tv:123"
        const fetchId = anchor.type
          ? `${anchor.type === "anime" ? "tv" : anchor.type}:${result.sourceId}`
          : `movie:${result.sourceId}`;
        const enriched = await provider.fetchById(fetchId);
        if (enriched?.posterUrl && !isMalformedPosterUrl(enriched.posterUrl)) {
          anchor.posterUrl = enriched.posterUrl;
        } else if (enriched?.posterUrl) {
          // Still use it if it's the only option
          anchor.posterUrl = enriched.posterUrl;
        }
      } catch (error) {
        // Keep existing posterUrl on error
      }
    }
  } else if (!anchor.posterUrl && result.source && result.sourceId) {
    // For non-TMDb sources, only enrich if posterUrl is missing
    const provider = getProvider(result.source as ProviderItem["source"]);
    if (provider && typeof provider.fetchById === "function") {
      try {
        const fetchId = result.sourceId;
        const enriched = await provider.fetchById(fetchId);
        if (enriched?.posterUrl && !isMalformedPosterUrl(enriched.posterUrl)) {
          anchor.posterUrl = enriched.posterUrl;
        }
      } catch (error) {
        // Silently fail
      }
    }
  }

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

function isMalformedPosterUrl(url: string | null | undefined): boolean {
  if (!url) {
    return true;
  }
  // Check for TMDb URLs with malformed filenames
  if (url.includes("image.tmdb.org")) {
    // Validate URL format - should be https://image.tmdb.org/t/p/w500/filename.jpg
    const match = url.match(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+\/([^/]+)\.(jpg|jpeg|png|webp)$/i);
    if (!match) {
      return true; // Invalid format
    }
    const filename = match[1];
    // TMDb filenames are alphanumeric, typically 8-27 characters
    // Only reject if it's clearly malformed (contains invalid chars or is too short)
    return filename.length < 8 || !/^[a-zA-Z0-9]+$/.test(filename);
  }
  return false;
}

