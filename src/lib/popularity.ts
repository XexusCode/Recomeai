export interface PopularityCandidate {
  popularityRaw?: number | null;
  synopsis?: string | null;
  source?: string;
  voteCount?: number | null; // For TMDb: number of votes for vote_average
}

/**
 * Normalizes popularity using provider-specific scaling for proportional conversion.
 * Each provider has its own scale, so we normalize proportionally:
 * - TMDb: typically 0-1000+, divide by 10 (951 → 95.1)
 * - AniList: 0-100, keep as is
 * - Google Books: 0-5, multiply by 20 (4.5 → 90)
 * - OMDb: 0-10, multiply by 10 (8.5 → 85)
 */
export function normalizePopularityBatch(items: PopularityCandidate[]): number[] {
  const rawValues = items.map((item) => item.popularityRaw).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  
  if (rawValues.length === 0) {
    // Fallback to synopsis-based proxy
    return items.map((item) => {
      const synopsisLength = (item.synopsis ?? "").split(/\s+/).filter(Boolean).length;
      return clamp(synopsisLength / 12, 5, 80);
    });
  }
  
  return items.map((item) => {
    if (typeof item.popularityRaw === "number" && Number.isFinite(item.popularityRaw)) {
      const raw = item.popularityRaw;
      const source = item.source;
      
      // Provider-specific normalization
      if (source === "tmdb") {
        // TMDb: Now using vote_average (user rating 0-10) instead of popularity
        // vote_average is the actual user rating, which is more meaningful
        // Scale: 0-10 → 0-100 (multiply by 10)
        // Penalty: If vote_count < 50, reduce by 50 points (5.0 in raw scale)
        // Example: 8.6 → 86, 7.5 → 75, 9.2 → 92
        if (raw <= 10) {
          // This is vote_average (0-10 scale)
          let adjustedRaw = raw;
          // Apply penalty if vote_count < 50
          const voteCount = item.voteCount ?? 0;
          if (voteCount < 50) {
            adjustedRaw = Math.max(0, raw - 5.0); // Reduce by 50 points (5.0 in 0-10 scale = 50 in 0-100 scale)
          }
          // Multiply by 10 to get 0-100 scale
          return clamp(adjustedRaw * 10, 0, 100);
        } else {
          // Fallback: old popularity metric (values can be > 10)
          // Values < 100: multiply by 1.2
          // Values >= 100: use sqrt scaling
          if (raw >= 100) {
            return clamp(Math.sqrt(raw) * 10, 0, 100);
          } else {
            return clamp(raw * 1.2, 0, 100);
          }
        }
      } else if (source === "anilist") {
        // AniList: Now using averageScore (user rating 0-100) instead of popularity
        // averageScore is the actual user rating, which is more meaningful
        // Scale: 0-100 → 0-100 (already in correct scale)
        // Example: 85 → 85, 92 → 92, 78 → 78
        if (raw <= 100) {
          // This is averageScore (0-100 scale), use as is
          return clamp(raw, 0, 100);
        } else {
          // Fallback: old popularity metric (values can be > 100)
          // Divide by 10 to normalize
          return clamp(raw / 10, 0, 100);
        }
      } else if (source === "googlebooks") {
        // Google Books: 0-5 scale, multiply by 20
        return clamp(raw * 20, 0, 100);
      } else if (source === "omdb") {
        // OMDb: 0-10 scale, multiply by 10
        return clamp(raw * 10, 0, 100);
      } else {
        // Unknown source: use percentile-based normalization as fallback
        const sorted = [...rawValues].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        if (min === max) {
          return 50;
        }
        // Linear scaling from min to max
        const ratio = (raw - min) / (max - min);
        return clamp(ratio * 100, 0, 100);
      }
    }
    const synopsisLength = (item.synopsis ?? "").split(/\s+/).filter(Boolean).length;
    const proxy = clamp(synopsisLength / 12, 5, 80);
    return proxy;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

