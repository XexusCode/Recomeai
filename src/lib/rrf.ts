export interface RankScore {
  id: string;
  score: number;
}

export function reciprocalRankFusion(
  lists: RankScore[][],
  k = 60,
): Map<string, number> {
  const fused = new Map<string, number>();
  lists.forEach((list) => {
    list.forEach((entry, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      fused.set(entry.id, (fused.get(entry.id) ?? 0) + contribution);
    });
  });
  return fused;
}

