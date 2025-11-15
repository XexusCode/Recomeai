import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { prisma } from "@/server/db/client";

async function main() {
  requireDatabaseUrl();
  
  const specificTitles = ["水龙吟", "聊斋志异"];
  
  console.log("🔍 Buscando títulos específicos en la base de datos...\n");
  
  for (const searchTitle of specificTitles) {
    console.log(`Buscando: "${searchTitle}"`);
    
    const items = await prisma.item.findMany({
      where: {
        title: {
          contains: searchTitle,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        year: true,
        source: true,
      },
    });
    
    if (items.length > 0) {
      console.log(`  ❌ Encontrado ${items.length} item(s):`);
      items.forEach((item) => {
        console.log(`    - "${item.title}" (${item.type}, ${item.year ?? "?"}, ${item.source}) [${item.id}]`);
        console.log(`      hasLatinCharacters: ${hasLatinCharacters(item.title)}`);
      });
    } else {
      console.log(`  ✅ No encontrado en la base de datos`);
    }
    console.log();
  }
  
  // También buscar todos los items no latinos
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      source: true,
    },
  });
  
  const nonLatinItems = allItems.filter((item) => !hasLatinCharacters(item.title));
  console.log(`\nTotal items en BD: ${allItems.length}`);
  console.log(`Items con títulos no latinos: ${nonLatinItems.length}`);
  
  if (nonLatinItems.length > 0) {
    console.log("\n❌ Items no latinos encontrados:");
    nonLatinItems.slice(0, 20).forEach((item) => {
      console.log(`  - "${item.title}" (${item.type}, ${item.year ?? "?"}, ${item.source})`);
    });
    if (nonLatinItems.length > 20) {
      console.log(`  ... y ${nonLatinItems.length - 20} más`);
    }
  }
  
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

