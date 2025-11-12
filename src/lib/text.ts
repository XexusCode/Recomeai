import crypto from "node:crypto";

const punctuationRegex = /[\p{P}\p{S}]+/gu;
const whitespaceRegex = /\s+/g;

export function normalizeForComparison(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(punctuationRegex, " ")
    .replace(whitespaceRegex, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  return normalizeForComparison(input)
    .split(" ")
    .filter(Boolean);
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) {
    return 0;
  }
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  if (union === 0) {
    return 0;
  }
  return intersection / union;
}

export function tokenHashIndex(token: string, dimension: number): number {
  const hash = crypto.createHash("sha1").update(token).digest();
  return hash.readUInt32BE(0) % dimension;
}

export function hashedVector(tokens: string[], dimension: number): number[] {
  if (dimension <= 0) {
    throw new Error("Dimension must be positive");
  }
  const vector = new Array<number>(dimension).fill(0);
  for (const token of tokens) {
    const bucket = tokenHashIndex(token, dimension);
    vector[bucket] += 1;
  }
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must share dimensionality");
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

