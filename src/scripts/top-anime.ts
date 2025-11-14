#!/usr/bin/env ts-node
/**
 * Script to get top 10 anime by score from AniList
 */

import "dotenv/config";
import { runIngest } from "./ingest-expand";
import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n🎌 Obteniendo top 10 animes por puntuación de AniList...\n");

  // Use discover with SCORE_DESC to get top rated anime
  console.log("📺 Obteniendo animes mejor puntuados de AniList...");
  try {
    const result = await runIngest({
      provider: "anilist",
      query: undefined,
      limit: 10,
      type: "anime",
      discover: {
        mediaType: "anime",
        pages: 1,
        mode: "seasonal", // This uses SCORE_DESC sort
      },
      skipExisting: true,
    });
    console.log(`✅ Total procesados: ${result.processed}, Insertados: ${result.inserted}, Omitidos: ${result.skipped}\n`);
  } catch (error) {
    console.error(`  ✗ Error obteniendo animes:`, error);
  }

  // Show top anime by score
  console.log("=".repeat(80));
  console.log("🏆 TOP 10 ANIMES POR PUNTUACIÓN (AniList)");
  console.log("=".repeat(80));

  const items = await prisma.item.findMany({
    where: { source: "anilist" },
    select: {
      title: true,
      year: true,
      popularityRaw: true,
      popularity: true,
    },
    orderBy: { popularityRaw: "desc" },
    take: 10,
  });

  console.log("\n📈 Top 10 ordenados por puntuación:\n");
  items.forEach((item, index) => {
    const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`;
    console.log(`${medal} 🎌 ${item.title} (${item.year ?? "N/A"})`);
    console.log(`   Puntuación: ${item.popularityRaw?.toFixed(2) ?? "N/A"}/100`);
    console.log(`   Normalizada: ${item.popularity.toFixed(2)}/100\n`);
  });

  // Statistics
  const rawValues = items.map((i) => i.popularityRaw!).filter(Boolean);
  if (rawValues.length > 0) {
    const min = Math.min(...rawValues);
    const max = Math.max(...rawValues);
    const avg = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;

    console.log("📊 Estadísticas del Top 10:");
    console.log(`   Puntuación mínima: ${min.toFixed(2)}/100`);
    console.log(`   Puntuación máxima: ${max.toFixed(2)}/100`);
    console.log(`   Puntuación promedio: ${avg.toFixed(2)}/100`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

