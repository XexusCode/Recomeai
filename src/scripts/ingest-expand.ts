import "dotenv/config";

import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { requireDatabaseUrl } from "@/env";
import { buildDefaultAvailability } from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import { normalizePopularityBatch } from "@/lib/popularity";
import type { ProviderItem, ProviderItemLocalization, ProviderName, ProviderSearchOptions } from "@/lib/types";
import { getEmbeddings } from "@/server/embeddings";
import { prisma } from "@/server/db/client";
import { getProvider } from "@/server/providers/registry";
import type { ContentProvider } from "@/server/providers/base";
import { TmdbProvider } from "@/server/providers/tmdb";
import { GoogleBooksProvider } from "@/server/providers/googleBooks";
import { AnilistProvider } from "@/server/providers/anilist";
import { OmdbProvider } from "@/server/providers/omdb";
import { MockProvider } from "@/server/providers/mock";
import { defaultLocale, isLocale, locales, type Locale } from "@/i18n/config";

interface CliOptions {
  provider: string;
  query?: string;
  limit: number;
  type?: "movie" | "tv" | "anime" | "book" | "series" | "any";
  discover?: {
    mediaType?: "movie" | "tv";
    pages: number;
    year?: number;
    sortBy?: string;
    genre?: string;
    category?: string; // For Google Books
  };
}

