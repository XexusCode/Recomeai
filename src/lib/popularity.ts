export interface PopularityCandidate {
  popularityRaw?: number | null;
  synopsis?: string | null;
}

/**
 * Normalizes popularity using percentile-based scaling for better distribution.
 * This approach is more robust to outliers and provides fairer scaling.
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
  
  // Sort for percentile calculation
  const sorted = [...rawValues].sort((a, b) => a - b);
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? sorted[0];
  const p25 = sorted[Math.floor(sorted.length * 0.25)] ?? sorted[0];
  const p50 = sorted[Math.floor(sorted.length * 0.50)] ?? sorted[0];
  const p75 = sorted[Math.floor(sorted.length * 0.75)] ?? sorted[sorted.length - 1];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
  
  // Use percentile-based normalization:
  // - Items below p25 map to 0-25
  // - Items p25-p50 map to 25-50
  // - Items p50-p75 map to 50-75
  // - Items p75-p95 map to 75-95
  // - Items above p95 map to 95-100
  // This ensures better distribution and handles outliers gracefully
  
  return items.map((item) => {
    if (typeof item.popularityRaw === "number" && Number.isFinite(item.popularityRaw)) {
      const raw = item.popularityRaw;
      
      if (raw <= p25) {
        // Bottom quartile: map to 0-25
        const ratio = p25 > p5 ? (raw - p5) / (p25 - p5) : 0;
        return clamp(ratio * 25, 0, 25);
      } else if (raw <= p50) {
        // Second quartile: map to 25-50
        const ratio = (raw - p25) / (p50 - p25);
        return clamp(25 + ratio * 25, 25, 50);
      } else if (raw <= p75) {
        // Third quartile: map to 50-75
        const ratio = (raw - p50) / (p75 - p50);
        return clamp(50 + ratio * 25, 50, 75);
      } else if (raw <= p95) {
        // Top quartile (below outliers): map to 75-95
        const ratio = (raw - p75) / (p95 - p75);
        return clamp(75 + ratio * 20, 75, 95);
      } else {
        // Outliers: map to 95-100
        const max = sorted[sorted.length - 1];
        const ratio = max > p95 ? (raw - p95) / (max - p95) : 0;
        return clamp(95 + ratio * 5, 95, 100);
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

