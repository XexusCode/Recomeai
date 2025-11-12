import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/client";
import { CandidateWithScores, RecommendationPayload } from "@/lib/types";
import { reciprocalRankFusion } from "@/lib/rrf";

export interface RecommendationFilters {
  type?: string;
  yearMin?: number;
  yearMax?: number;
  popMin?: number;
}

export interface RetrievalResult {
  candidates: CandidateWithScores[];
}

export async function retrieveCandidates(
  query: string,
  embedding: number[],
  filters: RecommendationFilters,
  limit = 100,
): Promise<RetrievalResult> {
  const ftsRows = await ftsSearch(query, filters, limit);
  let vectorRows = embedding.length ? await vectorSearch(embedding, filters, limit) : [];

  console.log(`[Retrieval] FTS search returned ${ftsRows.length} results`);
  console.log(`[Retrieval] Vector search returned ${vectorRows.length} results (embedding dim: ${embedding.length})`);
  
  // If we have a popularity filter and got fewer results, also search for high-relevance items
  // ignoring popularity filter (to catch items like "The Flash" with low popularity but high semantic similarity)
  if (filters.popMin && embedding.length && vectorRows.length < limit * 0.8) {
    const filtersWithoutPop = { ...filters, popMin: undefined };
    const highRelevanceRows = await vectorSearch(embedding, filtersWithoutPop, Math.floor(limit * 0.3));
    
    // Filter to only include items with high vector similarity (>0.35) that were excluded by popularity
    const highRelevanceFiltered = highRelevanceRows.filter(
      (row) => (row.vecScore ?? 0) > 0.35 && 
               (!filters.popMin || (row.popularity ?? 0) < filters.popMin)
    );
    
    if (highRelevanceFiltered.length > 0) {
      console.log(`[Retrieval] Found ${highRelevanceFiltered.length} high-relevance items ignored by popularity filter (vecScore > 0.35)`);
      // Merge, avoiding duplicates
      const existingIds = new Set(vectorRows.map((r) => r.id));
      const newRows = highRelevanceFiltered.filter((r) => !existingIds.has(r.id));
      vectorRows = [...vectorRows, ...newRows];
      console.log(`[Retrieval] Added ${newRows.length} high-relevance items to vector results (total: ${vectorRows.length})`);
    }
  }

  // Use RRF for ranking, but also consider raw scores for better fusion
  // This helps items with high vector similarity but no FTS match
  const ftsScores = ftsRows.map((row) => ({ id: row.id, score: row.ftsRank ?? 0 }));
  const vectorScores = vectorRows.map((row) => ({ id: row.id, score: row.vecScore ?? 0 }));

  const rrf = reciprocalRankFusion([ftsScores, vectorScores], 60);
  
  // Enhance RRF scores with actual similarity scores for items with good vector similarity
  // This ensures items with high vectorScore but no FTS match still rank well
  const enhancedFused = new Map<string, number>();
  rrf.forEach((rrfScore, id) => {
    const vectorRow = vectorRows.find((r) => r.id === id);
    const ftsRow = ftsRows.find((r) => r.id === id);
    
    let enhancedScore = rrfScore;
    
    // If item has high vector similarity but no FTS match, boost it
    if (vectorRow && vectorRow.vecScore && (!ftsRow || !ftsRow.ftsRank)) {
      // Boost items with vectorScore > 0.3 (good similarity) but no FTS match
      if (vectorRow.vecScore > 0.3) {
        enhancedScore = rrfScore + (vectorRow.vecScore * 0.1); // Add 10% of vectorScore as boost
      }
    }
    
    // Also boost items that appear in both lists
    if (ftsRow && ftsRow.ftsRank && vectorRow && vectorRow.vecScore) {
      enhancedScore = rrfScore * 1.2; // 20% boost for items in both lists
    }
    
    enhancedFused.set(id, enhancedScore);
  });
  
  console.log(`[Retrieval] RRF fusion produced ${enhancedFused.size} unique candidates (enhanced with score boosts)`);

  const combined = new Map<string, RecommendationPayload>();
  for (const row of [...ftsRows, ...vectorRows]) {
    if (!combined.has(row.id)) {
      combined.set(row.id, mapRow(row));
    }
  }

  const candidates = Array.from(enhancedFused.entries()).reduce<CandidateWithScores[]>((acc, [id, fusedScore]) => {
    const payload = combined.get(id);
    if (!payload) {
      return acc;
    }
    const ftsScore = ftsRows.find((row) => row.id === id)?.ftsRank;
    const vectorScore = vectorRows.find((row) => row.id === id)?.vecScore;
    acc.push({
      id,
      item: payload,
      fusedScore,
      ftsScore: ftsScore ?? undefined,
      vectorScore: vectorScore ?? undefined,
    });
    return acc;
  }, []).sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0));

  // Log score distribution
  if (candidates.length > 0) {
    const scores = candidates.map((c) => c.fusedScore ?? 0);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`[Retrieval] Score distribution - max: ${maxScore.toFixed(4)}, min: ${minScore.toFixed(4)}, avg: ${avgScore.toFixed(4)}`);
  }

  return { candidates };
}

