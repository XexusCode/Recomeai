#!/usr/bin/env ts-node
/**
 * Script to ingest 10 popular movies and series from TMDb and show their popularity
 */

import "dotenv/config";
import { runIngest } from "./ingest-expand";
import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n🎬 Ingiriendo 10 películas y series populares de TMDb...\n");

  // Popular movies
  const movies = [
    "The Dark Knight",
    "Inception",
    "Interstellar",
    "The Matrix",
    "Pulp Fiction",
  ];

  // Popular series
  const series = [
    "Breaking Bad",
    "Game of Thrones",
    "The Sopranos",
    "The Wire",
    "Stranger Things",
  ];

  let totalInserted = 0;
  let totalSkipped = 0;

  // Ingest movies
  console.log("📽️  Ingiriendo películas...");
  for (const movie of movies) {
    try {
      const result = await runIngest({
        provider: "tmdb",
        query: movie,
        limit: 1,
        type: "movie",
        skipExisting: true,
      });
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      console.log(`  ✓ ${movie}: ${result.inserted > 0 ? "Insertada" : "Ya existía"}`);
    } catch (error) {
      console.error(`  ✗ Error con ${movie}:`, error);
    }
  }

  // Ingest series
  console.log("\n📺 Ingiriendo series...");
  for (const show of series) {
    try {
      const result = await runIngest({
        provider: "tmdb",
        query: show,
        limit: 1,
        type: "tv",
        skipExisting: true,
      });
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      console.log(`  ✓ ${show}: ${result.inserted > 0 ? "Insertada" : "Ya existía"}`);
    } catch (error) {
      console.error(`  ✗ Error con ${show}:`, error);
    }
  }

  console.log(`\n✅ Total insertadas: ${totalInserted}, Total omitidas: ${totalSkipped}\n`);

  // Show popularity data
  console.log("=".repeat(80));
  console.log("📊 POPULARIDAD DE LAS PELÍCULAS Y SERIES INGERIDAS");
  console.log("=".repeat(80));

  const items = await prisma.item.findMany({
    where: { source: "tmdb" },
    select: {
      title: true,
      type: true,
      year: true,
      popularityRaw: true,
      popularity: true,
    },
    orderBy: { popularityRaw: "desc" },
  });

  console.log("\n📈 Ordenadas por popularidad raw (TMDb):\n");
  items.forEach((item, index) => {
    const typeEmoji = item.type === "movie" ? "🎬" : "📺";
    console.log(`${index + 1}. ${typeEmoji} ${item.title} (${item.year})`);
    console.log(`   Popularidad Raw (TMDb): ${item.popularityRaw?.toFixed(2) ?? "N/A"}`);
    console.log(`   Popularidad Normalizada (0-100): ${item.popularity.toFixed(2)}`);
    console.log(`   Conversión: ${item.popularityRaw?.toFixed(2)} → ${item.popularity.toFixed(2)}/100\n`);
  });

  // Statistics
  const rawValues = items.map((i) => i.popularityRaw!).filter(Boolean);
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const avg = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;

  console.log("📊 Estadísticas:");
  console.log(`   Total items: ${items.length}`);
  console.log(`   Popularidad raw - Mínimo: ${min.toFixed(2)}, Máximo: ${max.toFixed(2)}, Promedio: ${avg.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch(console.error);

