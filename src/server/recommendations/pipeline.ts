import { ItemType, Prisma, Source } from "@prisma/client";

import { getEmbeddings } from "@/server/embeddings";
import { applyDiversity } from "@/server/recommendations/diversity";
import { generateReasons } from "@/server/recommendations/reasons";
import { RecommendationFilters, retrieveCandidates } from "@/server/recommendations/retrieve";
import { resolveSeed } from "@/server/recommendations/seed";
import { rerankCandidates } from "@/server/recommendations/rerank";
import { RecommendationPayload, AvailabilityLink } from "@/lib/types";
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
    
    const reranked = await rerankCandidates(request.query, filteredCandidates, {
      locale,
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
      
      // Combined score: prioritize vectorScore heavily (70%), then rerankScore (20%), then fusedScore (10%)
      const aCombined = (aVec * 0.7) + (aRerank * 0.2) + (aFused * 0.1);
      const bCombined = (bVec * 0.7) + (bRerank * 0.2) + (bFused * 0.1);
      
      return bCombined - aCombined;
    });
    
    // Reserve top spots for high vectorScore items (very relevant semantically)
    // These items should appear even if MMR would filter them out
    // Exclude the seed item to avoid self-recommendation
    // Use sortedReranked (already sorted by combined relevance)
    // Lower threshold to 0.35 to catch more semantically similar items
    const highRelevanceThreshold = 0.35;
    const seedId = seed.anchor?.id;
    const highRelevanceCap = Math.min(Math.max(7, Math.ceil(desired * 0.2)), desired);
    const highRelevanceItems = sortedReranked
      .filter((c) => {
        // Must have high vectorScore (lowered threshold to catch more relevant items)
        if ((c.vectorScore ?? 0) < highRelevanceThreshold) return false;
        // Must not be the seed item
        if (seedId && c.id === seedId) return false;
        return true;
      })
      .slice(0, highRelevanceCap);
    
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
    const diversifiedRemaining = remainingForDiversity.length > 0
      ? applyDiversity(remainingForDiversity, Math.max(1, desired - highRelevanceItems.length), 0.3)
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
      
      // Combined score: prioritize vectorScore heavily (70%), then rerankScore (20%), then fusedScore (10%)
      const aCombined = (aVec * 0.7) + (aRerank * 0.2) + (aFused * 0.1);
      const bCombined = (bVec * 0.7) + (bRerank * 0.2) + (bFused * 0.1);
      
      return bCombined - aCombined;
    });
    
    const diversified = sortedCombined.slice(0, desired);
    
    const newItems = diversified.map((candidate) => {
      // Assign final score based on combined relevance
      const vec = candidate.vectorScore ?? 0;
      const rerank = candidate.rerankScore ?? 0;
      const fused = candidate.fusedScore ?? 0;
      const finalScore = (vec * 0.7) + (rerank * 0.2) + (fused * 0.1);
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
    synopsis: string | null;
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
      i.synopsis,
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
  synopsis: string | null;
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
    synopsis: row.synopsis,
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

