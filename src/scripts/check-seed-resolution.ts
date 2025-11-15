import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { resolveSeed } from "@/server/recommendations/seed";

async function main() {
  requireDatabaseUrl();
  
  const query = "The Devil's Plan";
  const filters = { type: "tv" };
  
  console.log(`🔍 Verificando resolución del anchor para: "${query}"\n`);
  console.log(`Filtros:`, filters);
  console.log();
  
  // First, let's check what's in the database
  console.log("📊 Buscando en la base de datos:\n");
  
  const results = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    type: string;
    year: number | null;
    popularity: number;
    similarity: number;
  }>>(Prisma.sql`
    SELECT
      i.id,
      i.title,
      i.type,
      i.year,
      i.popularity,
      similarity(i.title, ${query}) AS similarity
    FROM "Item" i
    WHERE 
      i.embedding IS NOT NULL
      AND similarity(i.title, ${query}) > 0.35
      AND i."titleNorm" @@ websearch_to_tsquery('english', ${query})
      AND i.type = 'tv'
    ORDER BY similarity(i.title, ${query}) DESC, i.popularity DESC, i.year DESC NULLS LAST
    LIMIT 10
  `);
  
  if (results.length === 0) {
    console.log("❌ No se encontraron items en la base de datos con ese query.\n");
  } else {
    console.log(`✅ Se encontraron ${results.length} items:\n`);
    results.forEach((item, index) => {
      const isExact = item.title.toLowerCase() === query.toLowerCase();
      const prefix = isExact ? "🎯" : "  ";
      console.log(`${prefix} ${index + 1}. "${item.title}"`);
      console.log(`      Similarity: ${(item.similarity * 100).toFixed(2)}%`);
      console.log(`      Popularity: ${item.popularity.toFixed(2)}`);
      console.log(`      Year: ${item.year ?? "N/A"}`);
      console.log(`      ID: ${item.id}`);
      console.log();
    });
  }
  
  // Now check what resolveSeed returns
  console.log("\n🔍 Resolviendo anchor con resolveSeed:\n");
  const seed = await resolveSeed(query, filters);
  
  if (seed.anchor) {
    console.log("✅ Anchor encontrado:");
    console.log(`   Título: "${seed.anchor.title}"`);
    console.log(`   Tipo: ${seed.anchor.type}`);
    console.log(`   Año: ${seed.anchor.year ?? "N/A"}`);
    console.log(`   Popularidad: ${seed.anchor.popularity.toFixed(2)}`);
    console.log(`   ID: ${seed.anchor.id}`);
    console.log();
    
    // Check if it matches the query
    const isExactMatch = seed.anchor.title.toLowerCase() === query.toLowerCase();
    if (!isExactMatch) {
      console.log(`⚠️  ADVERTENCIA: El anchor NO coincide exactamente con el query!`);
      console.log(`   Query: "${query}"`);
      console.log(`   Anchor: "${seed.anchor.title}"`);
    } else {
      console.log(`✅ El anchor coincide exactamente con el query.`);
    }
  } else {
    console.log("❌ No se encontró anchor.");
  }
  
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

