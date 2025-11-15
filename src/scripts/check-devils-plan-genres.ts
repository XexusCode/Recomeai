import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { searchProviders } from "@/server/providers/registry";

async function main() {
  requireDatabaseUrl();
  
  const query = "The Devil's Plan";
  
  console.log(`🔍 Verificando géneros de "${query}"...\n`);
  
  // Search in providers
  const results = await searchProviders(query, { limit: 5, type: "tv" });
  
  if (results.length === 0) {
    console.log("❌ No se encontraron resultados en providers.");
    return;
  }
  
  console.log(`✅ Se encontraron ${results.length} resultados:\n`);
  
  results.forEach((item, index) => {
    const isExact = item.title.toLowerCase().trim() === query.toLowerCase().trim();
    const prefix = isExact ? "🎯" : "  ";
    console.log(`${prefix} ${index + 1}. "${item.title}"`);
    console.log(`      Tipo: ${item.type}`);
    console.log(`      Año: ${item.year ?? "N/A"}`);
    console.log(`      Géneros: ${item.genres?.join(", ") ?? "N/A"}`);
    console.log(`      Tags: ${item.tags?.join(", ") ?? "N/A"}`);
    console.log(`      Source: ${item.source}`);
    console.log(`      ID: ${item.id}`);
    if (item.synopsis) {
      console.log(`      Synopsis: ${item.synopsis.substring(0, 150)}...`);
    }
    console.log();
  });
  
  // Check database
  console.log("\n📊 Buscando en la base de datos:\n");
  const { prisma } = await import("@/server/db/client");
  const dbItems = await prisma.item.findMany({
    where: {
      title: {
        contains: query,
        mode: "insensitive",
      },
      type: "tv",
    },
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      genres: true,
      source: true,
      synopsis: true,
    },
    take: 5,
  });
  
  if (dbItems.length === 0) {
    console.log("❌ No se encontró en la base de datos.");
  } else {
    console.log(`✅ Se encontraron ${dbItems.length} items:\n`);
    dbItems.forEach((item, index) => {
      const isExact = item.title.toLowerCase().trim() === query.toLowerCase().trim();
      const prefix = isExact ? "🎯" : "  ";
      console.log(`${prefix} ${index + 1}. "${item.title}"`);
      console.log(`      Géneros: ${item.genres?.join(", ") ?? "N/A"}`);
      console.log(`      Source: ${item.source}`);
      console.log(`      ID: ${item.id}`);
      console.log();
    });
  }
  
  // Check for reality shows in database
  console.log("\n📺 Buscando reality shows en la base de datos:\n");
  const { Prisma } = await import("@prisma/client");
  const realityShows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    genres: string[];
    year: number | null;
    popularity: number;
  }>>(Prisma.sql`
    SELECT 
      id,
      title,
      genres,
      year,
      popularity
    FROM "Item"
    WHERE 
      type = 'tv'
      AND (
        'Reality' = ANY(genres)
        OR 'Game Show' = ANY(genres)
        OR LOWER(title) LIKE '%reality%'
      )
    ORDER BY popularity DESC
    LIMIT 10
  `);
  
  if (realityShows.length === 0) {
    console.log("❌ No se encontraron reality shows en la base de datos.");
  } else {
    console.log(`✅ Se encontraron ${realityShows.length} reality shows:\n`);
    realityShows.forEach((item, index) => {
      console.log(`${index + 1}. "${item.title}"`);
      console.log(`   Géneros: ${item.genres?.join(", ") ?? "N/A"}`);
      console.log(`   Año: ${item.year ?? "N/A"}, Popularidad: ${item.popularity.toFixed(2)}`);
      console.log();
    });
  }
  
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

