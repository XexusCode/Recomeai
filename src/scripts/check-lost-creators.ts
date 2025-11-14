import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

async function checkLostCreators() {
  console.log("🔍 Verificando creadores de Lost (2004)...\n");

  const lost = await prisma.item.findFirst({
    where: {
      title: {
        equals: "Lost",
        mode: "insensitive",
      },
      year: 2004,
      type: "tv",
    },
    select: {
      id: true,
      title: true,
      year: true,
      creators: true,
      cast: true,
    },
  });

  if (!lost) {
    console.log("❌ No se encontró Lost (2004)");
  } else {
    console.log(`✅ ${lost.title} (${lost.year})`);
    console.log(`   ID: ${lost.id}`);
    console.log(`   Creadores: ${lost.creators?.join(", ") || "N/A (array vacío)"}`);
    console.log(`   Cast: ${lost.cast?.slice(0, 5).join(", ") || "N/A (array vacío)"}`);
    console.log(`   Tiene creadores: ${lost.creators && lost.creators.length > 0 ? "✅" : "❌"}`);
    console.log(`   Tiene cast: ${lost.cast && lost.cast.length > 0 ? "✅" : "❌"}`);
  }

  // Verificar FROM también
  console.log("\n🔍 Verificando creadores de FROM (2022)...\n");
  const fromItem = await prisma.item.findFirst({
    where: {
      title: {
        equals: "FROM",
        mode: "insensitive",
      },
      year: 2022,
      type: "tv",
    },
    select: {
      id: true,
      title: true,
      year: true,
      creators: true,
      cast: true,
    },
  });

  if (!fromItem) {
    console.log("❌ No se encontró FROM (2022)");
  } else {
    console.log(`✅ ${fromItem.title} (${fromItem.year})`);
    console.log(`   ID: ${fromItem.id}`);
    console.log(`   Creadores: ${fromItem.creators?.join(", ") || "N/A (array vacío)"}`);
    console.log(`   Cast: ${fromItem.cast?.slice(0, 5).join(", ") || "N/A (array vacío)"}`);
    console.log(`   Tiene creadores: ${fromItem.creators && fromItem.creators.length > 0 ? "✅" : "❌"}`);
    console.log(`   Tiene cast: ${fromItem.cast && fromItem.cast.length > 0 ? "✅" : "❌"}`);
    
    // Si ambos tienen creadores, verificar si comparten
    if (lost && lost.creators && lost.creators.length > 0 && 
        fromItem.creators && fromItem.creators.length > 0) {
      const lostCreators = new Set(lost.creators.map((c) => c.toLowerCase().trim()));
      const fromCreatorsSet = new Set(fromItem.creators.map((c) => c.toLowerCase().trim()));
      const shared: string[] = [];
      
      for (const creator of lostCreators) {
        if (fromCreatorsSet.has(creator)) {
          shared.push(creator);
        }
      }
      
      console.log(`\n🔗 Creadores compartidos: ${shared.length > 0 ? shared.join(", ") : "Ninguno"}`);
    }
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  checkLostCreators().catch(console.error);
}

