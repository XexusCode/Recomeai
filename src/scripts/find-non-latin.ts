#!/usr/bin/env ts-node
/**
 * Script to find specific non-Latin titles
 */

import { prisma } from "@/server/db/client";

async function main() {
  console.log("\n🔍 Buscando títulos específicos...\n");

  // Buscar todos los items
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      source: true,
      type: true,
      year: true,
    },
  });

  console.log(`Total items: ${allItems.length}\n`);

  // Buscar items con caracteres árabes o cirílicos
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  const cyrillicPattern = /[\u0400-\u04FF]/;

  const arabicItems = allItems.filter((item) => arabicPattern.test(item.title));
  const cyrillicItems = allItems.filter((item) => cyrillicPattern.test(item.title));

  console.log("=".repeat(80));
  console.log("ITEMS CON CARACTERES ÁRABES");
  console.log("=".repeat(80));
  if (arabicItems.length > 0) {
    arabicItems.forEach((item, index) => {
      console.log(`${index + 1}. "${item.title}"`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Source: ${item.source}, Type: ${item.type}, Year: ${item.year ?? "N/A"}`);
      console.log();
    });
  } else {
    console.log("No se encontraron items con caracteres árabes\n");
  }

  console.log("=".repeat(80));
  console.log("ITEMS CON CARACTERES CIRÍLICOS");
  console.log("=".repeat(80));
  if (cyrillicItems.length > 0) {
    cyrillicItems.forEach((item, index) => {
      console.log(`${index + 1}. "${item.title}"`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Source: ${item.source}, Type: ${item.type}, Year: ${item.year ?? "N/A"}`);
      console.log();
    });
  } else {
    console.log("No se encontraron items con caracteres cirílicos\n");
  }

  // Buscar los títulos específicos mencionados
  const specificTitles = ["أمونة المزيونة", "Любопытная Варвара 3"];
  console.log("=".repeat(80));
  console.log("BUSCANDO TÍTULOS ESPECÍFICOS");
  console.log("=".repeat(80));
  for (const searchTitle of specificTitles) {
    const found = allItems.filter((item) => 
      item.title.includes(searchTitle) || 
      item.title.toLowerCase().includes(searchTitle.toLowerCase())
    );
    if (found.length > 0) {
      found.forEach((item) => {
        console.log(`✅ Encontrado: "${item.title}"`);
        console.log(`   ID: ${item.id}`);
        console.log(`   Source: ${item.source}, Type: ${item.type}`);
        console.log();
      });
    } else {
      console.log(`❌ No encontrado: "${searchTitle}"`);
    }
  }

  // Eliminar items con árabe o cirílico
  const toDelete = [...arabicItems, ...cyrillicItems];
  if (toDelete.length > 0) {
    console.log("=".repeat(80));
    console.log(`\n🗑️  Eliminando ${toDelete.length} items con caracteres no latinos...\n`);
    const ids = toDelete.map((item) => item.id);
    const result = await prisma.item.deleteMany({
      where: { id: { in: ids } },
    });
    console.log(`✅ Eliminados ${result.count} items`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);

