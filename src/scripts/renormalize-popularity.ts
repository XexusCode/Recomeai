import { PrismaClient, Prisma } from "@prisma/client";
import * as dotenv from "dotenv";
import { normalizePopularityBatch } from "@/lib/popularity";

dotenv.config({ path: ".env.local" });

const prisma = new PrismaClient();

/**
 * Re-normalizes popularity for all items based on global statistics.
 * This fixes the issue where items were normalized relative to their ingestion batch,
 * which can result in very low normalized values for items ingested with very popular items.
 */
async function main() {
  console.log("Re-normalizing popularity based on global statistics...\n");
  
  // Get all items with popularityRaw and source
  const items = await prisma.$queryRaw<Array<{
    id: string;
    popularityRaw: number | null;
    synopsis: string | null;
    source: string;
  }>>(Prisma.sql`
    SELECT id, "popularityRaw", synopsis, source::text
    FROM "Item"
    WHERE "popularityRaw" IS NOT NULL
    ORDER BY id;
  `);
  
  console.log(`Found ${items.length} items with popularityRaw`);
  
  if (items.length === 0) {
    console.log("No items to normalize");
    await prisma.$disconnect();
    return;
  }
  
  // Normalize using provider-specific scaling
  const normalized = normalizePopularityBatch(items);
  
  console.log(`Normalized ${normalized.length} items`);
  console.log(`Popularity range: ${Math.min(...normalized).toFixed(2)} - ${Math.max(...normalized).toFixed(2)}`);
  console.log(`Average: ${(normalized.reduce((a, b) => a + b, 0) / normalized.length).toFixed(2)}`);
  console.log();
  
  // Update items in batches
  let updated = 0;
  const batchSize = 100;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNormalized = normalized.slice(i, i + batchSize);
    
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const newPopularity = batchNormalized[j];
      
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "Item"
        SET popularity = ${newPopularity}
        WHERE id = ${item.id};
      `);
      
      updated++;
    }
    
    if (updated % 100 === 0) {
      console.log(`Updated ${updated}/${items.length} items...`);
    }
  }
  
  console.log(`\n✓ Successfully re-normalized popularity for ${updated} items`);
  
  // Show some examples
  console.log("\nExamples of updated popularities:");
  const examples = await prisma.$queryRaw<Array<{
    title: string;
    popularity: number;
    popularityRaw: number;
  }>>(Prisma.sql`
    SELECT title, popularity, "popularityRaw"
    FROM "Item"
    WHERE "popularityRaw" IS NOT NULL
    ORDER BY "popularityRaw" DESC
    LIMIT 5;
  `);
  
  console.log("\nTop 5 by popularityRaw:");
  examples.forEach((item, index) => {
    console.log(`  ${index + 1}. "${item.title}" - Raw: ${item.popularityRaw.toFixed(2)}, Normalized: ${item.popularity.toFixed(2)}`);
  });
  
  const flash = await prisma.$queryRaw<Array<{
    title: string;
    popularity: number;
    popularityRaw: number;
  }>>(Prisma.sql`
    SELECT title, popularity, "popularityRaw"
    FROM "Item"
    WHERE LOWER(title) = 'the flash' AND type = 'movie'
    LIMIT 1;
  `);
  
  if (flash.length > 0) {
    console.log(`\n"The Flash" - Raw: ${flash[0].popularityRaw.toFixed(2)}, Normalized: ${flash[0].popularity.toFixed(2)}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

