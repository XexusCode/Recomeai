#!/usr/bin/env ts-node
/**
 * Script to check TV series ratings and verify they're working correctly
 */

import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n📺 Verificando series de TV (no anime)...\n");

  const series = await prisma.item.findMany({
    where: { 
      source: "tmdb",
      type: "tv",
    },
    select: {
      title: true,
      year: true,
      popularityRaw: true,
      popularity: true,
    },
    orderBy: { popularityRaw: "desc" },
  });

  console.log("=".repeat(80));
  console.log("📊 SERIES DE TV - VERIFICACIÓN DE PUNTUACIONES");
  console.log("=".repeat(80));

  console.log(`\nTotal de series: ${series.length}\n`);

  if (series.length === 0) {
    console.log("⚠️  No hay series en la base de datos. Ejecuta 'pnpm ingest:sample' primero.");
    await prisma.$disconnect();
    return;
  }

  console.log("📈 Series ordenadas por puntuación (vote_average):\n");
  series.forEach((item, index) => {
    const rating = item.popularityRaw;
    const normalized = item.popularity;
    
    // Verify the rating is in the correct range (0-10 for TMDb vote_average)
    const isValid = rating != null && rating >= 0 && rating <= 10;
    const status = isValid ? "✅" : "⚠️";
    
    console.log(`${index + 1}. ${status} ${item.title} (${item.year ?? "N/A"})`);
    console.log(`   vote_average (raw): ${rating?.toFixed(2) ?? "N/A"}/10`);
    console.log(`   Normalizada: ${normalized.toFixed(2)}/100`);
    
    if (!isValid && rating != null) {
      console.log(`   ⚠️  ADVERTENCIA: Valor fuera del rango esperado (0-10)`);
    }
    console.log();
  });

  // Statistics
  const validRatings = series
    .map((s) => s.popularityRaw)
    .filter((r): r is number => r != null && r >= 0 && r <= 10);
  
  if (validRatings.length > 0) {
    const min = Math.min(...validRatings);
    const max = Math.max(...validRatings);
    const avg = validRatings.reduce((a, b) => a + b, 0) / validRatings.length;

    console.log("📊 Estadísticas:");
    console.log(`   Series con puntuación válida: ${validRatings.length}/${series.length}`);
    console.log(`   Puntuación mínima: ${min.toFixed(2)}/10`);
    console.log(`   Puntuación máxima: ${max.toFixed(2)}/10`);
    console.log(`   Puntuación promedio: ${avg.toFixed(2)}/10`);
    
    // Check if values are being normalized correctly
    const expectedNormalized = validRatings.map(r => r * 10);
    const actualNormalized = series
      .filter((s) => s.popularityRaw != null && s.popularityRaw >= 0 && s.popularityRaw <= 10)
      .map((s) => s.popularity);
    
    const normalizationCorrect = expectedNormalized.every((expected, i) => 
      Math.abs(expected - actualNormalized[i]) < 0.01
    );
    
    console.log(`   Normalización correcta: ${normalizationCorrect ? "✅ Sí" : "❌ No"}`);
  }

  // Check for any issues
  const issues = series.filter((s) => {
    const rating = s.popularityRaw;
    return rating == null || rating < 0 || rating > 10;
  });

  if (issues.length > 0) {
    console.log(`\n⚠️  Series con problemas (${issues.length}):`);
    issues.forEach((item) => {
      console.log(`   - ${item.title}: ${item.popularityRaw ?? "null"}`);
    });
  } else {
    console.log(`\n✅ Todas las series tienen puntuaciones válidas (0-10)`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

