export const locales = ["en", "es", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string | undefined): value is Locale {
  if (!value) return false;
  return (locales as readonly string[]).includes(value);
}

export type LocaleConfig = {
  label: string;
  tmdbLanguage: string;
  tmdbRegion: string;
  availabilityRegion: string;
};

export const localeConfigs: Record<Locale, LocaleConfig> = {
  en: {
    label: "English",
    tmdbLanguage: "en-US",
    tmdbRegion: "US",
    availabilityRegion: "US",
  },
  es: {
    label: "Español",
    tmdbLanguage: "es-ES",
    tmdbRegion: "ES",
    availabilityRegion: "ES",
  },
  de: {
    label: "Deutsch",
    tmdbLanguage: "de-DE",
    tmdbRegion: "DE",
    availabilityRegion: "DE",
  },
};

export const fallbackLocaleChain: Record<Locale, Locale[]> = {
  en: ["en"],
  es: ["es", "en"],
  de: ["de", "en"],
};

export function getLocaleConfig(locale: Locale): LocaleConfig {
  return localeConfigs[locale];
}

export function resolveLocale(value: string | undefined): Locale {
  if (isLocale(value)) {
    return value;
  }
  return defaultLocale;
}

