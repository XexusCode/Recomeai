import type { ItemType as PrismaItemType, Source as PrismaSource } from "@prisma/client";

import type { Locale } from "@/i18n/config";

type ItemType = PrismaItemType;
type Source = PrismaSource;

export type ProviderName = Source | "tmdb";

export interface ProviderSearchOptions {
  limit?: number;
  type?: ItemType | "movie" | "series" | "anime" | "tv" | "book" | "any";
}

export interface ProviderItem {
  id: string;
  sourceId: string;
  source: ProviderName;
  type: ItemType;
  title: string;
  titleLang?: string;
  year?: number | null;
  synopsis?: string | null;
  genres?: string[];
  tags?: string[]; // Keywords/tags for thematic matching
  creators?: string[]; // Directors, creators, showrunners
  cast?: string[]; // Top actors/actresses
  posterUrl?: string | null;
  popularityRaw?: number | null;
  voteCount?: number | null; // For TMDb: number of votes for vote_average
  providerUrl?: string | null;
  availability?: AvailabilityLink[];
  franchiseKey?: string | null;
  localizations?: ProviderItemLocalization[];
}

export interface Suggestion {
  id: string;
  title: string;
  type: ItemType;
  year?: number | null;
  source: ProviderName;
  sourceId: string;
  titleLang?: string;
  posterUrl?: string | null;
}

export interface AvailabilityLink {
  label: string;
  type: "stream" | "buy" | "rent" | "read";
  url: string;
  affiliate?: boolean;
}

export interface ProviderItemLocalization {
  locale: Locale;
  title?: string;
  synopsis?: string | null;
  availability?: AvailabilityLink[];
  reason?: string | null;
}

export interface RecommendationPayload {
  id: string;
  title: string;
  type: ItemType;
  year: number | null;
  genres: string[];
  tags?: string[];
  synopsis: string | null;
  creators?: string[];
  cast?: string[];
  posterUrl: string | null;
  popularity: number;
  providerUrl: string | null;
  availability: AvailabilityLink[];
  reason?: string;
  source?: Source;
  franchiseKey?: string | null;
  score: number;
  locale?: Locale;
}

export interface CandidateWithScores {
  id: string;
  item: RecommendationPayload;
  ftsScore?: number;
  vectorScore?: number;
  fusedScore: number;
  rerankScore?: number;
}

export interface DiversityConfig {
  lambda: number;
}

