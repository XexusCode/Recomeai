import { CandidateWithScores } from "@/lib/types";
import { mmrSelect } from "@/lib/mmr";

const TYPE_PRIORITY: Record<CandidateWithScores["item"]["type"], number> = {
  movie: 0,
  tv: 1,
  anime: 2,
  book: 3,
};

export interface DiversityOptions {
  desired?: number;
  lambda?: number;
  balanceByType?: boolean;
  enforceExactCount?: boolean;
}

export function dedupeFranchises(candidates: CandidateWithScores[]): CandidateWithScores[] {
  const result = new Map<string, CandidateWithScores>();
  const sorted = candidates
    .slice()
    .sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore));
  sorted.forEach((candidate) => {
    const key = (candidate.item.franchiseKey || candidate.item.title).toLowerCase();
    if (!result.has(key)) {
      result.set(key, candidate);
    }
  });
  return Array.from(result.values());
}

export function applyDiversity(
  candidates: CandidateWithScores[],
  desired = 10,
  lambda = 0.5, // Lower default to prioritize relevance
): CandidateWithScores[] {
  return applyDiversityWithOptions(candidates, {
    desired,
    lambda,
    balanceByType: false, // Don't force type balance to maintain relevance
    enforceExactCount: true,
  });
}

export function applyDiversityWithOptions(
  candidates: CandidateWithScores[],
  options: DiversityOptions = {},
): CandidateWithScores[] {
  const desired = options.desired ?? 10;
  const lambda = options.lambda ?? 0.7;
  const balanceByType = options.balanceByType ?? false;
  const enforceExactCount = options.enforceExactCount ?? false;

  if (!candidates.length || desired <= 0) {
    return [];
  }

  const deduped = dedupeFranchises(candidates);
  const pool = balanceByType ? balanceTypes(deduped, desired) : deduped;

  const mmr = mmrSelect(pool, { k: desired, lambda });
  let diversified = scoreCandidates(mmr);

  if (diversified.length >= desired || !enforceExactCount) {
    return diversified.slice(0, desired);
  }

  const remaining = pool.filter((candidate) => !diversified.some((entry) => entry.id === candidate.id));
  const filler = remaining
    .sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore))
    .slice(0, desired - diversified.length);
  diversified = scoreCandidates([...diversified, ...filler]);

  if (diversified.length < desired) {
    const backfillPool = candidates.filter((candidate) => !diversified.some((entry) => entry.id === candidate.id));
    const backfill = backfillPool
      .sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore))
      .slice(0, desired - diversified.length);
    diversified = scoreCandidates([...diversified, ...backfill]);
  }

  return diversified.slice(0, desired);
}

function balanceTypes(candidates: CandidateWithScores[], desired: number): CandidateWithScores[] {
  const groups = new Map<CandidateWithScores["item"]["type"], CandidateWithScores[]>();
  candidates.forEach((candidate) => {
    const list = groups.get(candidate.item.type) ?? [];
    list.push(candidate);
    groups.set(candidate.item.type, list);
  });

  groups.forEach((list) => {
    list.sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore));
  });

  const orderedTypes = Array.from(groups.keys()).sort((a, b) => TYPE_PRIORITY[a] - TYPE_PRIORITY[b]);

  const balanced: CandidateWithScores[] = [];
  while (balanced.length < desired) {
    let added = false;
    for (const type of orderedTypes) {
      const bucket = groups.get(type);
      if (!bucket?.length) {
        continue;
      }
      const candidate = bucket.shift();
      if (candidate) {
        balanced.push(candidate);
        added = true;
        if (balanced.length >= desired) {
          break;
        }
      }
    }
    if (!added) {
      break;
    }
  }

  if (balanced.length >= desired) {
    return balanced.slice(0, desired);
  }

  const remaining = candidates.filter((candidate) => !balanced.some((entry) => entry.id === candidate.id));
  return [
    ...balanced,
    ...remaining
      .sort((a, b) => (b.rerankScore ?? b.fusedScore) - (a.rerankScore ?? a.fusedScore))
      .slice(0, desired - balanced.length),
  ];
}

function scoreCandidates(candidates: CandidateWithScores[]): CandidateWithScores[] {
  return candidates.map((candidate, index) => ({
    ...candidate,
    item: {
      ...candidate.item,
      score: candidate.rerankScore ?? candidate.fusedScore ?? Math.max(0, candidates.length - index),
    },
  }));
}

