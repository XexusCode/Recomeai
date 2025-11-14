import { prisma } from "@/server/db/client";
import { buildRecommendations } from "@/server/recommendations/pipeline";

async function testRecommendations() {
  console.log("🧪 Probando recomendaciones para LOST...\n");

  const result = await buildRecommendations({
    query: "Lost",
    locale: "en",
    limit: 10,
  });

  console.log(`✅ Se generaron ${result.items.length} recomendaciones\n`);

  // Buscar si FROM está en las recomendaciones
  const fromIndex = result.items.findIndex((item) => 
    item.title.toLowerCase().includes("from") && 
    item.type === "tv" &&
    item.year === 2022
  );

  if (fromIndex >= 0) {
    const fromItem = result.items[fromIndex];
    console.log(`🎉 ¡FROM aparece en las recomendaciones!`);
    console.log(`   Posición: #${fromIndex + 1}`);
    console.log(`   Título: ${fromItem.title}`);
    console.log(`   Score: ${fromItem.score.toFixed(4)}`);
    console.log(`   Año: ${fromItem.year}`);
    console.log(`   Géneros: ${fromItem.genres.join(", ")}`);
    console.log(`   Creadores: ${fromItem.creators?.join(", ") || "N/A"}`);
    console.log(`   Cast: ${fromItem.cast?.slice(0, 3).join(", ") || "N/A"}`);
  } else {
    console.log(`❌ FROM NO aparece en las recomendaciones`);
    console.log(`\n📋 Top 10 recomendaciones:`);
    result.items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (${item.year || "N/A"}) - Score: ${item.score.toFixed(4)}`);
    });
  }

  console.log(`\n📊 Estadísticas:`);
  console.log(`   Total candidatos procesados: ${result.debug?.totalCandidates || "N/A"}`);
  console.log(`   Relajaciones aplicadas: ${result.debug?.relaxations || 0}`);

  await prisma.$disconnect();
}

if (require.main === module) {
  testRecommendations().catch(console.error);
}

