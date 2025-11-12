import { describe, expect, it } from "vitest";

import { generateReasons } from "@/server/recommendations/reasons";
import type { RecommendationPayload } from "@/lib/types";

function buildPayload(overrides: Partial<RecommendationPayload> = {}): RecommendationPayload {
  return {
    id: overrides.id ?? "rec-1",
    title: overrides.title ?? "Sample Title",
    type: overrides.type ?? "movie",
    year: overrides.year ?? 2021,
    genres: overrides.genres ?? ["Science Fiction", "Thriller"],
    synopsis: overrides.synopsis ?? "Test synopsis.",
    posterUrl: overrides.posterUrl ?? null,
    popularity: overrides.popularity ?? 72,
    providerUrl: overrides.providerUrl ?? null,
    availability: overrides.availability ?? [],
    franchiseKey: overrides.franchiseKey ?? null,
    score: overrides.score ?? 0,
    reason: overrides.reason,
    source: overrides.source,
  };
}

describe("generateReasons", () => {
  it("produces deterministic English sentences between 18 and 25 words", () => {
    const anchor = buildPayload({ id: "anchor", title: "Inception" });
    const recommendations = [
      buildPayload({ id: "rec-a", title: "Arrival" }),
      buildPayload({ id: "rec-b", title: "Blade Runner 2049", genres: ["Science Fiction", "Drama"] }),
    ];

    const firstRun = generateReasons(anchor, recommendations, "en", { mode: "search" });
    const secondRun = generateReasons(anchor, recommendations, "en", { mode: "search" });

    recommendations.forEach((rec) => {
      const reasonA = firstRun.get(rec.id);
      const reasonB = secondRun.get(rec.id);
      expect(reasonA).toBeDefined();
      expect(reasonB).toBe(reasonA);

      const wordCount = reasonA!.split(/\s+/).filter(Boolean).length;
      expect(wordCount).toBeGreaterThanOrEqual(18);
      expect(wordCount).toBeLessThanOrEqual(25);

      expect(reasonA).toMatch(/^If you enjoyed/);
    });
  });

  it("uses fallback query when anchor is missing", () => {
    const recommendations = [buildPayload({ id: "rec-c", title: "Dune", genres: ["Science Fiction", "Adventure"] })];
    const reasons = generateReasons(null, recommendations, "en", { fallbackQuery: "The Flash", mode: "search" });
    const reason = reasons.get("rec-c");
    expect(reason).toBeDefined();
    expect(reason).toContain("The Flash");
  });

  it("avoids anchor phrasing in random mode", () => {
    const recommendations = [buildPayload({ id: "rec-d", title: "The Bear", genres: ["Drama", "Comedy"] })];
    const reasons = generateReasons(null, recommendations, "en", { mode: "random" });
    const reason = reasons.get("rec-d");
    expect(reason).toBeDefined();
    expect(reason).not.toMatch(/^If you enjoyed/);
  });
});