async function main() {
  requireDatabaseUrl();
  const options = parseCli();
  const provider = getProvider(options.provider as any);
  if (!provider) {
    throw new Error(`Provider ${options.provider} is not enabled`);
  }

  let results: ProviderItem[] = [];
  if (options.discover) {
    if (provider instanceof TmdbProvider) {
      if (!options.discover.mediaType) {
        throw new Error("--discover requires --mediaType for tmdb provider");
      }
      results = await provider.discover({
        mediaType: options.discover.mediaType,
        pages: options.discover.pages,
        sortBy: options.discover.sortBy,
        year: options.discover.year,
        withGenres: options.discover.genre,
      });
      if (options.limit) {
        results = results.slice(0, options.limit);
      }
    } else if (provider instanceof GoogleBooksProvider) {
      results = await provider.discover({
        category: options.discover.category,
        year: options.discover.year,
        pages: options.discover.pages,
        limit: options.limit,
      });
    } else {
      throw new Error("Discover mode is only supported for tmdb and googlebooks providers");
    }
  } else if (options.query) {
    results = await provider.search(options.query, { limit: options.limit, type: options.type });
  } else {
    throw new Error("Either --query or --discover must be provided");
  }

  if (options.type && options.type !== "any") {
    const normalizedType = options.type === "series" ? "tv" : options.type;
    results = results.filter((item) => item.type === normalizedType);
  }

  if (!results.length) {
    console.warn("No items returned by provider");
    return;
  }

  // Always enrich items from discover (they come truncated from TMDb)
  // Also enrich for TMDb search results as they may be truncated
  const shouldAlwaysEnrich = Boolean(options.discover || (provider.name === "tmdb" && options.query));
  const items = await enrichResults(results, provider, shouldAlwaysEnrich);

  const popularity = normalizePopularityBatch(items);
  const embeddings = getEmbeddings();
  const texts = items.map((item) => buildEmbeddingText(item.title, item.genres, item.synopsis));
  const vectors = await embeddings.embed(texts);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const vector = vectors[index] ?? [];
    const vectorLiteral = embeddingToLiteral(vector);
    const genres = item.genres ?? [];
    const synopsis = item.synopsis ?? null;
    const itemSource = item.source ?? "mock";
    const itemType = item.type ?? "movie";
    const itemId = item.id ?? `${itemSource}-${item.sourceId ?? computeFranchiseKey(item.title) ?? index}`;
    const sourceId = item.sourceId ?? itemId;
    const availability = JSON.stringify(
      item.availability ?? buildDefaultAvailability(item.title, itemType as any, defaultLocale),
    );
    const franchiseKey = item.franchiseKey ?? computeFranchiseKey(item.title);
    const tsvectorInput = `${item.title} ${genres.join(" ")} ${synopsis ?? ""}`;
    const escapedTsvectorInput = tsvectorInput.replace(/'/g, "''");

    const genresArrayLiteral = genres.length > 0
      ? `ARRAY[${genres.map((g) => `'${String(g).replace(/'/g, "''")}'`).join(",")}]::TEXT[]`
      : `'{}'::TEXT[]`;
    const genresArray = Prisma.raw(genresArrayLiteral);

    // If type changed (e.g., from tv to anime), we need to delete the old record first
    // because the ID changed but (source, sourceId) is the same
    if (itemSource === "tmdb" && (itemType === "anime" || itemType === "tv")) {
      // Check if there's an existing record with different type
      const existing = await prisma.$queryRaw<Array<{ id: string; type: string }>>`
        SELECT id, type::text FROM "Item"
        WHERE source = ${Prisma.raw(`'${itemSource.replace(/'/g, "''")}'::"Source"`)}
          AND "sourceId" = ${sourceId}
        LIMIT 1
      `;
      if (existing.length > 0 && existing[0].type !== itemType && existing[0].id !== itemId) {
        // Type changed, delete old record with different ID
        await prisma.$executeRaw`
          DELETE FROM "Item"
          WHERE id = ${existing[0].id}
        `;
      }
    }

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Item" (
        id,
        source,
        "sourceId",
        type,
        title,
        "titleNorm",
        year,
        genres,
        synopsis,
        popularity,
        "popularityRaw",
        "posterUrl",
        "franchiseKey",
        embedding,
        availability,
        "providerUrl",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${itemId},
        ${Prisma.raw(`'${itemSource.replace(/'/g, "''")}'::"Source"`)},
        ${sourceId},
        ${Prisma.raw(`'${itemType.replace(/'/g, "''")}'::"ItemType"`)},
        ${item.title},
        ${Prisma.raw(`to_tsvector('english', '${escapedTsvectorInput}')`)},
        ${item.year ?? null},
        ${genresArray},
        ${synopsis},
        ${popularity[index] ?? 0},
        ${item.popularityRaw ?? null},
        ${item.posterUrl ?? null},
        ${franchiseKey || null},
        ${Prisma.raw(vectorLiteral)},
        ${Prisma.raw(`'${availability.replace(/'/g, "''")}'::jsonb`)},
        ${item.providerUrl ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT ("source", "sourceId") DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        "titleNorm" = EXCLUDED."titleNorm",
        year = EXCLUDED.year,
        genres = EXCLUDED.genres,
        synopsis = EXCLUDED.synopsis,
        popularity = EXCLUDED.popularity,
        "popularityRaw" = EXCLUDED."popularityRaw",
        "posterUrl" = EXCLUDED."posterUrl",
        "franchiseKey" = EXCLUDED."franchiseKey",
        embedding = EXCLUDED.embedding,
        availability = EXCLUDED.availability,
        "providerUrl" = EXCLUDED."providerUrl",
        "updatedAt" = NOW();
    `);

    const localizationEntries = buildLocalizationEntries(item);
    for (const localization of localizationEntries) {
      const localizationId = `loc_${randomUUID().replace(/-/g, "")}`;
      const availabilityJson = JSON.stringify(localization.availability ?? []);
      const availabilityValue = Prisma.raw(`'${availabilityJson.replace(/'/g, "''")}'::jsonb`);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO "ItemLocalization" (
          "id",
          "itemId",
          "locale",
          "title",
          "synopsis",
          "availability",
          "reason",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${localizationId},
          ${itemId},
          ${localization.locale},
          ${localization.title},
          ${localization.synopsis ?? null},
          ${availabilityValue},
          ${localization.reason ?? null},
          NOW(),
          NOW()
        )
        ON CONFLICT ("itemId", "locale") DO UPDATE SET
          title = EXCLUDED.title,
          synopsis = EXCLUDED.synopsis,
          availability = EXCLUDED.availability,
          reason = COALESCE(EXCLUDED.reason, "ItemLocalization"."reason"),
          "updatedAt" = NOW();
      `);
    }

    console.log(`Upserted ${item.title} [${itemSource}:${sourceId}]`);
  }

  await prisma.$disconnect();
  console.log(`Ingested ${results.length} items from ${options.provider}`);
}

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const options: Partial<CliOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[index + 1];
    switch (key) {
      case "provider":
        options.provider = value;
        index += 1;
        break;
      case "query":
        options.query = value;
        index += 1;
        break;
      case "limit":
        options.limit = Number.parseInt(value, 10);
        index += 1;
        break;
      case "type":
        options.type = value as CliOptions["type"];
        index += 1;
        break;
      case "discover":
        options.discover = {
          pages: 1,
        };
        // For TMDb, value should be "movie" or "tv"
        // For Google Books, no value needed
        if (value && (value === "movie" || value === "tv")) {
          options.discover.mediaType = value as "movie" | "tv";
          index += 1;
        }
        break;
      case "pages":
        if (!options.discover) {
          throw new Error("--pages can only be used with --discover");
        }
        options.discover.pages = Math.max(1, Number.parseInt(value, 10) || 1);
        index += 1;
        break;
      case "year":
        if (!options.discover) {
          throw new Error("--year can only be used with --discover");
        }
        options.discover.year = Number.parseInt(value, 10);
        index += 1;
        break;
      case "genre":
        if (!options.discover) {
          throw new Error("--genre can only be used with --discover");
        }
        options.discover.genre = value;
        index += 1;
        break;
      case "category":
        if (!options.discover) {
          throw new Error("--category can only be used with --discover");
        }
        options.discover.category = value;
        index += 1;
        break;
      case "sort":
      case "sortBy":
        if (!options.discover) {
          throw new Error("--sortBy can only be used with --discover");
        }
        options.discover.sortBy = value;
        index += 1;
        break;
      default:
        break;
    }
  }
  if (!options.provider) {
    throw new Error("--provider is required");
  }
  if (options.discover && options.provider !== "tmdb" && options.provider !== "googlebooks") {
    throw new Error("--discover is only supported for the tmdb and googlebooks providers");
  }
  if (!options.query && !options.discover) {
    throw new Error("--query or --discover must be provided");
  }
  options.limit = options.limit && !Number.isNaN(options.limit) ? options.limit : 50;
  if (options.type && !["movie", "tv", "anime", "book", "series", "any"].includes(options.type)) {
    throw new Error(`Unsupported type filter: ${options.type}`);
  }
  if (options.discover && options.discover.mediaType && !["movie", "tv"].includes(options.discover.mediaType)) {
    throw new Error("--discover mediaType must be either 'movie' or 'tv' (only for tmdb provider)");
  }
  if (options.discover && !options.discover.pages) {
    options.discover.pages = 1;
  }
  return options as CliOptions;
}

function buildEmbeddingText(title: string, genres?: string[] | null, synopsis?: string | null): string {
  return [title, (genres ?? []).join(","), synopsis ?? ""].join("\n");
}

function embeddingToLiteral(vector: number[]): string {
  if (!vector.length) {
    return "NULL";
  }
  const values = vector.map((value) => value.toFixed(6)).join(",");
  return `'[${values}]'::vector`;
}

function hasFetchById(provider: ContentProvider): provider is ContentProvider & {
  fetchById(id: string): Promise<ProviderItem | null>;
} {
  return typeof provider.fetchById === "function";
}

async function enrichResults(results: ProviderItem[], provider: ContentProvider, alwaysEnrich = false): Promise<ProviderItem[]> {
  if (!hasFetchById(provider)) {
    return results;
  }
  return Promise.all(
    results.map(async (item) => {
      if (!alwaysEnrich && !needsEnrichment(item)) {
        return item;
      }
      const detailId = buildFetchId(item);
      if (!detailId) {
        return item;
      }
      try {
        const detailed = await provider.fetchById(detailId);
        if (detailed) {
          let merged = mergeProviderItems(item, detailed);
          if (hasFetchLocalizations(provider)) {
            try {
              const additional = await provider.fetchLocalizations(detailId, locales.filter((loc) => loc !== defaultLocale));
              if (additional.length) {
                merged = {
                  ...merged,
                  localizations: mergeLocalizationArrays(merged.localizations, additional),
                };
              }
            } catch (error) {
              console.warn(`Failed to fetch localized data for ${item.title} (${detailId})`, error);
            }
          }
          return merged;
        }
      } catch (error) {
        console.warn(`Failed to enrich ${item.title} (${detailId})`, error);
      }
      return item;
    }),
  );
}

function buildFetchId(item: ProviderItem): string | null {
  // For TMDb, we need format "movie:123" or "tv:123"
  // Note: anime is stored as type "anime" but TMDb API uses "tv" endpoint
  if (item.source === "tmdb" && item.sourceId) {
    const tmdbType = item.type === "anime" ? "tv" : item.type;
    return `${tmdbType}:${item.sourceId}`;
  }
  // For other providers, use sourceId or id
  return item.sourceId ?? item.id ?? null;
}

function needsEnrichment(item: ProviderItem): boolean {
  const missingSynopsis = !item.synopsis || !item.synopsis.trim();
  // TMDb often truncates overviews in search/discover results (usually ~200 chars max)
  // Consider synopsis truncated if it's less than 150 chars and we have a sourceId
  const synopsisTooShort = Boolean(item.synopsis && item.synopsis.length < 150 && item.sourceId);
  const missingGenres = !item.genres || item.genres.length === 0;
  const missingPopularity = item.popularityRaw == null;
  const missingPoster = !item.posterUrl;
  return missingSynopsis || synopsisTooShort || missingGenres || missingPopularity || missingPoster;
}

function mergeProviderItems(base: ProviderItem, detail: ProviderItem): ProviderItem {
  // Prefer longer synopsis (detail endpoint usually has full text)
  const synopsis = (() => {
    const baseLen = base.synopsis?.length ?? 0;
    const detailLen = detail.synopsis?.length ?? 0;
    if (detailLen > baseLen) {
      return detail.synopsis;
    }
    return base.synopsis ?? detail.synopsis;
  })();

  // Use the detected type from detail (which may have detected anime)
  const finalType = detail.type ?? base.type;
  // Update ID if type changed (e.g., from "tv" to "anime")
  const finalId = (() => {
    if (base.id && detail.id && base.id !== detail.id && base.sourceId === detail.sourceId) {
      // Type changed, use the detail ID which has the correct type
      return detail.id;
    }
    return base.id ?? detail.id;
  })();

  return {
    ...base,
    ...detail,
    id: finalId,
    source: base.source ?? detail.source,
    sourceId: base.sourceId ?? detail.sourceId,
    type: finalType,
    title: detail.title ?? base.title,
    year: detail.year ?? base.year,
    synopsis,
    genres: detail.genres && detail.genres.length ? detail.genres : base.genres,
    posterUrl: detail.posterUrl ?? base.posterUrl,
    providerUrl: detail.providerUrl ?? base.providerUrl,
    availability: detail.availability && detail.availability.length ? detail.availability : base.availability,
    popularityRaw: detail.popularityRaw ?? base.popularityRaw,
    franchiseKey: detail.franchiseKey ?? base.franchiseKey,
    localizations: mergeLocalizationArrays(base.localizations, detail.localizations),
  };
}

function mergeLocalizationArrays(
  base?: ProviderItemLocalization[] | null,
  detail?: ProviderItemLocalization[] | null,
): ProviderItemLocalization[] | undefined {
  if ((!base || base.length === 0) && (!detail || detail.length === 0)) {
    return undefined;
  }
  const map = new Map<string, ProviderItemLocalization>();
  for (const entry of base ?? []) {
    map.set(entry.locale, { ...entry, availability: entry.availability ?? [] });
  }
  for (const entry of detail ?? []) {
    map.set(entry.locale, {
      ...entry,
      availability: entry.availability ?? map.get(entry.locale)?.availability ?? [],
    });
  }
  return Array.from(map.values());
}

function buildLocalizationEntries(item: ProviderItem): ProviderItemLocalization[] {
  const map = new Map<string, ProviderItemLocalization>();
  const baseLocalization: ProviderItemLocalization = {
    locale: defaultLocale,
    title: item.title,
    synopsis: item.synopsis ?? null,
    availability: item.availability ?? [],
    reason: undefined,
  };
  map.set(defaultLocale, baseLocalization);

  for (const localization of item.localizations ?? []) {
    if (!isLocale(localization.locale)) {
      continue;
    }
    const existing = map.get(localization.locale);
    map.set(localization.locale, {
      locale: localization.locale,
      title: localization.title ?? existing?.title ?? item.title,
      synopsis: localization.synopsis ?? existing?.synopsis ?? item.synopsis ?? null,
      availability:
        localization.availability && localization.availability.length
          ? localization.availability
          : existing?.availability ?? item.availability ?? [],
      reason: localization.reason ?? existing?.reason ?? undefined,
    });
  }

  return Array.from(map.values());
}

function hasFetchLocalizations(
  provider: ContentProvider,
): provider is ContentProvider & {
  fetchLocalizations(id: string, locales: Locale[]): Promise<ProviderItemLocalization[]>;
} {
  return typeof provider.fetchLocalizations === "function";
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});

