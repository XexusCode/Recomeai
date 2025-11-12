import { describe, expect, it } from "vitest";

import { dedupeFranchises, applyDiversity, applyDiversityWithOptions } from "@/server/recommendations/diversity";
import type { CandidateWithScores } from "@/lib/types";

function makeCandidate(id: string, overrides: Partial<CandidateWithScores["item"]> = {}): CandidateWithScores {
  const baseScore = Number.parseInt(id, 10) || id.charCodeAt(0);
  return {
    id,
    fusedScore: baseScore / 100,
    item: {
      id,
      title: `Title ${id}`,
      type: overrides.type ?? "movie",
      year: overrides.year ?? 2000,
      genres: overrides.genres ?? ["Drama"],
      synopsis: "",
      posterUrl: null,
      popularity: overrides.popularity ?? 70,
      providerUrl: null,
      availability: [],
      score: 0,
      franchiseKey: overrides.franchiseKey ?? "shared",
    },
  };
}

describe("dedupeFranchises", () => {
  it("keeps only the highest scoring item per franchise", () => {
    const candidates: CandidateWithScores[] = [
      { ...makeCandidate("a"), rerankScore: 0.9, item: { ...makeCandidate("a").item, franchiseKey: "x" } },
      { ...makeCandidate("b"), rerankScore: 0.8, item: { ...makeCandidate("b").item, franchiseKey: "x" } },
      { ...makeCandidate("c"), rerankScore: 0.7, item: { ...makeCandidate("c").item, franchiseKey: "y" } },
    ];

    const deduped = dedupeFranchises(candidates);

    expect(deduped).toHaveLength(2);
    const ids = deduped.map((candidate) => candidate.id);
    expect(ids).toContain("a");
    expect(ids).toContain("c");
  });
});

describe("applyDiversity", () => {
  it("returns up to the desired number of diverse candidates", () => {
    const candidates = Array.from({ length: 12 }).map((_, index) =>
      makeCandidate(String(index + 1), {
        franchiseKey: `franchise-${index % 4}`,
        genres: [index % 2 === 0 ? "Drama" : "Sci-Fi"],
        popularity: 60 + index,
      }),
    );

    const diversified = applyDiversity(candidates, 10, 0.7);

    expect(diversified).toHaveLength(10);
    const franchiseKeys = new Set(diversified.map((candidate) => candidate.item.franchiseKey));
    expect(franchiseKeys.size).toBeGreaterThan(2);
  });

  it("balances across types when enabled", () => {
    const candidates: CandidateWithScores[] = [
      makeCandidate("1", { type: "movie", franchiseKey: "m1" }),
      makeCandidate("2", { type: "movie", franchiseKey: "m2" }),
      makeCandidate("3", { type: "tv", franchiseKey: "t1" }),
      makeCandidate("4", { type: "anime", franchiseKey: "a1" }),
      makeCandidate("5", { type: "book", franchiseKey: "b1" }),
      makeCandidate("6", { type: "book", franchiseKey: "b2" }),
    ];

    const diversified = applyDiversityWithOptions(candidates, {
      desired: 4,
      lambda: 0.7,
      balanceByType: true,
      enforceExactCount: true,
    });

    expect(diversified).toHaveLength(4);
    const types = diversified.map((candidate) => candidate.item.type);
    expect(new Set(types).size).toBeGreaterThanOrEqual(3);
  });

  it("backfills from original list when deduping reduces count", () => {
    const candidates = [
      makeCandidate("1", { franchiseKey: "shared" }),
      makeCandidate("2", { franchiseKey: "shared" }),
      makeCandidate("3", { franchiseKey: "unique" }),
    ];

    const diversified = applyDiversityWithOptions(candidates, {
      desired: 4,
      lambda: 0.7,
      balanceByType: false,
      enforceExactCount: true,
    });

    expect(diversified).toHaveLength(3);
    const ids = diversified.map((candidate) => candidate.id);
    expect(ids).toContain("1");
    expect(ids).toContain("3");
  });
});

