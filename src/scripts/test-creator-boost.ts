import { prisma } from "@/server/db/client";

// Simular el cálculo de creatorBoost con el nuevo algoritmo
function calculateCreatorBoostImproved(anchorCreators: string[], candidateCreators: string[]): number {
  if (!anchorCreators || !candidateCreators || anchorCreators.length === 0 || candidateCreators.length === 0) {
    return 0;
  }
  
  const anchorCreatorsNorm = anchorCreators.map((c) => c.toLowerCase().trim());
  const candidateCreatorsNorm = candidateCreators.map((c) => c.toLowerCase().trim());
  const candidateSet = new Set(candidateCreatorsNorm);
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // Weight creators by position: first = 1.0, second = 0.7, third+ = 0.5
  for (let i = 0; i < anchorCreatorsNorm.length; i++) {
    const creator = anchorCreatorsNorm[i];
    let weight = 1.0;
    if (i === 1) weight = 0.7; // Second creator
    else if (i >= 2) weight = 0.5; // Third and beyond
    
    if (candidateSet.has(creator)) {
      weightedScore += weight;
      console.log(`  ✅ Creador compartido "${creator}" en posición ${i + 1} (peso: ${weight.toFixed(1)})`);
    }
    totalWeight += weight;
  }
  
  if (weightedScore === 0) {
    return 0;
  }
  
  // Normalize by total possible weight
  const result = Math.min(1.0, weightedScore / totalWeight);
  console.log(`  Peso total: ${totalWeight.toFixed(2)}, Score ponderado: ${weightedScore.toFixed(2)}, Boost final: ${result.toFixed(4)}`);
  return result;
}

async function testCreatorBoost() {
  console.log("🔍 Probando nuevo cálculo de creatorBoost...\n");

  const lost = await prisma.item.findFirst({
    where: {
      title: { equals: "Lost", mode: "insensitive" },
      year: 2004,
      type: "tv",
    },
    select: { creators: true },
  });

  const from = await prisma.item.findFirst({
    where: {
      title: { equals: "FROM", mode: "insensitive" },
      year: 2022,
      type: "tv",
    },
    select: { creators: true },
  });

  if (!lost?.creators || !from?.creators) {
    console.log("❌ No se encontraron creadores");
    await prisma.$disconnect();
    return;
  }

  console.log(`LOST creadores (${lost.creators.length}): ${lost.creators.join(", ")}`);
  console.log(`FROM creadores (${from.creators.length}): ${from.creators.join(", ")}\n`);

  const boost = calculateCreatorBoostImproved(lost.creators, from.creators);
  console.log(`\n📊 CreatorBoost final: ${boost.toFixed(4)}`);
  console.log(`   Threshold para highRelevanceItems: 0.2`);
  console.log(`   ${boost >= 0.2 ? "✅" : "❌"} ${boost >= 0.2 ? "Cumple threshold" : "NO cumple threshold"}`);

  await prisma.$disconnect();
}

if (require.main === module) {
  testCreatorBoost().catch(console.error);
}

