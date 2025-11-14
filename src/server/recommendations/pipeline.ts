import { ItemType, Prisma, Source } from "@prisma/client";

import { getEmbeddings } from "@/server/embeddings";
import { applyDiversity } from "@/server/recommendations/diversity";
import { generateReasons } from "@/server/recommendations/reasons";
import { RecommendationFilters, retrieveCandidates } from "@/server/recommendations/retrieve";
import { resolveSeed } from "@/server/recommendations/seed";
import { rerankCandidates } from "@/server/recommendations/rerank";
import { RecommendationPayload, AvailabilityLink, CandidateWithScores } from "@/lib/types";
import { prisma } from "@/server/db/client";
import { defaultLocale, fallbackLocaleChain, isLocale, resolveLocale, type Locale } from "@/i18n/config";

export interface RecommendationRequest {
  query: string;
  type?: string;
  yearMin?: number;
  yearMax?: number;
  popMin?: number;
  limit?: number;
  locale?: string;
}

export interface RecommendationResult {
  anchor: RecommendationPayload | null;
  items: RecommendationPayload[];
  debug?: {
    relaxations: number;
    totalCandidates: number;
  };
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const MIN_REQUIRED_DEFAULT = 5;
const RANDOM_FETCH_MULTIPLIER = 3;

export async function buildRecommendations(
  request: RecommendationRequest,
): Promise<RecommendationResult> {
  const locale = resolveLocale(request.locale);
  const desired = Math.min(Math.max(request.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const baseFilters: RecommendationFilters = {
    type: request.type,
    yearMin: request.yearMin,
    yearMax: request.yearMax,
    popMin: request.popMin,
  };

  const seed = await resolveSeed(request.query, baseFilters);
  
  let embedding = seed.embedding;
  if (!embedding?.length) {
    const fallbackEmbeddings = getEmbeddings();
    const [vector] = await fallbackEmbeddings.embed([request.query]);
    embedding = vector ?? [];
  }

  const relaxations = buildRelaxations(baseFilters);
  
  let finalItems: RecommendationPayload[] = [];
  let totalCandidates = 0;
  let appliedRelaxations = 0;

  for (let relaxationIndex = 0; relaxationIndex < relaxations.length; relaxationIndex += 1) {
    const filters = relaxations[relaxationIndex];
    
    const retrieval = await retrieveCandidates(request.query, embedding, filters, 120);
    totalCandidates = Math.max(totalCandidates, retrieval.candidates.length);
    
    if (!retrieval.candidates.length) {
      appliedRelaxations += 1;
      continue;
    }
    
    // Exclude seed item from recommendations
    let filteredCandidates = retrieval.candidates;
    if (seed.anchor?.id) {
      filteredCandidates = filteredCandidates.filter((candidate) => candidate.id !== seed.anchor!.id);
    }
    
    // Prioritize candidates with good vector similarity, even if fusedScore is low
    // This ensures items like "The Flash" for "Superman" queries appear
    const beforeScoreFilter = filteredCandidates.length;
    if (beforeScoreFilter > 0) {
      // Re-sort to prioritize items with good vectorScore
      filteredCandidates = filteredCandidates.sort((a, b) => {
        // First, prioritize items with both good fusedScore AND good vectorScore
        const aHasVector = (a.vectorScore ?? 0) > 0.3;
        const bHasVector = (b.vectorScore ?? 0) > 0.3;
        
        if (aHasVector && !bHasVector) return -1;
        if (!aHasVector && bHasVector) return 1;
        
        // If both have vector scores, prioritize higher vectorScore
        if (aHasVector && bHasVector) {
          return (b.vectorScore ?? 0) - (a.vectorScore ?? 0);
        }
        
        // Otherwise, use fusedScore
        return (b.fusedScore ?? 0) - (a.fusedScore ?? 0);
      });
      
      // Always keep at least top 50 candidates, prioritizing those with good vector similarity
      if (beforeScoreFilter > 50) {
        const poolTarget = Math.max(120, desired * 2);
        const highVectorCandidates = filteredCandidates.filter((c) => (c.vectorScore ?? 0) > 0.3);
        const otherCandidates = filteredCandidates.filter((c) => (c.vectorScore ?? 0) <= 0.3);
        filteredCandidates = [
          ...highVectorCandidates.slice(0, poolTarget),
          ...otherCandidates.slice(0, Math.max(0, poolTarget - highVectorCandidates.length)),
        ].slice(0, poolTarget);
      }
    }
    
    if (!filteredCandidates.length) {
      appliedRelaxations += 1;
      continue;
    }
    
    // Build enhanced rerank context with anchor information
    const rerankContext = {
      query: request.query,
      locale,
      anchor: seed.anchor ? {
        title: seed.anchor.title,
        synopsis: seed.anchor.synopsis,
        genres: seed.anchor.genres,
        creators: seed.anchor.creators,
      } : null,
    };
    
    const reranked = await rerankCandidates(request.query, filteredCandidates, {
      locale,
      anchor: rerankContext.anchor,
      topK: 100, // Increased from default 50 to 100 to include more candidates in reranking
    });
    
    // Sort reranked by combined relevance score (vectorScore is most important for semantic similarity)
    // This ensures the most relevant items are at the top
    const sortedReranked = reranked.sort((a, b) => {
      // Calculate combined relevance score
      const aVec = a.vectorScore ?? 0;
      const bVec = b.vectorScore ?? 0;
      const aRerank = a.rerankScore ?? 0;
      const bRerank = b.rerankScore ?? 0;
      const aFused = a.fusedScore ?? 0;
      const bFused = b.fusedScore ?? 0;
      
      // Calculate boosts for comparison
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
      
      // Calculate additional boosts
      const aGenreBoost = calculateGenreBoost(seed.anchor, a.item);
      const bGenreBoost = calculateGenreBoost(seed.anchor, b.item);
      const aFranchiseBoost = calculateFranchiseBoost(seed.anchor, a.item);
      const bFranchiseBoost = calculateFranchiseBoost(seed.anchor, b.item);
      
      // Combined score: vectorScore 28%, rerankScore 25%, fusedScore 10%, creatorBoost 18%, genreBoost 8%, franchiseBoost 5%, synopsisBoost 3%, yearBoost 1.5%, popularityBoost 1.5%, castBoost 0%
      // Added genreBoost (8%) and franchiseBoost (5%), adjusted other weights accordingly
      const aCombined = (aVec * 0.28) + (aRerank * 0.25) + (aFused * 0.1) + 
                       (aCreatorBoost * 0.18) + (aGenreBoost * 0.08) + (aFranchiseBoost * 0.05) +
                       (aSynopsisBoost * 0.03) + (aYearBoost * 0.015) + (aPopularityBoost * 0.015) + (aCastBoost * 0.0);
      const bCombined = (bVec * 0.28) + (bRerank * 0.25) + (bFused * 0.1) + 
                       (bCreatorBoost * 0.18) + (bGenreBoost * 0.08) + (bFranchiseBoost * 0.05) +
                       (bSynopsisBoost * 0.03) + (bYearBoost * 0.015) + (bPopularityBoost * 0.015) + (bCastBoost * 0.0);
      
      return bCombined - aCombined;
    });
    
    // Reserve top spots for high vectorScore items OR items with high creatorBoost
    // These items should appear even if MMR would filter them out
    // Exclude the seed item to avoid self-recommendation
    // Use sortedReranked (already sorted by combined relevance)
    // Lower threshold to 0.30 to catch more semantically similar items (including FROM with 56% similarity)
    const highRelevanceThreshold = 0.30;
    const seedId = seed.anchor?.id;
    // Always include at least 15 high-relevance items (or all available if less than 15)
    const highRelevanceCap = Math.max(15, Math.min(Math.ceil(desired * 0.5), sortedReranked.length));
    // First, prioritize items with high creatorBoost (shared creators are very important)
    // Reduced threshold from 0.2 to 0.19 to account for weighted creatorBoost calculation
    const itemsWithCreatorBoost = sortedReranked
      .filter((c) => {
        const creatorBoost = calculateCreatorBoost(seed.anchor, c.item);
        return creatorBoost >= 0.19 && (!seedId || c.id !== seedId);
      })
      .sort((a, b) => {
        const aCreatorBoost = calculateCreatorBoost(seed.anchor, a.item);
        const bCreatorBoost = calculateCreatorBoost(seed.anchor, b.item);
        return bCreatorBoost - aCreatorBoost; // Sort by creatorBoost first
      });
    
    // Then, add items with high vectorScore that don't already have creatorBoost
    const itemsWithHighVector = sortedReranked
      .filter((c) => {
        const hasHighVector = (c.vectorScore ?? 0) >= highRelevanceThreshold;
        const creatorBoost = calculateCreatorBoost(seed.anchor, c.item);
        const alreadyIncluded = itemsWithCreatorBoost.some((ic) => ic.id === c.id);
        return hasHighVector && creatorBoost < 0.19 && !alreadyIncluded && (!seedId || c.id !== seedId);
      });
    
    // Combine: creatorBoost items first, then high vectorScore items
    const highRelevanceItems = [...itemsWithCreatorBoost, ...itemsWithHighVector]
      .slice(0, highRelevanceCap);
    
    // Debug: Check if FROM is in highRelevanceItems
    const fromInHighRelevance = highRelevanceItems.find((c) => 
      c.item.title.toLowerCase().includes("from") && 
      c.item.type === "tv" &&
      c.item.year === 2022
    );
    if (fromInHighRelevance) {
      const fromCreatorBoost = calculateCreatorBoost(seed.anchor, fromInHighRelevance.item);
      console.log(`[Recommendations] ✅ FROM está en highRelevanceItems (creatorBoost: ${fromCreatorBoost.toFixed(4)}, vectorScore: ${fromInHighRelevance.vectorScore?.toFixed(4)})`);
    } else {
      console.log(`[Recommendations] ⚠️ FROM NO está en highRelevanceItems (cap: ${highRelevanceCap}, threshold: ${highRelevanceThreshold})`);
    }
    
    const remainingForDiversity = sortedReranked.filter(
      (c) => {
        // Exclude high-relevance items
        if (highRelevanceItems.some((hr) => hr.id === c.id)) return false;
        // Exclude seed item
        if (seedId && c.id === seedId) return false;
        return true;
      }
    );
    
    // Apply diversity to remaining items with very low lambda to prioritize relevance
    // Reduced diversity lambda from 0.3 to 0.2 to prioritize relevance over diversity
    const diversifiedRemaining = remainingForDiversity.length > 0
      ? applyDiversity(remainingForDiversity, Math.max(1, desired - highRelevanceItems.length), 0.2)
      : [];
    
    // Combine: high relevance items first, then diversified
    // Re-sort the combined list by combined relevance to ensure the first item is the most relevant
    const combined = [...highRelevanceItems, ...diversifiedRemaining];
    const sortedCombined = combined.sort((a, b) => {
      const aVec = a.vectorScore ?? 0;
      const bVec = b.vectorScore ?? 0;
      const aRerank = a.rerankScore ?? 0;
      const bRerank = b.rerankScore ?? 0;
      const aFused = a.fusedScore ?? 0;
      const bFused = b.fusedScore ?? 0;
      
      // Calculate boosts for comparison
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
      
      // Calculate additional boosts
      const aGenreBoost = calculateGenreBoost(seed.anchor, a.item);
      const bGenreBoost = calculateGenreBoost(seed.anchor, b.item);
      const aFranchiseBoost = calculateFranchiseBoost(seed.anchor, a.item);
      const bFranchiseBoost = calculateFranchiseBoost(seed.anchor, b.item);
      const aTagBoost = calculateTagBoost(seed.anchor, a.item);
      const bTagBoost = calculateTagBoost(seed.anchor, b.item);
      
      // Combined score: vectorScore 28%, rerankScore 25%, fusedScore 10%, creatorBoost 18%, tagBoost 6%, genreBoost 8%, franchiseBoost 5%, synopsisBoost 3%, yearBoost 1.5%, popularityBoost 1.5%, castBoost 0%
      // Added tagBoost (6%) - tags are more specific than genres, so they get good weight
      const aCombined = (aVec * 0.28) + (aRerank * 0.25) + (aFused * 0.1) + 
                       (aCreatorBoost * 0.18) + (aTagBoost * 0.06) + (aGenreBoost * 0.08) + (aFranchiseBoost * 0.05) +
                       (aSynopsisBoost * 0.03) + (aYearBoost * 0.015) + (aPopularityBoost * 0.015) + (aCastBoost * 0.0);
      const bCombined = (bVec * 0.28) + (bRerank * 0.25) + (bFused * 0.1) + 
                       (bCreatorBoost * 0.18) + (bTagBoost * 0.06) + (bGenreBoost * 0.08) + (bFranchiseBoost * 0.05) +
                       (bSynopsisBoost * 0.03) + (bYearBoost * 0.015) + (bPopularityBoost * 0.015) + (bCastBoost * 0.0);
      
      return bCombined - aCombined;
    });
    
    // Before applying final slice, ensure items with high creatorBoost are prioritized
    // Sort again to ensure creatorBoost items are at the top
    const finalSorted = sortedCombined.sort((a, b) => {
      const aCreatorBoost = calculateCreatorBoost(seed.anchor, a.item);
      const bCreatorBoost = calculateCreatorBoost(seed.anchor, b.item);
      
      // If one has significantly higher creatorBoost, prioritize it
      // Reduced threshold from 0.2 to 0.19 to match highRelevanceItems filter
      if (aCreatorBoost > 0.19 && bCreatorBoost <= 0.19) return -1;
      if (bCreatorBoost > 0.19 && aCreatorBoost <= 0.19) return 1;
      
      // Otherwise use the combined score
      const aVec = a.vectorScore ?? 0;
      const bVec = b.vectorScore ?? 0;
      const aRerank = a.rerankScore ?? 0;
      const bRerank = b.rerankScore ?? 0;
      const aFused = a.fusedScore ?? 0;
      const bFused = b.fusedScore ?? 0;
      const aSynopsisBoost = calculateSynopsisBoost(seed.anchor, a.item);
      const bSynopsisBoost = calculateSynopsisBoost(seed.anchor, b.item);
      const aYearBoost = calculateYearBoost(seed.anchor, a.item);
      const bYearBoost = calculateYearBoost(seed.anchor, b.item);
      const aPopularityBoost = calculatePopularityBoost(seed.anchor, a.item);
      const bPopularityBoost = calculatePopularityBoost(seed.anchor, b.item);
      const aCastBoost = calculateCastBoost(seed.anchor, a.item);
      const bCastBoost = calculateCastBoost(seed.anchor, b.item);
      const aGenreBoost = calculateGenreBoost(seed.anchor, a.item);
      const bGenreBoost = calculateGenreBoost(seed.anchor, b.item);
      const aFranchiseBoost = calculateFranchiseBoost(seed.anchor, a.item);
      const bFranchiseBoost = calculateFranchiseBoost(seed.anchor, b.item);
      const aTagBoost = calculateTagBoost(seed.anchor, a.item);
      const bTagBoost = calculateTagBoost(seed.anchor, b.item);
      const aRatingBoost = calculateRatingBoost(seed.anchor, a.item);
      const bRatingBoost = calculateRatingBoost(seed.anchor, b.item);
      
      // Dynamic weight adjustment: if no creators available, redistribute creatorBoost weight
      const hasCreators = seed.anchor?.creators && seed.anchor.creators.length > 0;
      const creatorWeight = hasCreators ? 0.18 : 0.0;
      const redistributedWeight = hasCreators ? 0.0 : 0.18;
      const genreWeight = 0.08 + (redistributedWeight * 0.5);
      const synopsisWeight = 0.03 + (redistributedWeight * 0.5);
      
      const aCombined = (aVec * 0.28) + (aRerank * 0.25) + (aFused * 0.1) + 
                       (aCreatorBoost * creatorWeight) + (aTagBoost * 0.06) + (aGenreBoost * genreWeight) + (aFranchiseBoost * 0.05) +
                       (aSynopsisBoost * synopsisWeight) + (aYearBoost * 0.015) + (aPopularityBoost * 0.015) + 
                       (aRatingBoost * 0.01) + (aCastBoost * 0.0);
      const bCombined = (bVec * 0.28) + (bRerank * 0.25) + (bFused * 0.1) + 
                       (bCreatorBoost * creatorWeight) + (bTagBoost * 0.06) + (bGenreBoost * genreWeight) + (bFranchiseBoost * 0.05) +
                       (bSynopsisBoost * synopsisWeight) + (bYearBoost * 0.015) + (bPopularityBoost * 0.015) + 
                       (bRatingBoost * 0.01) + (bCastBoost * 0.0);
      
      return bCombined - aCombined;
    });
    
    // Apply temporal diversity: avoid having too many items from the same year consecutively
    const diversified = applyTemporalDiversity(finalSorted, desired);
    
    const newItems = diversified.map((candidate) => {
      // Calculate boosts based on shared creators, synopsis similarity, year, popularity, and cast
      const creatorBoost = calculateCreatorBoost(seed.anchor, candidate.item);
      const synopsisBoost = calculateSynopsisBoost(seed.anchor, candidate.item);
      const yearBoost = calculateYearBoost(seed.anchor, candidate.item);
      const popularityBoost = calculatePopularityBoost(seed.anchor, candidate.item);
      const castBoost = calculateCastBoost(seed.anchor, candidate.item);
      
      // Calculate additional boosts
      const tagBoost = calculateTagBoost(seed.anchor, candidate.item);
      const genreBoost = calculateGenreBoost(seed.anchor, candidate.item);
      const franchiseBoost = calculateFranchiseBoost(seed.anchor, candidate.item);
      const ratingBoost = calculateRatingBoost(seed.anchor, candidate.item);
      
      // Dynamic weight adjustment: if no creators available, redistribute creatorBoost weight
      const hasCreators = seed.anchor?.creators && seed.anchor.creators.length > 0;
      const creatorWeight = hasCreators ? 0.18 : 0.0;
      const redistributedWeight = hasCreators ? 0.0 : 0.18; // Redistribute to genreBoost and synopsisBoost
      
      // Assign final score with all boosts and dynamic weights
      // Base weights: vectorScore 28%, rerankScore 25%, fusedScore 10%, creatorBoost 18% (or 0%), tagBoost 6%, genreBoost 8% (+9% if no creators), franchiseBoost 5%, synopsisBoost 3% (+9% if no creators), yearBoost 1.5%, popularityBoost 1.5%, ratingBoost 1%, castBoost 0%
      const vec = candidate.vectorScore ?? 0;
      const rerank = candidate.rerankScore ?? 0;
      const fused = candidate.fusedScore ?? 0;
      const genreWeight = 0.08 + (redistributedWeight * 0.5); // Get 50% of redistributed weight
      const synopsisWeight = 0.03 + (redistributedWeight * 0.5); // Get 50% of redistributed weight
      
      const finalScore = (vec * 0.28) + (rerank * 0.25) + (fused * 0.1) + 
                        (creatorBoost * creatorWeight) + (tagBoost * 0.06) + (genreBoost * genreWeight) + (franchiseBoost * 0.05) +
                        (synopsisBoost * synopsisWeight) + (yearBoost * 0.015) + (popularityBoost * 0.015) + 
                        (ratingBoost * 0.01) + (castBoost * 0.0);
      return {
        ...candidate.item,
        score: finalScore,
      };
    });
    
    // Add new items, avoiding duplicates
    const existingIds = new Set(finalItems.map((item) => item.id));
    const uniqueNewItems = newItems.filter((item) => !existingIds.has(item.id));
    finalItems = [...finalItems, ...uniqueNewItems].slice(0, desired);
    
    // Always ensure at least 5 recommendations if we have candidates
    const minRequired = Math.min(MIN_REQUIRED_DEFAULT, desired);
    if (finalItems.length >= desired) {
      break;
    }
    
    if (finalItems.length >= minRequired) {
      // Continue to try to get more if possible
      if (relaxationIndex === relaxations.length - 1) {
        break;
      }
    }
    appliedRelaxations += 1;
  }
  
  // Final fallback: if we still don't have enough, take top candidates by score regardless of diversity
  const minRequired = Math.min(MIN_REQUIRED_DEFAULT, desired);
  if (finalItems.length < minRequired) {
    console.warn(`[Recommendations] WARNING: Only ${finalItems.length} recommendations, falling back to top candidates by score`);
    // Use the most relaxed filters for fallback
    const fallbackFilters = relaxations[relaxations.length - 1] ?? {};
    const fallbackRetrieval = await retrieveCandidates(request.query, embedding, fallbackFilters, 100);
    let fallbackCandidates = fallbackRetrieval.candidates;
    if (seed.anchor?.id) {
      fallbackCandidates = fallbackCandidates.filter((candidate) => candidate.id !== seed.anchor!.id);
    }
    // Remove already selected items
    const existingIds = new Set(finalItems.map((item) => item.id));
    fallbackCandidates = fallbackCandidates.filter((candidate) => !existingIds.has(candidate.id));
    
    // Take top candidates by score to reach minimum
    const needed = minRequired - finalItems.length;
    const topByScore = fallbackCandidates
      .sort((a, b) => (b.fusedScore ?? 0) - (a.fusedScore ?? 0))
      .slice(0, needed)
      .map((candidate) => candidate.item);
    
    finalItems = [...finalItems, ...topByScore];
  }
  
  // Ensure we have at least 5, but respect desired if it's greater
  const targetCount = Math.max(minRequired, Math.min(desired, finalItems.length));
  finalItems = finalItems.slice(0, targetCount);
  
  if (finalItems.length === 0) {
    console.warn(`[Recommendations] WARNING: No recommendations generated after ${appliedRelaxations} relaxations`);
  } else if (finalItems.length < 5) {
    console.warn(`[Recommendations] WARNING: Only ${finalItems.length}/5 minimum recommendations generated`);
  }

  const localizationTargets = [...finalItems];
  if (seed.anchor) {
    localizationTargets.push(seed.anchor);
  }
  await hydrateLocalizations(localizationTargets, locale);

  const localizedAnchor = seed.anchor ? { ...seed.anchor } : null;
  const localizedItems = finalItems.map((item) => ({ ...item }));

  const fallbackQuery = request.query?.trim() || null;
  const reasons = generateReasons(localizedAnchor, localizedItems, locale, {
    fallbackQuery,
    mode: "search",
  });
  localizedItems.forEach((item) => {
    const reason = reasons.get(item.id);
    if (reason) {
      item.reason = reason;
    }
  });
  if (localizedAnchor) {
    const reason = reasons.get(localizedAnchor.id);
    if (reason) {
      localizedAnchor.reason = reason;
    }
  }

  return {
    anchor: localizedAnchor,
    items: localizedItems,
    debug: {
      relaxations: appliedRelaxations,
      totalCandidates,
    },
  };
}

type RandomRecommendationRequest = {
  limit?: number;
  locale?: string;
  type?: RecommendationRequest["type"];
  yearMin?: number;
  yearMax?: number;
  popMin?: number;
};

export async function buildRandomRecommendations(
  request: RandomRecommendationRequest,
): Promise<RecommendationResult> {
  const locale = resolveLocale(request.locale);
  const desired = Math.min(Math.max(request.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const fetchCount = Math.min(desired * RANDOM_FETCH_MULTIPLIER, MAX_LIMIT * 2);

  const whereClauses: Prisma.Sql[] = [];
  if (request.type && request.type !== "any") {
    const normalizedType = request.type === "series" ? "tv" : request.type;
    whereClauses.push(
      Prisma.sql`i."type" = ${Prisma.raw(`'${normalizedType.replace(/'/g, "''")}'::"ItemType"`)}`,
    );
  }
  if (typeof request.yearMin === "number") {
    whereClauses.push(Prisma.sql`i."year" IS NOT NULL AND i."year" >= ${request.yearMin}`);
  }
  if (typeof request.yearMax === "number") {
    whereClauses.push(Prisma.sql`i."year" IS NOT NULL AND i."year" <= ${request.yearMax}`);
  }
  if (typeof request.popMin === "number") {
    whereClauses.push(Prisma.sql`i."popularity" >= ${request.popMin}`);
  }

  const whereSql = whereClauses.length
    ? Prisma.sql`WHERE ${Prisma.join(whereClauses, " AND ")}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    type: ItemType;
    year: number | null;
    genres: string[] | null;
    tags: string[] | null;
    synopsis: string | null;
    creators: string[] | null;
    cast: string[] | null;
    posterUrl: string | null;
    popularity: number;
    providerUrl: string | null;
    availability: Prisma.JsonValue;
    franchiseKey: string | null;
    source: string;
  }>>(Prisma.sql`
    SELECT
      i.id,
      i.title,
      i.type,
      i.year,
      i.genres,
      i.tags,
      i.synopsis,
      i.creators,
      i.cast,
      i."posterUrl",
      i.popularity,
      i."providerUrl",
      i.availability,
      i."franchiseKey",
      i.source
    FROM "Item" i
    ${whereSql}
    ORDER BY RANDOM()
    LIMIT ${fetchCount}
  `);

  if (!rows.length) {
    return { anchor: null, items: [], debug: { relaxations: 0, totalCandidates: 0 } };
  }

  const mapped = rows.map((row) => mapItemRowToPayload(row));
  const uniqueById = new Map<string, RecommendationPayload>();
  for (const item of mapped) {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  }
  const items = Array.from(uniqueById.values()).slice(0, desired);

  await hydrateLocalizations(items, locale);
  const reasons = generateReasons(null, items, locale, { mode: "random" });
  items.forEach((item) => {
    const reason = reasons.get(item.id);
    if (reason) {
      item.reason = reason;
    }
  });

  return {
    anchor: null,
    items,
    debug: {
      relaxations: 0,
      totalCandidates: rows.length,
    },
  };
}

function buildRelaxations(base: RecommendationFilters): RecommendationFilters[] {
  const steps: RecommendationFilters[] = [base];
  if (typeof base.popMin === "number" && base.popMin > 0) {
    steps.push({ ...base, popMin: Math.max(0, base.popMin * 0.6) });
    steps.push({ ...base, popMin: undefined });
  }
  if (typeof base.yearMin === "number" || typeof base.yearMax === "number") {
    steps.push({
      ...base,
      yearMin: typeof base.yearMin === "number" ? base.yearMin - 10 : undefined,
      yearMax: typeof base.yearMax === "number" ? base.yearMax + 10 : undefined,
    });
    steps.push({ ...base, yearMin: undefined, yearMax: undefined });
  }
  // Ensure unique filters by stringifying.
  const unique = new Map<string, RecommendationFilters>();
  for (const filter of steps) {
    const key = JSON.stringify(filter);
    if (!unique.has(key)) {
      unique.set(key, filter);
    }
  }
  return Array.from(unique.values());
}

type LocalizationRow = {
  itemId: string;
  locale: string;
  title: string;
  synopsis: string | null;
  availability: Prisma.JsonValue;
  reason: string | null;
};

async function hydrateLocalizations(items: RecommendationPayload[], locale: Locale): Promise<void> {
  const uniqueIds = Array.from(new Set(items.map((item) => item.id).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return;
  }
  const fallbackOrder = fallbackLocaleChain[locale] ?? [locale, defaultLocale];
  const rows = await prisma.itemLocalization.findMany({
    where: {
      itemId: { in: uniqueIds },
      locale: { in: fallbackOrder },
    },
  });

  const grouped = new Map<string, Map<string, LocalizationRow>>();
  for (const row of rows) {
    if (!grouped.has(row.itemId)) {
      grouped.set(row.itemId, new Map());
    }
    grouped.get(row.itemId)!.set(row.locale, row as LocalizationRow);
  }

  const fallbackLookup = new Map<string, LocalizationRow>();
  for (const itemId of uniqueIds) {
    const byLocale = grouped.get(itemId);
    if (!byLocale) continue;
    for (const candidateLocale of fallbackOrder) {
      const record = byLocale.get(candidateLocale);
      if (record) {
        fallbackLookup.set(itemId, record);
        break;
      }
    }
  }

  items.forEach((item) => {
    const localization = fallbackLookup.get(item.id);
    if (!localization) {
      item.locale = defaultLocale;
      return;
    }
    item.locale = isLocale(localization.locale) ? localization.locale : defaultLocale;
    // Only update title if localization has a valid title (not empty or undefined)
    if (localization.title && localization.title.trim()) {
      item.title = localization.title;
    }
    // Preserve original title if localization title is missing/invalid
    if (localization.synopsis) {
      item.synopsis = localization.synopsis;
    }
    const localizedAvailability = parseAvailability(localization.availability);
    if (localizedAvailability.length) {
      item.availability = localizedAvailability;
    }
    if (localization.reason) {
      item.reason = localization.reason;
    }
  });
}

function isAvailabilityLink(value: unknown): value is AvailabilityLink {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AvailabilityLink>;
  return Boolean(candidate.label && candidate.type && candidate.url);
}

function parseAvailability(value: Prisma.JsonValue): AvailabilityLink[] {
  if (!value) {
    return [];
  }
  let raw: unknown;
  if (Array.isArray(value)) {
    raw = value;
  } else if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      raw = [];
    }
  } else {
    raw = value;
  }

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(isAvailabilityLink).map((entry) => ({
    label: entry.label,
    type: entry.type,
    url: entry.url,
    affiliate: entry.affiliate ?? undefined,
  }));
}

function mapItemRowToPayload(row: {
  id: string;
  title: string;
  type: ItemType;
  year: number | null;
  genres: string[] | null;
  tags: string[] | null;
  synopsis: string | null;
  creators: string[] | null;
  posterUrl: string | null;
  popularity: number;
  providerUrl: string | null;
  availability: Prisma.JsonValue;
  franchiseKey: string | null;
  source: string;
}): RecommendationPayload {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    year: row.year,
    genres: row.genres ?? [],
    tags: row.tags ?? undefined,
    synopsis: row.synopsis,
    creators: row.creators ?? undefined,
    posterUrl: row.posterUrl,
    popularity: row.popularity ?? 0,
    providerUrl: row.providerUrl,
    availability: parseAvailability(row.availability),
    reason: undefined,
    source: row.source as Source,
    franchiseKey: row.franchiseKey,
    score: row.popularity ?? 0,
  };
}

/**
 * Calculate boost score based on shared creators/directors
 * Improved: considers position - first creators are more important (showrunners, main directors)
 * Returns 0-1 score: 1.0 if all creators match, weighted by position
 */
function calculateCreatorBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.creators || !candidate.creators || anchor.creators.length === 0 || candidate.creators.length === 0) {
    return 0;
  }
  
  const anchorCreators = anchor.creators.map((c) => c.toLowerCase().trim());
  const candidateCreators = candidate.creators.map((c) => c.toLowerCase().trim());
  const candidateSet = new Set(candidateCreators);
  
  let weightedScore = 0;
  let totalWeight = 0;
  
  // Weight creators by position: first = 1.0, second = 0.7, third+ = 0.5
  for (let i = 0; i < anchorCreators.length; i++) {
    const creator = anchorCreators[i];
    let weight = 1.0;
    if (i === 1) weight = 0.7; // Second creator
    else if (i >= 2) weight = 0.5; // Third and beyond
    
    if (candidateSet.has(creator)) {
      weightedScore += weight;
    }
    totalWeight += weight;
  }
  
  if (weightedScore === 0) {
    return 0;
  }
  
  // Normalize by total possible weight
  return Math.min(1.0, weightedScore / totalWeight);
}

/**
 * Calculate boost score based on synopsis similarity
 * Improved Jaccard similarity with better word normalization and stop word filtering
 * Returns 0-1 score: 1.0 for very similar synopses, 0.0 for dissimilar
 */
function calculateSynopsisBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.synopsis || !candidate.synopsis) {
    return 0;
  }
  
  // Common stop words to filter out
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
    "from", "as", "is", "was", "are", "were", "been", "be", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those",
    "it", "its", "they", "them", "their", "there", "then", "than", "when", "where", "what", "which", "who", "whom"
  ]);
  
  // Improved word extraction: normalize, filter stop words, and use longer words (4+ chars)
  const extractWords = (text: string): Set<string> => {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !stopWords.has(w))
        .map((w) => w.trim())
        .filter((w) => w.length > 0)
    );
  };
  
  const anchorWords = extractWords(anchor.synopsis);
  const candidateWords = extractWords(candidate.synopsis);
  
  if (anchorWords.size === 0 || candidateWords.size === 0) {
    return 0;
  }
  
  let intersection = 0;
  for (const word of anchorWords) {
    if (candidateWords.has(word)) {
      intersection++;
    }
  }
  
  const union = anchorWords.size + candidateWords.size - intersection;
  if (union === 0) {
    return 0;
  }
  
  const jaccard = intersection / union;
  
  // Lower threshold (0.15) to catch more similar synopses
  // Scale from 0.15-0.6 to 0-1.0 for boost score
  if (jaccard < 0.15) {
    return 0;
  }
  if (jaccard >= 0.6) {
    return 1.0;
  }
  
  // Linear scaling between 0.15 and 0.6
  return (jaccard - 0.15) / 0.45;
}

/**
 * Calculate boost score based on shared cast members
 * Returns 0-1 score: 1.0 if 2+ cast members match, 0.5 if 1 matches, 0.0 if none
 */
function calculateCastBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.cast || !candidate.cast || anchor.cast.length === 0 || candidate.cast.length === 0) {
    return 0;
  }
  
  const anchorSet = new Set(anchor.cast.map((c) => c.toLowerCase().trim()));
  const candidateSet = new Set(candidate.cast.map((c) => c.toLowerCase().trim()));
  
  let sharedCount = 0;
  for (const actor of anchorSet) {
    if (candidateSet.has(actor)) {
      sharedCount++;
    }
  }
  
  if (sharedCount === 0) {
    return 0;
  }
  
  // Boost more if multiple cast members match
  if (sharedCount >= 2) {
    return 1.0;
  }
  if (sharedCount === 1) {
    return 0.5;
  }
  
  return 0;
}

/**
 * Calculate boost score based on shared tags/keywords
 * Tags are more specific than genres (e.g., "time travel", "post-apocalyptic", "found family")
 * Returns 0-1 score: 1.0 if 5+ tags match, 0.8 if 3-4 match, 0.5 if 2 match, 0.3 if 1 matches, 0.0 if none
 */
function calculateTagBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.tags || !candidate.tags || anchor.tags.length === 0 || candidate.tags.length === 0) {
    return 0;
  }
  
  const anchorSet = new Set(anchor.tags.map((t) => t.toLowerCase().trim()));
  const candidateSet = new Set(candidate.tags.map((t) => t.toLowerCase().trim()));
  
  let sharedCount = 0;
  for (const tag of anchorSet) {
    if (candidateSet.has(tag)) {
      sharedCount++;
    }
  }
  
  if (sharedCount === 0) {
    return 0;
  }
  
  // Tags are more specific than genres, so fewer shared tags still provide good boost
  // Boost more if multiple tags match (indicates strong thematic similarity)
  if (sharedCount >= 5) {
    return 1.0;
  }
  if (sharedCount >= 3) {
    return 0.8;
  }
  if (sharedCount === 2) {
    return 0.5;
  }
  if (sharedCount === 1) {
    return 0.3;
  }
  
  return 0;
}

/**
 * Calculate boost score based on shared genres
 * Returns 0-1 score: 1.0 if 3+ genres match, 0.7 if 2 match, 0.4 if 1 matches, 0.0 if none
 */
function calculateGenreBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.genres || !candidate.genres || anchor.genres.length === 0 || candidate.genres.length === 0) {
    return 0;
  }
  
  const anchorSet = new Set(anchor.genres.map((g) => g.toLowerCase().trim()));
  const candidateSet = new Set(candidate.genres.map((g) => g.toLowerCase().trim()));
  
  let sharedCount = 0;
  for (const genre of anchorSet) {
    if (candidateSet.has(genre)) {
      sharedCount++;
    }
  }
  
  if (sharedCount === 0) {
    return 0;
  }
  
  // Boost more if multiple genres match
  if (sharedCount >= 3) {
    return 1.0;
  }
  if (sharedCount === 2) {
    return 0.7;
  }
  if (sharedCount === 1) {
    return 0.4;
  }
  
  return 0;
}

/**
 * Calculate boost score based on same franchise
 * Returns 1.0 if same franchise, 0.0 otherwise
 */
function calculateFranchiseBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.franchiseKey || !candidate.franchiseKey) {
    return 0;
  }
  
  // Same franchise should have strong boost
  if (anchor.franchiseKey.toLowerCase().trim() === candidate.franchiseKey.toLowerCase().trim()) {
    return 1.0;
  }
  
  return 0;
}

/**
 * Calculate boost score based on similar rating (vote_average)
 * Returns 0-1 score: 1.0 if ratings are very similar, decreasing with difference
 * Uses popularity as a proxy (which is normalized from vote_average for TMDb)
 */
function calculateRatingBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.popularity || !candidate.popularity) {
    return 0;
  }
  
  // Use normalized popularity as a proxy for rating similarity
  // Popularity is already normalized 0-100, so we can compare directly
  const ratingDiff = Math.abs(anchor.popularity - candidate.popularity);
  
  // Boost if ratings are very similar (within 10 points)
  if (ratingDiff <= 10) {
    return 1.0;
  }
  // Boost if ratings are somewhat similar (within 20 points)
  if (ratingDiff <= 20) {
    return 0.6;
  }
  // Small boost if ratings are moderately similar (within 30 points)
  if (ratingDiff <= 30) {
    return 0.3;
  }
  
  return 0;
}

/**
 * Apply temporal diversity to avoid having too many items from the same year consecutively
 * Also applies genre diversity to avoid too many items of the same genre consecutively
 * Returns a diversified list maintaining relevance while ensuring year and genre diversity
 */
function applyTemporalDiversity(
  candidates: Array<CandidateWithScores>,
  desired: number,
): Array<CandidateWithScores> {
  if (candidates.length <= desired) {
    return candidates;
  }
  
  const result: Array<CandidateWithScores> = [];
  const usedYears = new Map<number | null, number>(); // Track consecutive occurrences per year
  const usedGenres = new Map<string, number>(); // Track consecutive occurrences per genre
  const maxConsecutiveSameYear = 2; // Maximum 2 items from same year consecutively
  const maxConsecutiveSameGenre = 2; // Maximum 2 items from same genre consecutively
  
  for (const candidate of candidates) {
    if (result.length >= desired) {
      break;
    }
    
    const year = candidate.item.year;
    const primaryGenre = candidate.item.genres?.[0]?.toLowerCase().trim() ?? "unknown";
    const yearConsecutiveCount = usedYears.get(year) ?? 0;
    const genreConsecutiveCount = usedGenres.get(primaryGenre) ?? 0;
    
    // Check if we need to skip due to year or genre diversity
    const skipYear = yearConsecutiveCount >= maxConsecutiveSameYear;
    const skipGenre = genreConsecutiveCount >= maxConsecutiveSameGenre;
    
    if (skipYear || skipGenre) {
      // Find next item with different year or genre
      const nextDifferent = candidates.find(
        (c) => {
          const cYear = c.item.year;
          const cGenre = c.item.genres?.[0]?.toLowerCase().trim() ?? "unknown";
          const alreadyAdded = result.some((r) => r.id === c.id);
          
          if (skipYear && skipGenre) {
            return cYear !== year && cGenre !== primaryGenre && !alreadyAdded;
          } else if (skipYear) {
            return cYear !== year && !alreadyAdded;
          } else {
            return cGenre !== primaryGenre && !alreadyAdded;
          }
        }
      );
      
      if (nextDifferent) {
        result.push(nextDifferent);
        // Reset consecutive counts
        usedYears.clear();
        usedGenres.clear();
        usedYears.set(nextDifferent.item.year, 1);
        const nextGenre = nextDifferent.item.genres?.[0]?.toLowerCase().trim() ?? "unknown";
        usedGenres.set(nextGenre, 1);
        continue;
      }
    }
    
    // Add current candidate
    result.push(candidate);
    usedYears.set(year, yearConsecutiveCount + 1);
    usedGenres.set(primaryGenre, genreConsecutiveCount + 1);
    
    // Reset consecutive counts if year or genre changed
    if (result.length > 1) {
      const prevYear = result[result.length - 2].item.year;
      const prevGenre = result[result.length - 2].item.genres?.[0]?.toLowerCase().trim() ?? "unknown";
      
      if (prevYear !== year) {
        usedYears.clear();
        usedYears.set(year, 1);
      }
      if (prevGenre !== primaryGenre) {
        usedGenres.clear();
        usedGenres.set(primaryGenre, 1);
      }
    }
  }
  
  return result;
}

/**
 * Calculate boost score based on year similarity
 * Improved: also considers decade similarity for broader matches
 * Returns 0-1 score: 1.0 if same year, decreasing with year difference, bonus for same decade
 */
function calculateYearBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.year || !candidate.year) {
    return 0;
  }
  
  const yearDiff = Math.abs(anchor.year - candidate.year);
  
  // Same year gets maximum boost
  if (yearDiff === 0) {
    return 1.0;
  }
  
  // Boost if difference <= 5 years
  if (yearDiff <= 5) {
    return 1.0;
  }
  
  // Boost if difference <= 10 years
  if (yearDiff <= 10) {
    return 0.5;
  }
  
  // Check if same decade (e.g., both in 2000s, 2010s, etc.)
  const anchorDecade = Math.floor(anchor.year / 10) * 10;
  const candidateDecade = Math.floor(candidate.year / 10) * 10;
  const sameDecade = anchorDecade === candidateDecade;
  
  // Small boost if same decade but > 10 years apart
  if (sameDecade && yearDiff <= 15) {
    return 0.3;
  }
  
  // Small boost if difference <= 15 years
  if (yearDiff <= 15) {
    return 0.2;
  }
  
  // No boost if difference > 15 years
  return 0;
}

/**
 * Calculate boost score based on popularity similarity
 * Returns 0-1 score: 1.0 if very similar popularity, decreasing with difference
 */
function calculatePopularityBoost(anchor: RecommendationPayload | null, candidate: RecommendationPayload): number {
  if (!anchor?.popularity || !candidate.popularity) {
    return 0;
  }
  
  const popDiff = Math.abs(anchor.popularity - candidate.popularity);
  
  // Boost if difference <= 20 points
  if (popDiff <= 20) {
    return 1.0;
  }
  
  // Boost if difference <= 40 points
  if (popDiff <= 40) {
    return 0.5;
  }
  
  // Small boost if difference <= 60 points
  if (popDiff <= 60) {
    return 0.2;
  }
  
  // No boost if difference > 60 points
  return 0;
}

