#!/usr/bin/env ts-node
/**
 * Script to ingest 10 popular anime from AniList and show their popularity
 */

import "dotenv/config";
import { runIngest } from "./ingest-expand";
import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n🎌 Ingiriendo 10 animes populares de AniList...\n");

  // Popular anime titles
  const animeTitles = [
    "Fullmetal Alchemist: Brotherhood",
    "Attack on Titan",
    "Death Note",
    "One Punch Man",
    "Demon Slayer",
    "My Hero Academia",
    "Naruto",
    "Dragon Ball Z",
    "One Piece",
    "Spirited Away",
  ];

  let totalInserted = 0;
  let totalSkipped = 0;

  // Ingest anime
  console.log("📺 Ingiriendo animes...");
  for (const title of animeTitles) {
    try {
      const result = await runIngest({
        provider: "anilist",
        query: title,
        limit: 1,
        type: "anime",
        skipExisting: true,
      });
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      console.log(`  ✓ ${title}: ${result.inserted > 0 ? "Insertado" : "Ya existía"}`);
    } catch (error) {
      console.error(`  ✗ Error con ${title}:`, error);
    }
  }

  console.log(`\n✅ Total insertados: ${totalInserted}, Total omitidos: ${totalSkipped}\n`);

  // Show popularity data
  console.log("=".repeat(80));
  console.log("📊 PUNTUACIÓN DE LOS ANIMES INGERIDOS");
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
  });

  console.log("\n📈 Ordenados por puntuación raw (AniList):\n");
  items.forEach((item, index) => {
    console.log(`${index + 1}. 🎌 ${item.title} (${item.year ?? "N/A"})`);
    console.log(`   Puntuación Raw (AniList averageScore): ${item.popularityRaw?.toFixed(2) ?? "N/A"}`);
    console.log(`   Puntuación Normalizada (0-100): ${item.popularity.toFixed(2)}`);
    console.log(`   Conversión: ${item.popularityRaw?.toFixed(2)} → ${item.popularity.toFixed(2)}/100\n`);
  });

  // Statistics
  const rawValues = items.map((i) => i.popularityRaw!).filter(Boolean);
  if (rawValues.length > 0) {
    const min = Math.min(...rawValues);
    const max = Math.max(...rawValues);
    const avg = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;

    console.log("📊 Estadísticas:");
    console.log(`   Total items: ${items.length}`);
    console.log(`   Puntuación raw - Mínimo: ${min.toFixed(2)}, Máximo: ${max.toFixed(2)}, Promedio: ${avg.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

