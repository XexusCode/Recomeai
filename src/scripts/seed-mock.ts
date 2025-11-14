import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import { requireDatabaseUrl } from "@/env";
import { buildDefaultAvailability } from "@/lib/availability";
import { computeFranchiseKey } from "@/lib/franchise";
import { normalizePopularityBatch } from "@/lib/popularity";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { getEmbeddings } from "@/server/embeddings";
import { prisma } from "@/server/db/client";
import { defaultLocale } from "@/i18n/config";

interface SeedItem {
  id: string;
  source: string;
  sourceId: string;
  type: string;
  title: string;
  year?: number;
  genres?: string[];
  synopsis?: string;
  popularity?: number;
  popularityRaw?: number;
  posterUrl?: string;
  franchiseKey?: string;
  providerUrl?: string;
  availability?: unknown;
}

async function main() {
  requireDatabaseUrl();
  const seedPath = path.join(process.cwd(), "prisma", "seed", "seed.json");
  const raw = fs.readFileSync(seedPath, "utf-8");
  const items = JSON.parse(raw) as SeedItem[];

  // Add source to items for provider-specific normalization
  const itemsWithSource = items.map((item) => ({
    ...item,
    source: item.source ?? "mock",
  }));
  const popularity = normalizePopularityBatch(itemsWithSource);
  const embeddings = getEmbeddings();
  const embeddingInputs = items.map((item) => buildEmbeddingText(item));
  const embedded = await embeddings.embed(embeddingInputs);

  console.log(`Loaded ${items.length} seed items`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "Item" RESTART IDENTITY CASCADE`);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    
    // Skip items with non-Latin titles
    if (!hasLatinCharacters(item.title)) {
      console.warn(`[Seed] Skipping non-Latin title: ${item.title}`);
      continue;
    }
    
    const embedding = embedded[index] ?? [];
    const vectorLiteral = embeddingToLiteral(embedding);
    const availability = JSON.stringify(
      item.availability ?? buildDefaultAvailability(item.title, item.type as any, defaultLocale),
    );
    const genres = item.genres ?? [];
    const synopsis = item.synopsis ?? null;
    const normalizedPopularity = popularity[index] ?? item.popularity ?? 0;
    const franchiseKey = item.franchiseKey ?? computeFranchiseKey(item.title);
    const tsvectorInput = `${item.title} ${genres.join(" ")} ${synopsis ?? ""}`;
    const escapedTsvectorInput = tsvectorInput.replace(/'/g, "''");

    const genresArrayLiteral = genres.length > 0
      ? `ARRAY[${genres.map((g) => `'${String(g).replace(/'/g, "''")}'`).join(",")}]::TEXT[]`
      : `'{}'::TEXT[]`;
    const genresArray = Prisma.raw(genresArrayLiteral);
    
    const creators = (item as any).creators ?? [];
    const creatorsArrayLiteral = creators.length > 0
      ? `ARRAY[${creators.map((c: string) => `'${String(c).replace(/'/g, "''")}'`).join(",")}]::TEXT[]`
      : `'{}'::TEXT[]`;
    const creatorsArray = Prisma.raw(creatorsArrayLiteral);
    
    const cast = (item as any).cast ?? [];
    const castArrayLiteral = cast.length > 0
      ? `ARRAY[${cast.map((c: string) => `'${String(c).replace(/'/g, "''")}'`).join(",")}]::TEXT[]`
      : `'{}'::TEXT[]`;
    const castArray = Prisma.raw(castArrayLiteral);
    
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
        creators,
        cast,
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
        ${item.id},
        ${Prisma.raw(`'${item.source.replace(/'/g, "''")}'::"Source"`)},
        ${item.sourceId},
        ${Prisma.raw(`'${item.type.replace(/'/g, "''")}'::"ItemType"`)},
        ${item.title},
        ${Prisma.raw(`to_tsvector('english', '${escapedTsvectorInput}')`)},
        ${item.year ?? null},
        ${genresArray},
        ${synopsis},
        ${creatorsArray},
        ${castArray},
        ${normalizedPopularity},
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
        title = EXCLUDED.title,
        "titleNorm" = EXCLUDED."titleNorm",
        year = EXCLUDED.year,
        genres = EXCLUDED.genres,
        synopsis = EXCLUDED.synopsis,
        creators = EXCLUDED.creators,
        cast = EXCLUDED.cast,
        popularity = EXCLUDED.popularity,
        "popularityRaw" = EXCLUDED."popularityRaw",
        "posterUrl" = EXCLUDED."posterUrl",
        "franchiseKey" = EXCLUDED."franchiseKey",
        embedding = EXCLUDED.embedding,
        availability = EXCLUDED.availability,
        "providerUrl" = EXCLUDED."providerUrl",
        "updatedAt" = NOW();
    `);

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
        ${`loc_${randomUUID().replace(/-/g, "")}`},
        ${item.id},
        ${defaultLocale},
        ${item.title},
        ${synopsis},
        ${Prisma.raw(`'${availability.replace(/'/g, "''")}'::jsonb`)},
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT ("itemId", "locale") DO UPDATE SET
        title = EXCLUDED.title,
        synopsis = EXCLUDED.synopsis,
        availability = EXCLUDED.availability,
        "updatedAt" = NOW();
    `);
  }

  await prisma.$disconnect();
  console.log("Seed completed");
}

function buildEmbeddingText(item: SeedItem): string {
  return [item.title, (item.genres ?? []).join(","), item.synopsis ?? ""].join("\n");
}

function embeddingToLiteral(vector: number[]): string {
  if (!vector.length) {
    return "NULL";
  }
  const values = vector.map((value) => value.toFixed(6)).join(",");
  return `'[${values}]'::vector`;
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});

