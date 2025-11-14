import { prisma } from "@/server/db/client";
import { retrieveCandidates } from "@/server/recommendations/retrieve";
import { resolveSeed } from "@/server/recommendations/seed";
import { rerankCandidates } from "@/server/recommendations/rerank";
import { getEmbeddings } from "@/server/embeddings";
async function analyzeFromScore() {
  console.log("🔍 Analizando score completo de FROM...\n");

  const seed = await resolveSeed("Lost", {});
  if (!seed.anchor) {
    console.log("❌ No se encontró LOST como anchor");
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Anchor: ${seed.anchor.title} (${seed.anchor.year})`);
  console.log(`   Creadores: ${seed.anchor.creators?.join(", ") || "N/A"}\n`);

  let embedding = seed.embedding;
  if (!embedding?.length) {
    const fallbackEmbeddings = getEmbeddings();
    const [vector] = await fallbackEmbeddings.embed(["Lost"]);
    embedding = vector ?? [];
  }

  const retrieval = await retrieveCandidates("Lost", embedding, {}, 120);
  const fromCandidate = retrieval.candidates.find((c) => 
    c.item.title.toLowerCase().includes("from") && 
    c.item.type === "tv" &&
    c.item.year === 2022
  );

  if (!fromCandidate) {
    console.log("❌ FROM no está en los candidatos iniciales");
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ FROM encontrado en candidatos iniciales`);
  console.log(`   Posición: ${retrieval.candidates.indexOf(fromCandidate) + 1}/${retrieval.candidates.length}`);
  console.log(`   Vector Score: ${fromCandidate.vectorScore?.toFixed(4) || "N/A"}`);
  console.log(`   Fused Score: ${fromCandidate.fusedScore?.toFixed(4) || "N/A"}\n`);

  // Aplicar reranking
  const reranked = await rerankCandidates("Lost", retrieval.candidates.slice(0, 100), {
    locale: "en",
    anchor: {
      title: seed.anchor.title,
      synopsis: seed.anchor.synopsis,
      genres: seed.anchor.genres,
      creators: seed.anchor.creators,
    },
    topK: 100,
  });

  const fromReranked = reranked.find((c) => c.id === fromCandidate.id);
  if (!fromReranked) {
    console.log("❌ FROM no está en los candidatos rerankeado");
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ FROM después del reranking:`);
  console.log(`   Posición: ${reranked.indexOf(fromReranked) + 1}/${reranked.length}`);
  console.log(`   Rerank Score: ${fromReranked.rerankScore?.toFixed(4) || "N/A"}\n`);

  // Calcular todos los boosts
  const creatorBoost = calculateCreatorBoost(seed.anchor, fromReranked.item);
  const synopsisBoost = calculateSynopsisBoost(seed.anchor, fromReranked.item);
  const yearBoost = calculateYearBoost(seed.anchor, fromReranked.item);
  const popularityBoost = calculatePopularityBoost(seed.anchor, fromReranked.item);
  const castBoost = calculateCastBoost(seed.anchor, fromReranked.item);

  console.log(`📊 Boosts calculados:`);
  console.log(`   Creator Boost: ${creatorBoost.toFixed(4)} (20% del score)`);
  console.log(`   Synopsis Boost: ${synopsisBoost.toFixed(4)} (5% del score)`);
  console.log(`   Year Boost: ${yearBoost.toFixed(4)} (5% del score)`);
  console.log(`   Popularity Boost: ${popularityBoost.toFixed(4)} (3% del score)`);
  console.log(`   Cast Boost: ${castBoost.toFixed(4)} (2% del score)\n`);

  // Calcular score final
  const vec = fromReranked.vectorScore ?? 0;
  const rerank = fromReranked.rerankScore ?? 0;
  const fused = fromReranked.fusedScore ?? 0;
  const finalScore = (vec * 0.35) + (rerank * 0.25) + (fused * 0.1) + 
                    (creatorBoost * 0.15) + (synopsisBoost * 0.05) + 
                    (yearBoost * 0.05) + (popularityBoost * 0.03) + (castBoost * 0.02);

  console.log(`📈 Score final calculado:`);
  console.log(`   Vector (30%): ${(vec * 0.30).toFixed(4)}`);
  console.log(`   Rerank (25%): ${(rerank * 0.25).toFixed(4)}`);
  console.log(`   Fused (10%): ${(fused * 0.1).toFixed(4)}`);
  console.log(`   Creator Boost (20%): ${(creatorBoost * 0.20).toFixed(4)}`);
  console.log(`   Synopsis Boost (5%): ${(synopsisBoost * 0.05).toFixed(4)}`);
  console.log(`   Year Boost (5%): ${(yearBoost * 0.05).toFixed(4)}`);
  console.log(`   Popularity Boost (3%): ${(popularityBoost * 0.03).toFixed(4)}`);
  console.log(`   Cast Boost (2%): ${(castBoost * 0.02).toFixed(4)}`);
  console.log(`   ─────────────────────────`);
  const updatedFinalScore = (vec * 0.30) + (rerank * 0.25) + (fused * 0.1) + 
                           (creatorBoost * 0.20) + (synopsisBoost * 0.05) + 
                           (yearBoost * 0.05) + (popularityBoost * 0.03) + (castBoost * 0.02);
  console.log(`   TOTAL (con nuevos pesos): ${updatedFinalScore.toFixed(4)}\n`);

  // Comparar con top 10
  const sortedReranked = reranked.sort((a, b) => {
    const aVec = a.vectorScore ?? 0;
    const bVec = b.vectorScore ?? 0;
    const aRerank = a.rerankScore ?? 0;
    const bRerank = b.rerankScore ?? 0;
    const aFused = a.fusedScore ?? 0;
    const bFused = b.fusedScore ?? 0;
    
    const aCreatorBoost = calculateCreatorBoost(seed.anchor, a.item);
    const bCreatorBoost = calculateCreatorBoost(seed.anchor, b.item);
    const aSynopsisBoost = calculateSynopsisBoost(seed.anchor, a.item);
    const bSynopsisBoost = calculateSynopsisBoost(seed.anchor, b.item);
    const aYearBoost = calculateYearBoost(seed.anchor, a.item);
    const bYearBoost = calculateYearBoost(seed.anchor, b.item);
    const aPopularityBoost = calculatePopularityBoost(seed.anchor, a.item);
    const bPopularityBoost = calculatePopularityBoost(seed.anchor, b.item);
    const aCastBoost = calculateCastBoost(seed.anchor, a.item);
    const bCastBoost = calculateCastBoost(seed.anchor, b.item);
    
    const aCombined = (aVec * 0.30) + (aRerank * 0.25) + (aFused * 0.1) + 
                     (aCreatorBoost * 0.20) + (aSynopsisBoost * 0.05) + 
                     (aYearBoost * 0.05) + (aPopularityBoost * 0.03) + (aCastBoost * 0.02);
    const bCombined = (bVec * 0.30) + (bRerank * 0.25) + (bFused * 0.1) + 
                     (bCreatorBoost * 0.20) + (bSynopsisBoost * 0.05) + 
                     (bYearBoost * 0.05) + (bPopularityBoost * 0.03) + (bCastBoost * 0.02);
    
    return bCombined - aCombined;
  });

  const fromPosition = sortedReranked.findIndex((c) => c.id === fromCandidate.id);
  console.log(`📊 Posición después de sorting con boosts: ${fromPosition + 1}/${sortedReranked.length}\n`);

  console.log(`📋 Top 10 después de boosts:`);
  sortedReranked.slice(0, 10).forEach((item, i) => {
    const itemVec = item.vectorScore ?? 0;
    const itemRerank = item.rerankScore ?? 0;
    const itemFused = item.fusedScore ?? 0;
    const itemCreatorBoost = calculateCreatorBoost(seed.anchor, item.item);
    const itemSynopsisBoost = calculateSynopsisBoost(seed.anchor, item.item);
    const itemYearBoost = calculateYearBoost(seed.anchor, item.item);
    const itemPopularityBoost = calculatePopularityBoost(seed.anchor, item.item);
    const itemCastBoost = calculateCastBoost(seed.anchor, item.item);
    const itemScore = (itemVec * 0.35) + (itemRerank * 0.25) + (itemFused * 0.1) + 
                     (itemCreatorBoost * 0.15) + (itemSynopsisBoost * 0.05) + 
                     (itemYearBoost * 0.05) + (itemPopularityBoost * 0.03) + (itemCastBoost * 0.02);
    const marker = item.id === fromCandidate.id ? " ⭐ FROM" : "";
    console.log(`   ${i + 1}. ${item.item.title} (${item.item.year || "N/A"}) - Score: ${itemScore.toFixed(4)}${marker}`);
  });

  await prisma.$disconnect();
}

// Necesitamos importar las funciones de boost desde pipeline.ts
// Por ahora las copiamos aquí temporalmente
function calculateCreatorBoost(anchor: any, candidate: any): number {
  if (!anchor?.creators || !candidate.creators || anchor.creators.length === 0 || candidate.creators.length === 0) {
    return 0;
  }
  const anchorSet = new Set(anchor.creators.map((c: string) => c.toLowerCase().trim()));
  const candidateSet = new Set(candidate.creators.map((c: string) => c.toLowerCase().trim()));
  let sharedCount = 0;
  for (const creator of anchorSet) {
    if (candidateSet.has(creator)) {
      sharedCount++;
    }
  }
  if (sharedCount === 0) return 0;
  const maxPossible = Math.min(anchorSet.size, candidateSet.size);
  return Math.min(1.0, sharedCount / maxPossible);
}

function calculateSynopsisBoost(anchor: any, candidate: any): number {
  if (!anchor?.synopsis || !candidate.synopsis) return 0;
  const anchorWords = new Set(anchor.synopsis.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 3));
  const candidateWords = new Set(candidate.synopsis.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 3));
  if (anchorWords.size === 0 || candidateWords.size === 0) return 0;
  let intersection = 0;
  for (const word of anchorWords) {
    if (candidateWords.has(word)) intersection++;
  }
  const union = anchorWords.size + candidateWords.size - intersection;
  if (union === 0) return 0;
  const jaccard = intersection / union;
  if (jaccard < 0.2) return 0;
  if (jaccard >= 0.7) return 1.0;
  return (jaccard - 0.2) / 0.5;
}

function calculateYearBoost(anchor: any, candidate: any): number {
  if (!anchor?.year || !candidate.year) return 0;
  const yearDiff = Math.abs(anchor.year - candidate.year);
  if (yearDiff <= 5) return 1.0;
  if (yearDiff <= 10) return 0.5;
  if (yearDiff <= 15) return 0.2;
  return 0;
}

function calculatePopularityBoost(anchor: any, candidate: any): number {
  if (!anchor?.popularity || !candidate.popularity) return 0;
  const popDiff = Math.abs(anchor.popularity - candidate.popularity);
  if (popDiff <= 20) return 1.0;
  if (popDiff <= 40) return 0.5;
  if (popDiff <= 60) return 0.2;
  return 0;
}

function calculateCastBoost(anchor: any, candidate: any): number {
  if (!anchor?.cast || !candidate.cast || anchor.cast.length === 0 || candidate.cast.length === 0) return 0;
  const anchorSet = new Set(anchor.cast.map((c: string) => c.toLowerCase().trim()));
  const candidateSet = new Set(candidate.cast.map((c: string) => c.toLowerCase().trim()));
  let sharedCount = 0;
  for (const actor of anchorSet) {
    if (candidateSet.has(actor)) sharedCount++;
  }
  if (sharedCount === 0) return 0;
  if (sharedCount >= 2) return 1.0;
  if (sharedCount === 1) return 0.5;
  return 0;
}

if (require.main === module) {
  analyzeFromScore().catch(console.error);
}

