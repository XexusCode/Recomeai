import { prisma } from "@/server/db/client";
import { buildRecommendations } from "@/server/recommendations/pipeline";

async function checkFromScore() {
  console.log("🔍 Verificando score de FROM en el pipeline completo...\n");

  const result = await buildRecommendations({
    query: "Lost",
    locale: "en",
    limit: 50, // Get more recommendations to see where FROM ranks
  });

  // Buscar FROM en todas las recomendaciones
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
    console.log(`   Creadores: ${fromItem.creators?.join(", ") || "N/A"}`);
    console.log(`   Cast: ${fromItem.cast?.slice(0, 3).join(", ") || "N/A"}`);
    
    console.log(`\n📊 Comparación con top 5:`);
    result.items.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title} - Score: ${item.score.toFixed(4)}`);
    });
  } else {
    console.log(`❌ FROM NO aparece en las primeras ${result.items.length} recomendaciones`);
    console.log(`\n📋 Top 20 recomendaciones:`);
    result.items.slice(0, 20).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (${item.year || "N/A"}) - Score: ${item.score.toFixed(4)}`);
    });
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  checkFromScore().catch(console.error);
}

