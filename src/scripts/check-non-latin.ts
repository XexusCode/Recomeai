#!/usr/bin/env ts-node
/**
 * Script to find and remove items with non-Latin titles
 */

import { prisma } from "@/server/db/client";
import { hasLatinCharacters } from "@/lib/non-latin-filter";

async function main() {
  console.log("\n🔍 Buscando items con títulos no latinos...\n");

  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      source: true,
      type: true,
      year: true,
    },
  });

  const nonLatinItems = allItems.filter((item) => !hasLatinCharacters(item.title));

  console.log(`Total items: ${allItems.length}`);
  console.log(`Items con títulos no latinos: ${nonLatinItems.length}\n`);

  if (nonLatinItems.length > 0) {
    console.log("=".repeat(80));
    console.log("❌ ITEMS CON TÍTULOS NO LATINOS");
    console.log("=".repeat(80));
    console.log();

    nonLatinItems.forEach((item, index) => {
      console.log(`${index + 1}. "${item.title}"`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Source: ${item.source}, Type: ${item.type}, Year: ${item.year ?? "N/A"}`);
      console.log();
    });

    console.log("=".repeat(80));
    console.log(`\n¿Eliminar estos ${nonLatinItems.length} items? (S/N)`);
    
    // Auto-delete for now
    if (nonLatinItems.length > 0) {
      const ids = nonLatinItems.map((item) => item.id);
      const result = await prisma.item.deleteMany({
        where: { id: { in: ids } },
      });
      console.log(`\n✅ Eliminados ${result.count} items con títulos no latinos`);
    }
  } else {
    console.log("✅ No se encontraron items con títulos no latinos");
  }

  await prisma.$disconnect();
}

main().catch(console.error);

