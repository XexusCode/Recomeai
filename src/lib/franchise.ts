import { normalizeForComparison } from "@/lib/text";

const DROP_WORDS = new Set([
  "part",
  "season",
  "director",
  "cut",
  "edition",
  "extended",
  "ultimate",
  "chapter",
  "episode",
  "movie",
  "film",
]);

const romanRegex = /\b(?=[MDCLXVI])(M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3}))\b/gi;
const numberRegex = /\b\d{1,4}\b/g;

export function computeFranchiseKey(title: string): string {
  const normalized = normalizeForComparison(title)
    .replace(romanRegex, " ")
    .replace(numberRegex, " ");
  const words = normalized
    .split(" ")
    .filter((word) => word && !DROP_WORDS.has(word));
  return words.join(" ").trim();
}

