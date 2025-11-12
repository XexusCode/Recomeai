import { describe, expect, it } from "vitest";

import { computeFranchiseKey } from "@/lib/franchise";

describe("computeFranchiseKey", () => {
  it("removes sequels and punctuation", () => {
    const key = computeFranchiseKey("Dune Part Two (Director's Cut)");
    expect(key).toBe("dune two");
  });
});

