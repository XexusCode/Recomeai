import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { resolveSeed } from "@/server/recommendations/seed";
import { buildRecommendations } from "@/server/recommendations/pipeline";

async function main() {
  requireDatabaseUrl();
  
  const query = "The Devil's Plan";
  const filters = { type: "tv" };
  
  console.log(`🔍 Probando recomendaciones para: "${query}"\n`);
  console.log(`Filtros:`, filters);
  console.log();
  
  // Resolve seed
  console.log("📌 Resolviendo anchor...\n");
  const seed = await resolveSeed(query, filters);
  
  if (seed.anchor) {
    console.log("✅ Anchor encontrado:");
    console.log(`   Título: "${seed.anchor.title}"`);
    console.log(`   Tipo: ${seed.anchor.type}`);
    console.log(`   Año: ${seed.anchor.year ?? "N/A"}`);
    console.log(`   Géneros: ${seed.anchor.genres?.join(", ") || "N/A"}`);
    console.log(`   Tags: ${seed.anchor.tags?.join(", ") || "N/A"}`);
    console.log(`   ID: ${seed.anchor.id}`);
    console.log(`   Source: ${seed.anchor.source}`);
    console.log();
    
    if (!seed.anchor.genres || seed.anchor.genres.length === 0) {
      console.log("⚠️  ADVERTENCIA: El anchor NO tiene géneros!");
      console.log("   Esto puede causar que no aparezcan reality shows en las recomendaciones.\n");
    }
  } else {
    console.log("❌ No se encontró anchor.\n");
  }
  
  // Build recommendations
  console.log("🎯 Generando recomendaciones...\n");
  const result = await buildRecommendations({
    query,
    type: "tv",
    limit: 10,
    locale: "es",
  });
  
  console.log(`✅ Se generaron ${result.items.length} recomendaciones:\n`);
  
  // Check how many are reality shows
  const realityShows = result.items.filter(item => 
    item.genres?.some(g => g.toLowerCase().includes("reality") || g.toLowerCase().includes("game show"))
  );
  
  console.log(`📺 Reality shows en recomendaciones: ${realityShows.length}/${result.items.length}\n`);
  
  result.items.forEach((item, index) => {
    const isReality = item.genres?.some(g => g.toLowerCase().includes("reality") || g.toLowerCase().includes("game show"));
    const prefix = isReality ? "📺" : "  ";
    console.log(`${prefix} ${index + 1}. "${item.title}"`);
    console.log(`      Géneros: ${item.genres?.join(", ") || "N/A"}`);
    console.log(`      Tipo: ${item.type}, Año: ${item.year ?? "N/A"}, Popularidad: ${item.popularity?.toFixed(2) ?? "N/A"}`);
    console.log(`      Score: ${item.score?.toFixed(4) ?? "N/A"}`);
    console.log();
  });
  
  if (realityShows.length === 0 && seed.anchor) {
    console.log("⚠️  ADVERTENCIA: No aparecen reality shows en las recomendaciones.");
    console.log("   Esto puede ser porque:");
    console.log("   1. El anchor no tiene géneros");
    console.log("   2. No hay reality shows similares en la base de datos");
    console.log("   3. El algoritmo no está usando genreBoost correctamente");
  }
  
  const { prisma } = await import("@/server/db/client");
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

