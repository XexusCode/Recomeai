import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { prisma } from "@/server/db/client";

async function main() {
  requireDatabaseUrl();
  
  console.log("🔍 Buscando localizaciones con títulos no latinos...\n");
  
  const localizations = await prisma.itemLocalization.findMany({
    select: {
      id: true,
      itemId: true,
      locale: true,
      title: true,
    },
  });
  
  console.log(`Total localizaciones: ${localizations.length}\n`);
  
  const nonLatinLocalizations = localizations.filter(
    (loc) => loc.title && !hasLatinCharacters(loc.title)
  );
  
  if (nonLatinLocalizations.length === 0) {
    console.log("✅ No se encontraron localizaciones con títulos no latinos.");
    await prisma.$disconnect();
    return;
  }
  
  console.log(`❌ Se encontraron ${nonLatinLocalizations.length} localizaciones con títulos no latinos:\n`);
  console.log("=".repeat(80));
  
  // Get item details for context
  const itemIds = Array.from(new Set(nonLatinLocalizations.map((loc) => loc.itemId)));
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, title: true, type: true, year: true, source: true },
  });
  const itemMap = new Map(items.map((item) => [item.id, item]));
  
  nonLatinLocalizations.forEach((loc, index) => {
    const item = itemMap.get(loc.itemId);
    console.log(`${index + 1}. "${loc.title}"`);
    console.log(`   Item ID: ${loc.itemId}`);
    console.log(`   Locale: ${loc.locale}`);
    if (item) {
      console.log(`   Item original: "${item.title}" (${item.type}, ${item.year ?? "N/A"}, ${item.source})`);
    }
    console.log();
  });
  
  console.log("=".repeat(80));
  console.log(`\n🗑️  Eliminando estas ${nonLatinLocalizations.length} localizaciones...\n`);
  
  const ids = nonLatinLocalizations.map((loc) => loc.id);
  const result = await prisma.itemLocalization.deleteMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
  
  console.log(`✅ Se eliminaron ${result.count} localizaciones con títulos no latinos.`);
  console.log(`\n⚠️  Los items mantendrán sus títulos originales (latinos) en lugar de las localizaciones eliminadas.`);
  
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