interface Row {
  id: string;
  title: string;
  type: string;
  source: string;
  year: number | null;
  genres: string[];
  synopsis: string | null;
  posterUrl: string | null;
  popularity: number;
  providerUrl: string | null;
  availability: unknown;
  franchiseKey: string | null;
  ftsRank?: number | null;
  vecScore?: number | null;
}

function mapRow(row: Row): RecommendationPayload {
  return {
    id: row.id,
    title: row.title,
    type: row.type as RecommendationPayload["type"],
    source: row.source as RecommendationPayload["source"],
    year: row.year,
    genres: row.genres ?? [],
    synopsis: row.synopsis,
    posterUrl: row.posterUrl,
    popularity: row.popularity,
    providerUrl: row.providerUrl,
    availability: (row.availability as RecommendationPayload["availability"]) ?? [],
    franchiseKey: row.franchiseKey,
    reason: undefined,
    score: 0,
  };
}

async function ftsSearch(query: string, filters: RecommendationFilters, limit: number): Promise<Row[]> {
  const where = buildWhere(filters);
  return prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT
      i.id,
      i.title,
      i.type,
      i.source,
      i.year,
      i.genres,
      i.synopsis,
      i."posterUrl",
      i.popularity,
      i."providerUrl",
      i.availability,
      i."franchiseKey",
      ts_rank_cd(i."titleNorm", websearch_to_tsquery('english', ${query})) AS "ftsRank"
    FROM "Item" i
    WHERE ${where}
      AND i."titleNorm" @@ websearch_to_tsquery('english', ${query})
    ORDER BY "ftsRank" DESC
    LIMIT ${limit}
  `);
}

async function vectorSearch(embedding: number[], filters: RecommendationFilters, limit: number): Promise<Row[]> {
  const where = buildWhere(filters);
  const vectorText = `[${embedding
    .map((value) => (Number.isFinite(value) ? value.toFixed(6) : "0.000000"))
    .join(", ")}]`;
  return prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH seed AS (
      SELECT ${vectorText}::vector AS embedding
    )
    SELECT
      i.id,
      i.title,
      i.type,
      i.source,
      i.year,
      i.genres,
      i.synopsis,
      i."posterUrl",
      i.popularity,
      i."providerUrl",
      i.availability,
      i."franchiseKey",
      1 - (i.embedding <=> seed.embedding) AS "vecScore"
    FROM "Item" i
    CROSS JOIN seed
    WHERE ${where}
      AND i.embedding IS NOT NULL
    ORDER BY i.embedding <=> seed.embedding ASC
    LIMIT ${limit}
  `);
}

function buildWhere(filters: RecommendationFilters): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.type && filters.type !== "all") {
    const normalizedType = filters.type === "series" ? "tv" : filters.type;
    const sanitized = normalizedType.replace(/'/g, "''");
    clauses.push(Prisma.sql`i."type" = ${Prisma.raw(`'${sanitized}'::"ItemType"`)}`);
  }
  if (typeof filters.yearMin === "number") {
    clauses.push(Prisma.sql`(i."year" IS NULL OR i."year" >= ${filters.yearMin})`);
  }
  if (typeof filters.yearMax === "number") {
    clauses.push(Prisma.sql`(i."year" IS NULL OR i."year" <= ${filters.yearMax})`);
  }
  if (typeof filters.popMin === "number") {
    clauses.push(Prisma.sql`i.popularity >= ${filters.popMin}`);
  }
  let where = clauses[0];
  for (let index = 1; index < clauses.length; index += 1) {
    where = Prisma.sql`${where} AND ${clauses[index]}`;
  }
  return where;
}

