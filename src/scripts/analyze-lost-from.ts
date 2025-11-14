import { prisma } from "@/server/db/client";
import { getEmbeddings } from "@/server/embeddings";
import { Prisma } from "@prisma/client";

async function analyzeLostFrom() {
  console.log("🔍 Analizando LOST y FROM...\n");

  // Buscar LOST usando Prisma (maneja columnas opcionales automáticamente)
  const lost = await prisma.item.findMany({
    where: {
      title: {
        contains: "Lost",
        mode: "insensitive",
      },
    },
    take: 5,
    orderBy: {
      popularity: "desc",
    },
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      genres: true,
      synopsis: true,
      popularity: true,
      // Columnas opcionales que pueden no existir
    },
  });

  // Buscar FROM
  const from = await prisma.item.findMany({
    where: {
      title: {
        contains: "From",
        mode: "insensitive",
      },
    },
    take: 5,
    orderBy: {
      popularity: "desc",
    },
    select: {
      id: true,
      title: true,
      type: true,
      year: true,
      genres: true,
      synopsis: true,
      popularity: true,
    },
  });

  // Obtener embeddings y campos adicionales (manejando columnas que pueden no existir)
  const lostWithExtras = await Promise.all(
    lost.map(async (item) => {
      try {
        const extras = await prisma.$queryRaw<Array<{
          creators?: string[] | null;
          cast?: string[] | null;
          embedding?: string | null;
        }>>(Prisma.sql`
          SELECT 
            embedding::text AS embedding
          FROM "Item"
          WHERE id = ${item.id}
          LIMIT 1
        `);
        return {
          ...item,
          creators: null as string[] | null,
          cast: null as string[] | null,
          embedding: extras[0]?.embedding ?? null,
        };
      } catch {
        return {
          ...item,
          creators: null as string[] | null,
          cast: null as string[] | null,
          embedding: null,
        };
      }
    })
  );

  const fromWithExtras = await Promise.all(
    from.map(async (item) => {
      try {
        const extras = await prisma.$queryRaw<Array<{
          creators?: string[] | null;
          cast?: string[] | null;
          embedding?: string | null;
        }>>(Prisma.sql`
          SELECT 
            embedding::text AS embedding
          FROM "Item"
          WHERE id = ${item.id}
          LIMIT 1
        `);
        return {
          ...item,
          creators: null as string[] | null,
          cast: null as string[] | null,
          embedding: extras[0]?.embedding ?? null,
        };
      } catch {
        return {
          ...item,
          creators: null as string[] | null,
          cast: null as string[] | null,
          embedding: null,
        };
      }
    })
  );

  console.log("📺 LOST encontrado:");
  if (lostWithExtras.length === 0) {
    console.log("  ❌ No se encontró LOST en la base de datos\n");
  } else {
    lostWithExtras.forEach((item) => {
      console.log(`  ✓ ${item.title} (${item.year || "N/A"}) - ${item.type}`);
      console.log(`    ID: ${item.id}`);
      console.log(`    Géneros: ${item.genres.join(", ") || "N/A"}`);
      console.log(`    Creadores: ${item.creators?.join(", ") || "N/A"}`);
      console.log(`    Cast: ${item.cast?.slice(0, 3).join(", ") || "N/A"}`);
      console.log(`    Popularidad: ${item.popularity.toFixed(2)}`);
      console.log(`    Sinopsis: ${item.synopsis?.substring(0, 150) || "N/A"}...`);
      console.log(`    Tiene embedding: ${item.embedding ? "✓" : "❌"}`);
      console.log("");
    });
  }

  console.log("📺 FROM encontrado:");
  if (fromWithExtras.length === 0) {
    console.log("  ❌ No se encontró FROM en la base de datos\n");
  } else {
    fromWithExtras.forEach((item) => {
      console.log(`  ✓ ${item.title} (${item.year || "N/A"}) - ${item.type}`);
      console.log(`    ID: ${item.id}`);
      console.log(`    Géneros: ${item.genres.join(", ") || "N/A"}`);
      console.log(`    Creadores: ${item.creators?.join(", ") || "N/A"}`);
      console.log(`    Cast: ${item.cast?.slice(0, 3).join(", ") || "N/A"}`);
      console.log(`    Popularidad: ${item.popularity.toFixed(2)}`);
      console.log(`    Sinopsis: ${item.synopsis?.substring(0, 150) || "N/A"}...`);
      console.log(`    Tiene embedding: ${item.embedding ? "✓" : "❌"}`);
      console.log("");
    });
  }

  // Si ambos existen, analizar similitud
  if (lostWithExtras.length > 0 && fromWithExtras.length > 0) {
    const lostItem = lostWithExtras[0];
    const fromItem = fromWithExtras[0];

    console.log("🔗 Análisis de similitud entre LOST y FROM:\n");

    // 1. Similitud vectorial
    if (lostItem.embedding && fromItem.embedding) {
      const lostEmbedding = parseVector(lostItem.embedding);
      const fromEmbedding = parseVector(fromItem.embedding);
      
      if (lostEmbedding.length === fromEmbedding.length && lostEmbedding.length > 0) {
        const cosineSimilarity = calculateCosineSimilarity(lostEmbedding, fromEmbedding);
        console.log(`  📊 Similitud vectorial (cosine): ${(cosineSimilarity * 100).toFixed(2)}%`);
        console.log(`     (Score normalizado: ${cosineSimilarity.toFixed(4)})`);
        
        if (cosineSimilarity > 0.3) {
          console.log(`     ✅ Buena similitud semántica (>0.3)`);
        } else if (cosineSimilarity > 0.2) {
          console.log(`     ⚠️  Similitud moderada (0.2-0.3)`);
        } else {
          console.log(`     ❌ Baja similitud (<0.2) - podría no aparecer en candidatos iniciales`);
        }
      }
    } else {
      console.log("  ❌ No se puede calcular similitud vectorial (falta embedding)");
    }

    // 2. Creadores compartidos
    console.log("\n  👥 Creadores compartidos:");
    const lostCreators = new Set((lostItem.creators || []).map((c) => c.toLowerCase().trim()));
    const fromCreators = new Set((fromItem.creators || []).map((c) => c.toLowerCase().trim()));
    const sharedCreators: string[] = [];
    
    for (const creator of lostCreators) {
      if (fromCreators.has(creator)) {
        sharedCreators.push(creator);
      }
    }
    
    if (sharedCreators.length > 0) {
      console.log(`     ✅ Comparten ${sharedCreators.length} creador(es): ${sharedCreators.join(", ")}`);
      console.log(`     Boost esperado: ${Math.min(1.0, sharedCreators.length / Math.min(lostCreators.size, fromCreators.size)).toFixed(2)} (10% del score final)`);
    } else {
      console.log(`     ❌ No comparten creadores`);
      console.log(`     LOST: ${Array.from(lostCreators).join(", ") || "N/A"}`);
      console.log(`     FROM: ${Array.from(fromCreators).join(", ") || "N/A"}`);
    }

    // 3. Similitud de sinopsis (Jaccard)
    console.log("\n  📝 Similitud de sinopsis:");
    if (lostItem.synopsis && fromItem.synopsis) {
      const jaccard = calculateJaccardSimilarity(lostItem.synopsis, fromItem.synopsis);
      console.log(`     Jaccard similarity: ${(jaccard * 100).toFixed(2)}%`);
      
      if (jaccard >= 0.2) {
        const boost = jaccard >= 0.7 ? 1.0 : (jaccard - 0.2) / 0.5;
        console.log(`     ✅ Boost esperado: ${boost.toFixed(2)} (5% del score final)`);
      } else {
        console.log(`     ❌ Sin boost (similarity < 0.2)`);
      }
    } else {
      console.log(`     ❌ No se puede calcular (falta sinopsis)`);
    }

    // 4. Diferencia de año
    console.log("\n  📅 Diferencia de año:");
    if (lostItem.year && fromItem.year) {
      const yearDiff = Math.abs(lostItem.year - fromItem.year);
      console.log(`     Diferencia: ${yearDiff} años`);
      
      let yearBoost = 0;
      if (yearDiff <= 5) yearBoost = 1.0;
      else if (yearDiff <= 10) yearBoost = 0.5;
      else if (yearDiff <= 15) yearBoost = 0.2;
      
      if (yearBoost > 0) {
        console.log(`     ✅ Boost esperado: ${yearBoost.toFixed(2)} (5% del score final)`);
      } else {
        console.log(`     ❌ Sin boost (diferencia > 15 años)`);
      }
    } else {
      console.log(`     ❌ No se puede calcular (falta año)`);
    }

    // 5. Diferencia de popularidad
    console.log("\n  📊 Diferencia de popularidad:");
    const popDiff = Math.abs(lostItem.popularity - fromItem.popularity);
    console.log(`     Diferencia: ${popDiff.toFixed(2)} puntos`);
    
    let popBoost = 0;
    if (popDiff <= 20) popBoost = 1.0;
    else if (popDiff <= 40) popBoost = 0.5;
    else if (popDiff <= 60) popBoost = 0.2;
    
    if (popBoost > 0) {
      console.log(`     ✅ Boost esperado: ${popBoost.toFixed(2)} (3% del score final)`);
    } else {
      console.log(`     ❌ Sin boost (diferencia > 60 puntos)`);
    }

    // 6. Cast compartido
    console.log("\n  🎭 Cast compartido:");
    const lostCast = new Set((lostItem.cast || []).map((c) => c.toLowerCase().trim()));
    const fromCast = new Set((fromItem.cast || []).map((c) => c.toLowerCase().trim()));
    const sharedCast: string[] = [];
    
    for (const actor of lostCast) {
      if (fromCast.has(actor)) {
        sharedCast.push(actor);
      }
    }
    
    if (sharedCast.length > 0) {
      const castBoost = sharedCast.length >= 2 ? 1.0 : 0.5;
      console.log(`     ✅ Comparten ${sharedCast.length} actor(es): ${sharedCast.join(", ")}`);
      console.log(`     Boost esperado: ${castBoost.toFixed(2)} (2% del score final)`);
    } else {
      console.log(`     ❌ No comparten actores`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("📋 RESUMEN:");
    console.log("=".repeat(60));
    
    // Calcular score estimado (asumiendo vectorScore moderado)
    const vectorScore = lostItem.embedding && fromItem.embedding 
      ? calculateCosineSimilarity(parseVector(lostItem.embedding), parseVector(fromItem.embedding))
      : 0.25; // Estimación conservadora
    
    const creatorBoost = sharedCreators.length > 0 
      ? Math.min(1.0, sharedCreators.length / Math.min(lostCreators.size, fromCreators.size))
      : 0;
    
    const synopsisBoost = lostItem.synopsis && fromItem.synopsis
      ? (() => {
          const jaccard = calculateJaccardSimilarity(lostItem.synopsis!, fromItem.synopsis!);
          if (jaccard < 0.2) return 0;
          if (jaccard >= 0.7) return 1.0;
          return (jaccard - 0.2) / 0.5;
        })()
      : 0;
    
    const yearBoost = lostItem.year && fromItem.year
      ? (() => {
          const diff = Math.abs(lostItem.year! - fromItem.year!);
          if (diff <= 5) return 1.0;
          if (diff <= 10) return 0.5;
          if (diff <= 15) return 0.2;
          return 0;
        })()
      : 0;
    
    const popBoostCalc = (() => {
      const diff = Math.abs(lostItem.popularity - fromItem.popularity);
      if (diff <= 20) return 1.0;
      if (diff <= 40) return 0.5;
      if (diff <= 60) return 0.2;
      return 0;
    })();
    
    const castBoost = sharedCast.length >= 2 ? 1.0 : sharedCast.length === 1 ? 0.5 : 0;
    
    // Score estimado (asumiendo rerankScore y fusedScore moderados)
    const rerankScore = 0.3; // Estimación conservadora
    const fusedScore = 0.2; // Estimación conservadora
    
    const estimatedScore = (vectorScore * 0.4) + (rerankScore * 0.25) + (fusedScore * 0.1) +
                          (creatorBoost * 0.1) + (synopsisBoost * 0.05) +
                          (yearBoost * 0.05) + (popBoostCalc * 0.03) + (castBoost * 0.02);
    
    console.log(`\n  Score estimado: ${estimatedScore.toFixed(4)}`);
    console.log(`  Componentes:`);
    console.log(`    - Vector Score (40%): ${vectorScore.toFixed(4)}`);
    console.log(`    - Rerank Score (25%): ${rerankScore.toFixed(4)} (estimado)`);
    console.log(`    - Fused Score (10%): ${fusedScore.toFixed(4)} (estimado)`);
    console.log(`    - Creator Boost (10%): ${creatorBoost.toFixed(4)}`);
    console.log(`    - Synopsis Boost (5%): ${synopsisBoost.toFixed(4)}`);
    console.log(`    - Year Boost (5%): ${yearBoost.toFixed(4)}`);
    console.log(`    - Popularity Boost (3%): ${popBoostCalc.toFixed(4)}`);
    console.log(`    - Cast Boost (2%): ${castBoost.toFixed(4)}`);
    
    console.log(`\n  ⚠️  NOTA: Este score es estimado. El score real depende de:`);
    console.log(`     - Si FROM aparece en los primeros 120 candidatos por similitud vectorial`);
    console.log(`     - El reranking de Cohere (que ahora incluye contexto del anchor)`);
    console.log(`     - La diversidad aplicada por MMR`);
  }

  await prisma.$disconnect();
}

function parseVector(vectorStr: string): number[] {
  try {
    // Remove brackets and split by comma
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

function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  
  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  
  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }
  
  const union = words1.size + words2.size - intersection;
  if (union === 0) {
    return 0;
  }
  
  return intersection / union;
}

if (require.main === module) {
  analyzeLostFrom().catch(console.error);
}

