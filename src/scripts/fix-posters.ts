import "dotenv/config";

import { requireDatabaseUrl } from "@/env";
import { prisma } from "@/server/db/client";
import { getProvider } from "@/server/providers/registry";

async function main() {
  requireDatabaseUrl();

  // Find TMDb items missing a poster or with non-TMDb URLs
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
      AND ("posterUrl" IS NULL OR "posterUrl" NOT LIKE 'https://image.tmdb.org%')
    LIMIT 200
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
      const tmdbType = item.type === "anime" ? "tv" : item.type;
      const fetchId = `${tmdbType}:${item.sourceId}`;
      const enriched = await provider.fetchById(fetchId);

      if (enriched?.posterUrl?.startsWith("https://image.tmdb.org")) {
        await prisma.$executeRaw`
          UPDATE "Item"
          SET "posterUrl" = ${enriched.posterUrl}
          WHERE id = ${item.id}
        `;
        console.log(`  ✓ Updated poster for ${item.title}`);
        fixed++;
      } else {
        console.log(`  ✗ No valid poster for ${item.title}`);
        failed++;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
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

