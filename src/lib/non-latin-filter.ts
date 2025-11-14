/**
 * Utility function to check if a title contains only Latin characters
 * Rejects titles with non-Latin scripts (CJK, Arabic, Cyrillic, etc.)
 */

export function hasLatinCharacters(value: string | null | undefined): boolean {
  if (!value) return false;
  
  // STRICT: Title must contain at least one Latin letter (A-Z, a-z)
  // This excludes titles that are ONLY in non-Latin scripts
  const hasLatinLetter = /[A-Za-z]/.test(value);
  if (!hasLatinLetter) {
    return false;
  }
  
  // Reject titles with non-Latin scripts (CJK, Arabic, Devanagari, Telugu, Cyrillic, etc.)
  // Allow Latin characters, numbers, spaces, and common punctuation
  // Block: Chinese, Japanese, Korean, Arabic, Hindi, Telugu, Thai, Cyrillic, etc.
  const nonLatinScripts = [
    /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]/, // CJK (Chinese, Japanese)
    /[\uAC00-\uD7AF]/, // Hangul (Korean)
    /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/, // Arabic
    /[\u0900-\u097F]/, // Devanagari (Hindi, Sanskrit)
    /[\u0C00-\u0C7F]/, // Telugu
    /[\u0B80-\u0BFF]/, // Tamil
    /[\u0A00-\u0A7F]/, // Gurmukhi (Punjabi)
    /[\u0980-\u09FF]/, // Bengali
    /[\u0E00-\u0E7F]/, // Thai
    /[\u0F00-\u0FFF]/, // Tibetan
    /[\u0400-\u04FF]/, // Cyrillic (Russian, etc.)
    /[\u0590-\u05FF]/, // Hebrew
    /[\u0370-\u03FF]/, // Greek
  ];
  
  // If title contains any non-Latin script characters, reject it
  for (const pattern of nonLatinScripts) {
    if (pattern.test(value)) {
      return false;
    }
  }
  
  return true;
}

