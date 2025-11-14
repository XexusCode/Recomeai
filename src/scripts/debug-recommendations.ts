import { prisma } from "@/server/db/client";
import { retrieveCandidates } from "@/server/recommendations/retrieve";
import { resolveSeed } from "@/server/recommendations/seed";
import { getEmbeddings } from "@/server/embeddings";
import { Prisma } from "@prisma/client";

async function debugRecommendations() {
  console.log("🔍 Debug: Analizando por qué FROM no aparece...\n");

  // Resolver seed (LOST)
  const seed = await resolveSeed("Lost", {});
  if (!seed.anchor) {
    console.log("❌ No se encontró LOST como anchor");
    await prisma.$disconnect();
    return;
  }

  console.log(`✅ Anchor encontrado: ${seed.anchor.title} (${seed.anchor.year})\n`);

  // Obtener embedding
  let embedding = seed.embedding;
  if (!embedding?.length) {
    const fallbackEmbeddings = getEmbeddings();
    const [vector] = await fallbackEmbeddings.embed(["Lost"]);
    embedding = vector ?? [];
  }

  // Recuperar candidatos
  const retrieval = await retrieveCandidates("Lost", embedding, {}, 120);
  console.log(`📊 Candidatos recuperados: ${retrieval.candidates.length}\n`);

  // Buscar FROM en los candidatos
  const fromCandidate = retrieval.candidates.find((c) => 
    c.item.title.toLowerCase().includes("from") && 
    c.item.type === "tv" &&
    c.item.year === 2022
  );

  if (fromCandidate) {
    console.log(`✅ FROM encontrado en candidatos iniciales:`);
    console.log(`   Posición en lista: ${retrieval.candidates.indexOf(fromCandidate) + 1}/${retrieval.candidates.length}`);
    console.log(`   Vector Score: ${fromCandidate.vectorScore?.toFixed(4) || "N/A"}`);
    console.log(`   Fused Score: ${fromCandidate.fusedScore?.toFixed(4) || "N/A"}`);
    console.log(`   Título: ${fromCandidate.item.title}`);
    console.log(`   Año: ${fromCandidate.item.year}`);
    console.log(`   Géneros: ${fromCandidate.item.genres.join(", ")}`);
    console.log(`   Creadores: ${fromCandidate.item.creators?.join(", ") || "N/A"}`);
    console.log(`   Cast: ${fromCandidate.item.cast?.slice(0, 3).join(", ") || "N/A"}`);
    
    // Mostrar top 10 candidatos para comparar
    console.log(`\n📋 Top 10 candidatos por fusedScore:`);
    retrieval.candidates
      .slice(0, 10)
      .forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.item.title} (${c.item.year || "N/A"}) - Fused: ${c.fusedScore?.toFixed(4)}, Vector: ${c.vectorScore?.toFixed(4)}`);
      });
  } else {
    console.log(`❌ FROM NO está en los primeros 120 candidatos`);
    console.log(`\n📋 Top 10 candidatos por fusedScore:`);
    retrieval.candidates
      .slice(0, 10)
      .forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.item.title} (${c.item.year || "N/A"}) - Fused: ${c.fusedScore?.toFixed(4)}, Vector: ${c.vectorScore?.toFixed(4)}`);
      });
    
    // Buscar FROM en toda la base de datos para ver su similitud
    const fromItem = await prisma.item.findFirst({
      where: {
        title: {
          contains: "FROM",
          mode: "insensitive",
        },
        type: "tv",
        year: 2022,
      },
      select: {
        id: true,
        title: true,
        year: true,
      },
    });

    if (fromItem && seed.embedding) {
      // Calcular similitud vectorial manualmente
      const fromEmbedding = await prisma.$queryRaw<Array<{ embedding: string }>>(
        Prisma.sql`SELECT embedding::text AS embedding FROM "Item" WHERE id = ${fromItem.id} LIMIT 1`
      );
      
      if (fromEmbedding[0]?.embedding) {
        const fromVec = parseVector(fromEmbedding[0].embedding);
        const lostVec = seed.embedding;
        
        if (fromVec.length === lostVec.length && fromVec.length > 0) {
          const similarity = calculateCosineSimilarity(lostVec, fromVec);
          console.log(`\n🔗 Similitud vectorial directa LOST -> FROM: ${(similarity * 100).toFixed(2)}%`);
          
          // Ver qué items tienen mejor similitud
          const minSimilarity = Math.min(...retrieval.candidates.slice(0, 10).map(c => c.vectorScore || 0));
          console.log(`   Similitud mínima en top 10: ${(minSimilarity * 100).toFixed(2)}%`);
          
          if (similarity < minSimilarity) {
            console.log(`   ⚠️  FROM tiene menor similitud que los top 10 candidatos`);
          } else {
            console.log(`   ✅ FROM debería estar en los candidatos (similitud suficiente)`);
          }
        }
      }
    }
  }

  await prisma.$disconnect();
}

function parseVector(vectorStr: string): number[] {
  try {
    const cleaned = vectorStr.replace(/[\[\]]/g, "");
    return cleaned.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v));
  } catch {
    return [];
  }
}

function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length || vec1.length === 0) {
    return 0;
  }
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0;
  }
  
  return dotProduct / denominator;
}

if (require.main === module) {
  debugRecommendations().catch(console.error);
}

