import { env } from "@/env";
import { CandidateWithScores } from "@/lib/types";

export interface RerankOptions {
  locale?: string;
  topK?: number;
  anchor?: {
    title: string;
    synopsis?: string | null;
    genres: string[];
    creators?: string[];
  } | null;
}

interface RerankContext {
  query: string;
  locale: string;
  topK: number;
  anchor?: {
    title: string;
    synopsis?: string | null;
    genres: string[];
    creators?: string[];
  } | null;
}

interface InternalReranker {
  name: string;
  rerank(context: RerankContext, candidates: CandidateWithScores[]): Promise<Map<string, number> | null>;
}

export async function rerankCandidates(
  query: string,
  candidates: CandidateWithScores[],
  options: RerankOptions = {},
): Promise<CandidateWithScores[]> {
  if (!candidates.length) {
    return candidates;
  }

  const baseline = heuristicRerank(candidates);
  if (!env.RERANK_ENABLED) {
    return baseline;
  }

  const locale = options.locale ?? "en";
  const topK = Math.min(options.topK ?? 100, candidates.length); // Increased from 50 to 100
  const topCandidates = candidates.slice(0, topK);
  const context: RerankContext = { 
    query, 
    locale, 
    topK,
    anchor: options.anchor ?? null,
  };

  const rerankers = getRerankers();
  if (!rerankers.length) {
    return baseline;
  }

  for (const reranker of rerankers) {
    try {
      const scores = await reranker.rerank(context, topCandidates);
      if (scores && scores.size > 0) {
        return applyScores(baseline, scores);
      }
    } catch (error) {
      console.error(`${reranker.name} rerank failed`, error);
    }
  }

  return baseline;
}

class CohereReranker implements InternalReranker {
  public readonly name = "cohere";

  constructor(private readonly apiKey: string) {}

  async rerank(context: RerankContext, candidates: CandidateWithScores[]): Promise<Map<string, number> | null> {
    const enhancedQuery = buildEnhancedQuery(context.query, context.anchor);
    const response = await fetch("https://api.cohere.com/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: enhancedQuery,
        top_n: context.topK,
        documents: candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.item.title,
          text: buildDocumentText(candidate, context.anchor),
          metadata: {
            type: candidate.item.type,
            year: candidate.item.year,
            popularity: candidate.item.popularity,
          },
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Cohere rerank failed: ${response.status}`);
    }
    const payload = (await response.json()) as CohereRerankResponse;
    if (!payload.results?.length) {
      return null;
    }
    const scores = new Map<string, number>();
    payload.results.forEach((result, index) => {
      const candidate = candidates[result.index];
      if (candidate) {
        const score = typeof result.relevance_score === "number"
          ? result.relevance_score
          : payload.results.length - index;
        scores.set(candidate.id, score);
      }
    });
    return scores;
  }
}

class LightweightHttpReranker implements InternalReranker {
  public readonly name = "lightweight";

  constructor(private readonly url: string, private readonly apiKey?: string) {}

  async rerank(context: RerankContext, candidates: CandidateWithScores[]): Promise<Map<string, number> | null> {
    const enhancedQuery = buildEnhancedQuery(context.query, context.anchor);
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        query: enhancedQuery,
        locale: context.locale,
        schema: {
          type: "object",
          required: ["results"],
          properties: {
            results: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["id", "score"],
                properties: {
                  id: { type: "string" },
                  score: { type: "number" },
                },
              },
            },
          },
        },
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          title: candidate.item.title,
          synopsis: candidate.item.synopsis,
          genres: candidate.item.genres,
          popularity: candidate.item.popularity,
          type: candidate.item.type,
          year: candidate.item.year,
        })),
      }),
    });
    if (!response.ok) {
      throw new Error(`Lightweight rerank failed: ${response.status}`);
    }
    const payload = (await response.json()) as LightweightRerankResponse;
    if (!payload.results?.length) {
      return null;
    }
    const scores = new Map<string, number>();
    payload.results.forEach((result) => {
      if (typeof result.score === "number") {
        scores.set(result.id, result.score);
      }
    });
    return scores.size ? scores : null;
  }
}

function heuristicRerank(candidates: CandidateWithScores[]): CandidateWithScores[] {
  return candidates
    .map((candidate) => {
      const popularityBoost = candidate.item.popularity / 100;
      const now = new Date().getFullYear();
      const yearPenalty = candidate.item.year ? Math.abs(candidate.item.year - now) / 1000 : 0;
      const rerankScore = candidate.fusedScore + popularityBoost - yearPenalty;
      return { ...candidate, rerankScore } satisfies CandidateWithScores;
    })
    .sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore));
}

function applyScores(
  baseline: CandidateWithScores[],
  scores: Map<string, number>,
): CandidateWithScores[] {
  const enriched = baseline.map((candidate) => {
    const rerankScore = scores.get(candidate.id);
    if (typeof rerankScore === "number") {
      return { ...candidate, rerankScore } satisfies CandidateWithScores;
    }
    return candidate;
  });
  return enriched.sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore));
}

function buildDocumentText(candidate: CandidateWithScores, anchor?: RerankContext["anchor"]): string {
  const segments = [candidate.item.title];
  if (candidate.item.genres.length) {
    segments.push(candidate.item.genres.join(", "));
  }
  if (candidate.item.synopsis) {
    segments.push(candidate.item.synopsis);
  }
  if (candidate.item.creators && candidate.item.creators.length > 0) {
    segments.push(`Creators: ${candidate.item.creators.join(", ")}`);
  }
  return segments.join("\n");
}

function buildEnhancedQuery(query: string, anchor?: RerankContext["anchor"]): string {
  if (!anchor) {
    return query;
  }
  
  // Build enhanced query with anchor context
  const parts: string[] = [];
  parts.push(`Similar to "${anchor.title}"`);
  
  if (anchor.synopsis) {
    // Use first 100 chars of synopsis for context
    const synopsisPreview = anchor.synopsis.substring(0, 100).replace(/\n/g, " ");
    parts.push(`(${synopsisPreview}...)`);
  }
  
  if (anchor.genres.length > 0) {
    parts.push(`Genres: ${anchor.genres.slice(0, 3).join(", ")}`);
  }
  
  if (anchor.creators && anchor.creators.length > 0) {
    parts.push(`By: ${anchor.creators.slice(0, 2).join(", ")}`);
  }
  
  parts.push("Find shows/movies with similar themes, creators, style, or narrative structure.");
  
  return parts.join(". ");
}

let cachedRerankers: InternalReranker[] | null = null;

function getRerankers(): InternalReranker[] {
  if (cachedRerankers) {
    return cachedRerankers;
  }
  const chain: InternalReranker[] = [];
  if (env.RERANK_ENABLED) {
    if (env.COHERE_API_KEY) {
      chain.push(new CohereReranker(env.COHERE_API_KEY));
    }
    if (env.LLM_RERANK_URL) {
      chain.push(new LightweightHttpReranker(env.LLM_RERANK_URL, env.LLM_RERANK_API_KEY));
    }
  }
  cachedRerankers = chain;
  return chain;
}

interface CohereRerankResponse {
  results: Array<{
    index: number;
    relevance_score?: number;
  }>;
}

interface LightweightRerankResponse {
  results?: Array<{
    id: string;
    score: number;
  }>;
}

