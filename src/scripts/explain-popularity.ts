#!/usr/bin/env ts-node
/**
 * Script to explain how TMDb popularity metric works
 */

import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n📊 EXPLICACIÓN DEL PARÁMETRO DE POPULARIDAD DE TMDb");
  console.log("=".repeat(80));
  
  console.log("\n🔍 ¿QUÉ ES EL PARÁMETRO 'popularity' DE TMDb?");
  console.log("-".repeat(80));
  console.log(`
El parámetro 'popularity' de TMDb es un número decimal que refleja la popularidad 
relativa de una película o serie. Este valor se calcula dinámicamente basándose en:

1. Cantidad de visitas a la página del título
2. Frecuencia de búsqueda del título
3. Interacciones de usuarios (votos, listas, favoritos)
4. Tendencias actuales y eventos relacionados

IMPORTANTE:
- Es un valor RELATIVO, no absoluto
- Cambia con el tiempo según las tendencias
- No tiene una escala fija (puede ser 0.01 o 951.35)
- Valores altos (>50) indican contenido muy popular
- Valores bajos (<1) indican contenido poco conocido
`);

  // Get examples from database
  const examples = await prisma.item.findMany({
    where: { 
      source: "tmdb",
      popularityRaw: { not: null },
      OR: [
        { title: { contains: "Sopranos", mode: "insensitive" } },
        { title: { contains: "Frankenstein", mode: "insensitive" } },
        { title: { contains: "Smallville", mode: "insensitive" } },
        { title: { contains: "Law & Order", mode: "insensitive" } },
      ]
    },
    select: {
      title: true,
      popularityRaw: true,
      popularity: true,
      type: true,
      year: true,
    },
    orderBy: { popularityRaw: "desc" },
  });

  console.log("\n📈 EJEMPLOS DE NUESTRA BASE DE DATOS:");
  console.log("-".repeat(80));
  examples.forEach((item) => {
    console.log(`
  ${item.title} (${item.type}, ${item.year})
    Popularidad Raw (TMDb): ${item.popularityRaw?.toFixed(2)}
    Popularidad Normalizada (0-100): ${item.popularity.toFixed(2)}
    Interpretación: ${getInterpretation(item.popularityRaw!, item.popularity)}
    `);
  });

  // Get statistics
  const stats = await prisma.item.findMany({
    where: { source: "tmdb", popularityRaw: { not: null } },
    select: { popularityRaw: true },
  });

  const rawValues = stats.map((s) => s.popularityRaw!).filter(Boolean);
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const avg = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
  const median = rawValues.sort((a, b) => a - b)[Math.floor(rawValues.length / 2)];

  console.log("\n📊 ESTADÍSTICAS DE NUESTRA BASE DE DATOS:");
  console.log("-".repeat(80));
  console.log(`
  Total de items TMDb: ${stats.length}
  Rango de popularidad raw:
    Mínimo: ${min.toFixed(2)}
    Máximo: ${max.toFixed(2)}
    Promedio: ${avg.toFixed(2)}
    Mediana: ${median.toFixed(2)}
  
  Interpretación:
    - Valores > 50: Contenido muy popular (top 1-5%)
    - Valores 20-50: Contenido popular (top 5-15%)
    - Valores 5-20: Contenido moderadamente popular (top 15-50%)
    - Valores 1-5: Contenido poco conocido (bottom 50-80%)
    - Valores < 1: Contenido muy poco conocido (bottom 80-100%)
  `);

  console.log("\n🔧 NUESTRA NORMALIZACIÓN:");
  console.log("-".repeat(80));
  console.log(`
Para convertir los valores raw de TMDb a una escala 0-100, usamos:

1. Valores < 100: Multiplicamos por 1.2
   Ejemplo: 62.72 → 75.26 (The Sopranos)
   
2. Valores >= 100: Usamos raíz cuadrada × 10
   Ejemplo: 951.35 → 100.00 (Frankenstein)
   
Esto asegura que:
- Series muy populares como The Sopranos (62.72) tengan ~75/100
- Contenido extremadamente popular (>100) se limite a 100/100
- La distribución sea más equilibrada y representativa
  `);

  await prisma.$disconnect();
}

function getInterpretation(raw: number, normalized: number): string {
  if (raw >= 50) return "⭐ Muy popular - Serie/película icónica";
  if (raw >= 20) return "🔥 Popular - Contenido conocido";
  if (raw >= 5) return "📺 Moderado - Contenido con audiencia";
  if (raw >= 1) return "📚 Poco conocido - Contenido de nicho";
  return "🔍 Muy poco conocido - Contenido oscuro";
}

main().catch(console.error);

