import { RecommendationPayload } from "@/lib/types";
import { defaultLocale, fallbackLocaleChain, type Locale } from "@/i18n/config";

type ReasonContext = {
  anchorTitle: string;
  hasAnchor: boolean;
  tone: string;
  shared: string;
  contrast: string;
  unique: string;
  closing: string;
};

type ReasonOptions = {
  fallbackQuery?: string | null;
  mode?: "search" | "random";
};

export function generateReasons(
  anchor: RecommendationPayload | null,
  recommendations: RecommendationPayload[],
  locale: Locale,
  options?: ReasonOptions,
): Map<string, string> {
  const reasons = new Map<string, string>();
  recommendations.forEach((recommendation, index) => {
    const reason = buildReason(anchor, recommendation, index, locale, options);
    reasons.set(recommendation.id, reason);
  });
  return reasons;
}

function buildReason(
  anchor: RecommendationPayload | null,
  recommendation: RecommendationPayload,
  index: number,
  locale: Locale,
  options?: ReasonOptions,
): string {
  const language = getLanguageConfig(locale);
  const fallbackQuery = options?.fallbackQuery?.trim() || null;
  const isRandomMode = options?.mode === "random";
  const explicitAnchor = anchor?.title?.trim() || (!isRandomMode ? fallbackQuery : null);

  const sharedGenre = pickSharedGenre(anchor, recommendation) ?? pickFallbackGenre(recommendation);
  const contrastGenre = pickContrastGenre(recommendation, sharedGenre);
  const tone = language.toneByType[recommendation.type] ?? language.toneByTypeFallback;

  const uniquenessSeed = `${recommendation.id}|${anchor?.id ?? ""}|${recommendation.type}`;
  const unique = pickStable(language.uniqueElements, uniquenessSeed);
  const closing = pickStable(language.closingPhrases, `${uniquenessSeed}:closing`);

  const anchorTitle = explicitAnchor ?? language.fallbackAnchor;
  const hasAnchor = Boolean(explicitAnchor);

  const context: ReasonContext = {
    anchorTitle,
    hasAnchor,
    tone,
    shared: sharedGenre,
    contrast: contrastGenre,
    unique,
    closing,
  };

  const sentence = hasAnchor ? language.composeWithAnchor(context) : language.composeWithoutAnchor(context);
  if (language.locale === "en") {
    return finalizeSentence(ensureEnglishWordCount(sentence, context));
  }
  return finalizeSentence(sentence);
}

function pickSharedGenre(
  anchor: RecommendationPayload | null,
  recommendation: RecommendationPayload,
): string | null {
  if (!anchor) return null;
  const anchorGenres = new Set((anchor.genres ?? []).map((genre) => normalizeDescriptor(genre)));
  for (const genre of recommendation.genres ?? []) {
    if (anchorGenres.has(normalizeDescriptor(genre))) {
      return normalizeDescriptor(genre);
    }
  }
  return null;
}

function pickFallbackGenre(recommendation: RecommendationPayload): string {
  const primary = recommendation.genres?.[0];
  return normalizeDescriptor(primary) ?? "fresh ideas";
}

function pickContrastGenre(recommendation: RecommendationPayload, shared: string | null): string {
  const normalizedShared = normalizeDescriptor(shared);
  const genres = recommendation.genres ?? [];
  const contrast = genres.find((genre) => normalizeDescriptor(genre) !== normalizedShared);
  return normalizeDescriptor(contrast) ?? "unexpected textures";
}

function normalizeDescriptor(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function ensureEnglishWordCount(sentence: string, context: ReasonContext): string {
  let current = sentence;
  if (countWords(current) > 25) {
    current = context.hasAnchor
      ? `If you enjoyed ${context.anchorTitle}, this ${context.tone} pick balances ${context.shared} with ${context.contrast} elements and delivers ${context.unique} ${context.closing}.`
      : `This ${context.tone} pick leans into ${context.shared} themes, mixes in ${context.contrast} detail, and delivers ${context.unique} ${context.closing}.`;
  }
  while (countWords(current) < 18) {
    current = context.hasAnchor
      ? `${current} It builds on what you liked about ${context.anchorTitle}.`
      : `${current} It keeps momentum without losing focus.`;
  }
  if (countWords(current) > 25) {
    current = trimToWordLimit(current, 25);
  }
  return current;
}

function trimToWordLimit(sentence: string, limit: number): string {
  const words = sentence.split(/\s+/).slice(0, limit);
  let trimmed = words.join(" ");
  if (!/[.!?]$/.test(trimmed)) {
    trimmed = `${trimmed}.`;
  }
  return trimmed;
}

function countWords(sentence: string): number {
  return sentence.split(/\s+/).filter(Boolean).length;
}

function finalizeSentence(sentence: string): string {
  const normalized = sentence.replace(/\s+/g, " ").trim();
  if (/[.!?]$/.test(normalized)) {
    return normalized;
  }
  return `${normalized}.`;
}

function pickStable(entries: string[], seed: string): string {
  if (!entries.length) {
    return "";
  }
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }
  const position = hash % entries.length;
  return entries[position];
}

