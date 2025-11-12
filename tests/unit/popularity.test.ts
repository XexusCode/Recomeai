import { describe, expect, it } from "vitest";

import { normalizePopularityBatch } from "@/lib/popularity";

describe("normalizePopularityBatch", () => {
  it("scales 0-10 inputs to 0-100", () => {
    const result = normalizePopularityBatch([
      { popularityRaw: 8 },
      { popularityRaw: 4.5 },
    ]);
    expect(result[0]).toBeCloseTo(100, -1);
    expect(result[1]).toBeGreaterThanOrEqual(40);
  });

  it("uses synopsis length when raw is missing", () => {
    const result = normalizePopularityBatch([
      { synopsis: "Una historia muy corta." },
      { synopsis: "" },
    ]);
    expect(result[0]).toBeGreaterThan(result[1]);
  });
});

