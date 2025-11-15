import "dotenv/config";
import { requireDatabaseUrl } from "@/env";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import { prisma } from "@/server/db/client";

async function main() {
  requireDatabaseUrl();
  
  console.log("🔍 Buscando items con caracteres no latinos (incluyendo mezclados)...\n");
  
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      source: true,
    },
  });
  
  console.log(`Total items en BD: ${allItems.length}\n`);
  
  // Test each item
  const nonLatinItems: Array<{ item: typeof allItems[0]; reason: string }> = [];
  
  for (const item of allItems) {
    if (!hasLatinCharacters(item.title)) {
      // Find which characters are problematic
      const chars = [...item.title];
      const problematicChars: string[] = [];
      
      for (const char of chars) {
        const code = char.charCodeAt(0);
        // Check if it's not Latin, number, space, or common punctuation
        const isLatin = /[A-Za-z0-9\s.,!?'"-:;()[\]{}]/.test(char);
        const isCJK = code >= 0x3040 && code <= 0x30FF || code >= 0x4E00 && code <= 0x9FAF || code >= 0x3400 && code <= 0x4DBF;
        const isCyrillic = code >= 0x0400 && code <= 0x04FF;
        const isArabic = code >= 0x0600 && code <= 0x06FF;
        const isHangul = code >= 0xAC00 && code <= 0xD7AF;
        
        if (!isLatin || isCJK || isCyrillic || isArabic || isHangul) {
          problematicChars.push(`'${char}' (U+${code.toString(16).padStart(4, '0').toUpperCase()})`);
        }
      }
      
      nonLatinItems.push({
        item,
        reason: problematicChars.length > 0 
          ? `Caracteres problemáticos: ${problematicChars.join(', ')}`
          : 'Sin letras latinas',
      });
    }
  }
  
  if (nonLatinItems.length === 0) {
    console.log("✅ No se encontraron items con títulos no latinos.");
    await prisma.$disconnect();
    return;
  }
  
  console.log(`❌ Se encontraron ${nonLatinItems.length} items con títulos no latinos:\n`);
  console.log("=".repeat(80));
  
  nonLatinItems.forEach(({ item, reason }, index) => {
    console.log(`${index + 1}. "${item.title}"`);
    console.log(`   ID: ${item.id}`);
    console.log(`   Tipo: ${item.type}, Año: ${item.year ?? "N/A"}, Source: ${item.source}`);
    console.log(`   Razón: ${reason}`);
    console.log();
  });
  
  console.log("=".repeat(80));
  console.log(`\n🗑️  Eliminando estos ${nonLatinItems.length} items...\n`);
  
  const ids = nonLatinItems.map(({ item }) => item.id);
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