type LanguageConfig = {
  locale: Locale;
  fallbackAnchor: string;
  toneByType: Record<RecommendationPayload["type"], string>;
  toneByTypeFallback: string;
  uniqueElements: string[];
  closingPhrases: string[];
  composeWithAnchor: (context: ReasonContext) => string;
  composeWithoutAnchor: (context: ReasonContext) => string;
};

const ENGLISH_CONFIG: LanguageConfig = {
  locale: "en",
  fallbackAnchor: "this story",
  toneByType: {
    movie: "cinematic",
    tv: "serialized",
    anime: "animated",
    book: "literary",
  },
  toneByTypeFallback: "distinctive",
  uniqueElements: [
    "layered character work",
    "rich worldbuilding",
    "tight suspense",
    "emotional tension",
    "inventive imagery",
    "surprising narrative turns",
    "playful pacing shifts",
    "a resonant character arc",
  ],
  closingPhrases: [
    "that stays with you afterward",
    "that rewards attentive viewers",
    "that sparks fresh conversations",
    "that keeps the momentum alive",
    "that invites reflection later",
    "that feels remarkably personal",
    "that keeps every act purposeful",
    "that adds unexpected warmth",
  ],
  composeWithAnchor: (context) =>
    `If you enjoyed ${context.anchorTitle}, this ${context.tone} pick balances ${context.shared} themes with ${context.contrast} accents, maintains steady pacing, and delivers ${context.unique} ${context.closing}.`,
  composeWithoutAnchor: (context) =>
    `This ${context.tone} pick leans into ${context.shared} energy, layers in ${context.contrast} accents, keeps the pacing confident, and delivers ${context.unique} ${context.closing}.`,
};

const SPANISH_CONFIG: LanguageConfig = {
  locale: "es",
  fallbackAnchor: "esta propuesta",
  toneByType: {
    movie: "cinematográfica",
    tv: "serializada",
    anime: "animada",
    book: "literaria",
  },
  toneByTypeFallback: "singular",
  uniqueElements: [
    "una tensión sostenida",
    "personajes matizados",
    "imaginación poderosa",
    "un ritmo envolvente",
    "un clímax vibrante",
    "temas introspectivos",
    "un humor afinado",
    "una puesta en escena sugerente",
  ],
  closingPhrases: [
    "que invita a conversar después",
    "que equilibra emoción y reflexión",
    "que mantiene la frescura capítulo a capítulo",
    "que deja un poso emocional duradero",
    "que sorprende sin recurrir a spoilers",
    "que respira personalidad propia",
    "que refuerza la inmersión",
    "que conecta con la audiencia",
  ],
  composeWithAnchor: (context) =>
    `Si te gustó ${context.anchorTitle}, esta propuesta ${context.tone} combina ${context.shared} con matices de ${context.contrast}, mantiene un pulso firme y ofrece ${context.unique} ${context.closing}.`,
  composeWithoutAnchor: (context) =>
    `Esta propuesta ${context.tone} combina ${context.shared} con matices de ${context.contrast}, mantiene un pulso firme y ofrece ${context.unique} ${context.closing}.`,
};

const GERMAN_CONFIG: LanguageConfig = {
  locale: "de",
  fallbackAnchor: "diese Empfehlung",
  toneByType: {
    movie: "filmische",
    tv: "serielle",
    anime: "animierte",
    book: "literarische",
  },
  toneByTypeFallback: "markante",
  uniqueElements: [
    "eine dichte Figurenzeichnung",
    "bildstarke Momente",
    "eine spannungsvolle Dramaturgie",
    "emotionale Nuancen",
    "unerwartete Wendungen",
    "eine atmosphärische Tiefe",
    "ein präzises Tempo",
    "eine klare Handschrift",
  ],
  closingPhrases: [
    "lange nachhallt",
    "zum Weiterreden anregt",
    "Gesprächsstoff liefert",
    "fürs Binge-Watching taugt",
    "zum Nachdenken bleibt",
    "persönliches Flair behält",
    "für dauernde Spannung sorgt",
    "die Aufmerksamkeit hält",
  ],
  composeWithAnchor: (context) =>
    `Wenn dir ${context.anchorTitle} gefallen hat, bietet diese ${context.tone} Empfehlung ${context.shared} Themen mit ${context.contrast} Akzenten, hält das Tempo konstant und liefert ${context.unique}, die ${context.closing}.`,
  composeWithoutAnchor: (context) =>
    `Diese ${context.tone} Empfehlung bietet ${context.shared} Themen mit ${context.contrast} Akzenten, hält das Tempo konstant und liefert ${context.unique}, die ${context.closing}.`,
};

const LANGUAGE_CONFIGS: Record<Locale, LanguageConfig> = {
  en: ENGLISH_CONFIG,
  es: SPANISH_CONFIG,
  de: GERMAN_CONFIG,
};

function getLanguageConfig(locale: Locale): LanguageConfig {
  if (LANGUAGE_CONFIGS[locale]) {
    return LANGUAGE_CONFIGS[locale];
  }
  const fallbackOrder = fallbackLocaleChain[locale] ?? [defaultLocale];
  for (const candidate of fallbackOrder) {
    if (LANGUAGE_CONFIGS[candidate]) {
      return LANGUAGE_CONFIGS[candidate];
    }
  }
  return ENGLISH_CONFIG;
}

