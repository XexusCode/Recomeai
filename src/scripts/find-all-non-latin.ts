import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { prisma } from "@/server/db/client";

async function main() {
  requireDatabaseUrl();
  
  console.log("🔍 Buscando TODOS los items con títulos no latinos...\n");
  
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      source: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  
  console.log(`Total items en BD: ${allItems.length}\n`);
  
  const nonLatinItems = allItems.filter((item) => !hasLatinCharacters(item.title));
  
  if (nonLatinItems.length === 0) {
    console.log("✅ No se encontraron items con títulos no latinos.");
    await prisma.$disconnect();
    return;
  }
  
  console.log(`❌ Se encontraron ${nonLatinItems.length} items con títulos no latinos:\n`);
  console.log("=".repeat(80));
  
  nonLatinItems.forEach((item, index) => {
    console.log(`${index + 1}. "${item.title}"`);
    console.log(`   ID: ${item.id}`);
    console.log(`   Tipo: ${item.type}, Año: ${item.year ?? "N/A"}, Source: ${item.source}`);
    console.log(`   Caracteres: ${[...item.title].map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join(' ')}`);
    console.log();
  });
  
  console.log("=".repeat(80));
  console.log(`\n¿Eliminar estos ${nonLatinItems.length} items? (auto-eliminando...)\n`);
  
  const ids = nonLatinItems.map((item) => item.id);
  const result = await prisma.item.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
  
  console.log(`✅ Se eliminaron ${result.count} items con títulos no latinos.`);
  
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

