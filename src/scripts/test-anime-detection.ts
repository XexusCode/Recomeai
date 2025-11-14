#!/usr/bin/env ts-node
/**
 * Script to test anime detection and ensure anime is not added as movie/tv
 */

import "dotenv/config";
import { runIngest } from "./ingest-expand";
import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n🎌 Probando detección de anime...\n");

  // Test cases: known anime titles that should NOT be added as movies/tv
  const testCases = [
    { title: "Spirited Away", expectedType: "anime", searchType: "movie" },
    { title: "Your Name", expectedType: "anime", searchType: "movie" },
    { title: "Attack on Titan", expectedType: "anime", searchType: "tv" },
    { title: "Naruto", expectedType: "anime", searchType: "tv" },
    { title: "One Piece", expectedType: "anime", searchType: "tv" },
  ];

  console.log("📝 Casos de prueba:");
  testCases.forEach((tc, i) => {
    console.log(`  ${i + 1}. "${tc.title}" buscado como ${tc.searchType} → debería ser ${tc.expectedType}`);
  });
  console.log();

  // Clear database first
  await prisma.item.deleteMany({});
  console.log("🗑️  Base de datos limpiada\n");

  // Test each case
  for (const testCase of testCases) {
    try {
      console.log(`🔍 Buscando "${testCase.title}" como ${testCase.searchType}...`);
      const result = await runIngest({
        provider: "tmdb",
        query: testCase.title,
        limit: 1,
        type: testCase.searchType as any,
        skipExisting: false,
      });

      // Check what was actually inserted
      const items = await prisma.item.findMany({
        where: { title: { contains: testCase.title, mode: "insensitive" } },
        select: { title: true, type: true, source: true },
      });

      if (items.length > 0) {
        const item = items[0];
        const status = item.type === testCase.expectedType ? "✅" : "❌";
        console.log(`  ${status} "${item.title}" → Tipo: ${item.type} (esperado: ${testCase.expectedType})`);
        
        if (item.type !== testCase.expectedType) {
          console.log(`  ⚠️  ERROR: Se insertó como ${item.type} en lugar de ${testCase.expectedType}`);
        }
      } else {
        console.log(`  ⚠️  No se encontró ningún item para "${testCase.title}"`);
      }
      console.log();
    } catch (error) {
      console.error(`  ✗ Error con "${testCase.title}":`, error);
    }
  }

  // Summary
  console.log("=".repeat(80));
  console.log("📊 RESUMEN");
  console.log("=".repeat(80));

  const allItems = await prisma.item.findMany({
    select: { title: true, type: true, source: true },
  });

  const byType = allItems.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nItems por tipo:");
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Check for anime incorrectly classified
  const incorrectlyClassified = allItems.filter(
    (item) => 
      item.source === "tmdb" && 
      (item.type === "movie" || item.type === "tv") &&
      testCases.some(tc => item.title.toLowerCase().includes(tc.title.toLowerCase()))
  );

  if (incorrectlyClassified.length > 0) {
    console.log("\n❌ Items incorrectamente clasificados:");
    incorrectlyClassified.forEach((item) => {
      console.log(`  - "${item.title}" → ${item.type} (debería ser anime)`);
    });
  } else {
    console.log("\n✅ Todos los animes fueron correctamente detectados y clasificados");
  }

  await prisma.$disconnect();
}

main().catch(console.error);

