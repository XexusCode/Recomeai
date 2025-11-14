import { prisma } from "@/server/db/client";
import { buildRecommendations } from "@/server/recommendations/pipeline";

async function testFromInHighRelevance() {
  console.log("🔍 Verificando si FROM está en highRelevanceItems...\n");

  // Simular el pipeline paso a paso
  const result = await buildRecommendations({
    query: "Lost",
    locale: "en",
    limit: 20, // Get more to see if FROM appears
  });

  const fromIndex = result.items.findIndex((item) => 
    item.title.toLowerCase().includes("from") && 
    item.type === "tv" &&
    item.year === 2022
  );

  if (fromIndex >= 0) {
    const fromItem = result.items[fromIndex];
    console.log(`✅ FROM aparece en las recomendaciones!`);
    console.log(`   Posición: #${fromIndex + 1} de ${result.items.length}`);
    console.log(`   Score: ${fromItem.score.toFixed(4)}`);
    console.log(`   Título: ${fromItem.title}`);
  } else {
    console.log(`❌ FROM NO aparece en las primeras ${result.items.length} recomendaciones`);
    console.log(`\n📋 Top 20 recomendaciones:`);
    result.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (${item.year || "N/A"}) - Score: ${item.score.toFixed(4)}`);
    });
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  testFromInHighRelevance().catch(console.error);
}

