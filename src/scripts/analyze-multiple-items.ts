#!/usr/bin/env ts-node
/**
 * Script to analyze multiple items from different sources
 * Usage: ts-node --project tsconfig.scripts.json -r tsconfig-paths/register src/scripts/analyze-multiple-items.ts
 */

import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("📊 MULTI-ITEM POPULARITY ANALYSIS");
  console.log("=".repeat(80));

  // Get items from different sources
  const tmdbItems = await prisma.item.findMany({
    where: { source: "tmdb", popularityRaw: { not: null } },
    orderBy: { popularityRaw: "desc" },
    take: 5,
    select: {
      title: true,
      source: true,
      popularityRaw: true,
      popularity: true,
      type: true,
    },
  });

  const anilistItems = await prisma.item.findMany({
    where: { source: "anilist", popularityRaw: { not: null } },
    orderBy: { popularityRaw: "desc" },
    take: 5,
    select: {
      title: true,
      source: true,
      popularityRaw: true,
      popularity: true,
      type: true,
    },
  });

  const googlebooksItems = await prisma.item.findMany({
    where: { source: "googlebooks", popularityRaw: { not: null } },
    orderBy: { popularityRaw: "desc" },
    take: 5,
    select: {
      title: true,
      source: true,
      popularityRaw: true,
      popularity: true,
      type: true,
    },
  });

  console.log("\n🎬 TMDb ITEMS (películas/series):");
  console.log("-".repeat(80));
  tmdbItems.forEach((item, index) => {
    const expected = item.popularityRaw! / 10;
    const diff = Math.abs(item.popularity - expected);
    const status = diff < 0.1 ? "✅" : "⚠️";
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   Raw: ${item.popularityRaw!.toFixed(2)} → Normalized: ${item.popularity.toFixed(2)} (Expected: ${expected.toFixed(2)}) ${status}`);
    console.log(`   Type: ${item.type}`);
  });

  console.log("\n🎌 ANILIST ITEMS (anime):");
  console.log("-".repeat(80));
  anilistItems.forEach((item, index) => {
    const raw = item.popularityRaw!;
    const expected = raw > 100 ? raw / 10 : raw;
    const diff = Math.abs(item.popularity - expected);
    const status = diff < 0.1 ? "✅" : "⚠️";
    const sourceType = raw > 100 ? "popularity" : "averageScore";
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   Raw: ${raw.toFixed(2)} (${sourceType}) → Normalized: ${item.popularity.toFixed(2)} (Expected: ${expected.toFixed(2)}) ${status}`);
    console.log(`   Type: ${item.type}`);
  });

  console.log("\n📚 GOOGLE BOOKS ITEMS:");
  console.log("-".repeat(80));
  googlebooksItems.forEach((item, index) => {
    const expected = item.popularityRaw! * 20;
    const diff = Math.abs(item.popularity - expected);
    const status = diff < 0.1 ? "✅" : "⚠️";
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   Raw: ${item.popularityRaw!.toFixed(2)}/5 → Normalized: ${item.popularity.toFixed(2)} (Expected: ${expected.toFixed(2)}) ${status}`);
    console.log(`   Type: ${item.type}`);
  });

  // Summary statistics
  const allItems = await prisma.item.findMany({
    where: { popularityRaw: { not: null } },
    select: {
      source: true,
      popularityRaw: true,
      popularity: true,
    },
  });

  console.log("\n📈 SUMMARY STATISTICS:");
  console.log("-".repeat(80));
  const bySource = new Map<string, Array<{ raw: number; norm: number }>>();
  allItems.forEach((item) => {
    if (!bySource.has(item.source)) {
      bySource.set(item.source, []);
    }
    bySource.get(item.source)!.push({ raw: item.popularityRaw!, norm: item.popularity });
  });

  bySource.forEach((items, source) => {
    const rawAvg = items.reduce((sum, item) => sum + item.raw, 0) / items.length;
    const normAvg = items.reduce((sum, item) => sum + item.norm, 0) / items.length;
    const rawMin = Math.min(...items.map((i) => i.raw));
    const rawMax = Math.max(...items.map((i) => i.raw));
    const normMin = Math.min(...items.map((i) => i.norm));
    const normMax = Math.max(...items.map((i) => i.norm));
    console.log(`\n${source.toUpperCase()}:`);
    console.log(`  Items: ${items.length}`);
    console.log(`  Raw range: ${rawMin.toFixed(2)} - ${rawMax.toFixed(2)} (avg: ${rawAvg.toFixed(2)})`);
    console.log(`  Normalized range: ${normMin.toFixed(2)} - ${normMax.toFixed(2)} (avg: ${normAvg.toFixed(2)})`);
  });

  console.log("\n" + "=".repeat(80));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

