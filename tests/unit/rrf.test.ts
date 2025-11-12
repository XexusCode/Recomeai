import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "@/lib/rrf";

describe("reciprocalRankFusion", () => {
  it("combines rankings favouring items present in multiple lists", () => {
    const fusion = reciprocalRankFusion([
      [
        { id: "a", score: 1 },
        { id: "b", score: 2 },
      ],
      [
        { id: "b", score: 1 },
        { id: "c", score: 2 },
      ],
    ]);
    expect(fusion.get("b") ?? 0).toBeGreaterThan(fusion.get("a") ?? 0);
    expect(fusion.get("b") ?? 0).toBeGreaterThan(fusion.get("c") ?? 0);
  });
});

