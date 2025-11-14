import "dotenv/config";

import { requireDatabaseUrl } from "@/env";
import { prisma } from "@/server/db/client";
import { getProvider } from "@/server/providers/registry";

async function main() {
  requireDatabaseUrl();

  // Find all TMDb items with potentially malformed poster URLs
  const items = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    "sourceId": string;
    type: string;
    "posterUrl": string | null;
  }>>`
    SELECT id, title, "sourceId", type, "posterUrl"
    FROM "Item"
    WHERE source = 'tmdb'
      AND "posterUrl" IS NOT NULL
      AND "posterUrl" LIKE '%image.tmdb.org%'
    LIMIT 100
  `;

  console.log(`Found ${items.length} TMDb items to check`);

  const provider = getProvider("tmdb");
  if (!provider || typeof provider.fetchById !== "function") {
    throw new Error("TMDb provider not available");
  }

  let fixed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      // Check if URL is malformed (too long filename or invalid format)
      if (item.posterUrl) {
        const urlMatch = item.posterUrl.match(/\/t\/p\/w\d+\/([^/]+)\.(jpg|png|webp)/i);
        if (urlMatch) {
          const filename = urlMatch[1];
          // If filename is longer than 15 chars, it's likely malformed
          if (filename.length > 15) {
            console.log(`Fixing malformed poster URL for ${item.title}: ${filename.substring(0, 20)}...`);
            
            // Fetch fresh data from TMDb
            const tmdbType = item.type === "anime" ? "tv" : item.type;
            const fetchId = `${tmdbType}:${item.sourceId}`;
            const enriched = await provider.fetchById(fetchId);
            
            if (enriched?.posterUrl) {
              // Validate the new URL
              const newUrlMatch = enriched.posterUrl.match(/\/t\/p\/w\d+\/([^/]+)\.(jpg|png|webp)/i);
              if (newUrlMatch && newUrlMatch[1].length <= 15) {
                await prisma.$executeRaw`
                  UPDATE "Item"
                  SET "posterUrl" = ${enriched.posterUrl}
                  WHERE id = ${item.id}
                `;
                console.log(`  ✓ Fixed: ${enriched.posterUrl}`);
                fixed++;
              } else {
                console.log(`  ✗ New URL also malformed: ${enriched.posterUrl}`);
                failed++;
              }
            } else {
              console.log(`  ✗ No poster URL from TMDb`);
              failed++;
            }
            
            // Small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
    } catch (error) {
      console.error(`Error fixing ${item.title}:`, error);
      failed++;
    }
  }

  console.log(`\nFixed: ${fixed}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect().finally(() => process.exit(1));
});

