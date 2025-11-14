import { CandidateWithScores } from "@/lib/types";
import {
  clamp,
  cosineSimilarity,
  hashedVector,
  jaccardSimilarity,
  normalizeForComparison,
  tokenize,
} from "@/lib/text";

interface MmrOptions {
  lambda?: number;
  k?: number;
}

const TITLE_VECTOR_DIM = 128;

export function mmrSelect(
  candidates: CandidateWithScores[],
  options: MmrOptions = {},
): CandidateWithScores[] {
  const lambda = options.lambda ?? 0.7;
  const target = options.k ?? 10;
  if (candidates.length <= target) {
    return [...candidates];
  }

  const prepared = candidates.map((candidate) => {
    const genres = candidate.item.genres.map((genre) => normalizeForComparison(genre));
    const titleTokens = tokenize(candidate.item.title);
    const titleVector = hashedVector(titleTokens, TITLE_VECTOR_DIM);
    return { candidate, genres, titleTokens, titleVector };
  });

  const selected: CandidateWithScores[] = [];
  const selectedPrepared: typeof prepared = [];
  const remaining = new Set(prepared.map((entry) => entry.candidate.id));

  // Seed with highest relevance score, prioritizing vectorScore if available
  prepared
    .slice()
    .sort((a, b) => {
      // Prioritize items with high vectorScore (semantic similarity)
      const aVector = a.candidate.vectorScore ?? 0;
      const bVector = b.candidate.vectorScore ?? 0;
      if (aVector > 0.4 && bVector <= 0.4) return -1;
      if (bVector > 0.4 && aVector <= 0.4) return 1;
      // If both have vector scores, prioritize higher
      if (aVector > 0 && bVector > 0) {
        return bVector - aVector;
      }
      // Otherwise use rerankScore or fusedScore
      return (
        (b.candidate.rerankScore ?? b.candidate.fusedScore) -
        (a.candidate.rerankScore ?? a.candidate.fusedScore)
      );
    })
    .slice(0, 1)
    .forEach((entry) => {
      selected.push(entry.candidate);
      selectedPrepared.push(entry);
      remaining.delete(entry.candidate.id);
    });

  while (selected.length < target && remaining.size > 0) {
    let bestEntry: (typeof prepared)[number] | null = null;
    let bestScore = -Infinity;
    for (const entry of prepared) {
      if (!remaining.has(entry.candidate.id)) {
        continue;
      }
      // Use vectorScore if available for relevance (better semantic match)
      // Fallback to rerankScore or fusedScore
      let relevance = entry.candidate.rerankScore ?? entry.candidate.fusedScore;
      const vecScore = entry.candidate.vectorScore ?? 0;
      // If vectorScore is very high (>0.4), boost relevance significantly
      if (vecScore > 0.4) {
        relevance = relevance + vecScore * 0.5; // Boost by 50% of vectorScore
      }
      
      let maxSimilarity = 0;
      for (const chosen of selectedPrepared) {
        const genreSim = jaccardSimilarity(entry.genres, chosen.genres);
        const titleSim = cosineSimilarity(entry.titleVector, chosen.titleVector);
        const yearSim = yearSimilarity(entry.candidate.item.year, chosen.candidate.item.year);
        // Reduced title similarity weight: genres 60%, title 15% (reduced from 30%), year 25%
        const similarity = clamp(0.6 * genreSim + 0.15 * titleSim + 0.25 * yearSim);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
        }
      }
      const score = lambda * relevance - (1 - lambda) * maxSimilarity;
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    if (!bestEntry) {
      break;
    }
    selected.push(bestEntry.candidate);
    selectedPrepared.push(bestEntry);
    remaining.delete(bestEntry.candidate.id);
  }

  return selected;
}

function yearSimilarity(yearA: number | null, yearB: number | null | undefined): number {
  if (!yearA || !yearB) {
    return 0;
  }
  const delta = Math.abs(yearA - yearB);
  if (delta >= 30) {
    return 0;
  }
  return clamp(1 - delta / 30);
}

