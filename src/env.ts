import { z } from "zod";

const providersDefault = ["mock", "omdb", "anilist", "googlebooks", "tmdb"] as const;
const embeddingProviders = ["generic", "openai"] as const;
type EmbeddingProvider = (typeof embeddingProviders)[number];

const booleanDefaultTrue = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return undefined;
      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
      return undefined;
    }
    if (typeof value === "number") {
      return value !== 0;
    }
    if (typeof value === "boolean") {
      return value;
    }
    return undefined;
  }, z.boolean()).default(true);

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      if (!trimmed.length) return undefined;
      const normalized = trimmed.replace(/\/+$/, "");
      return normalized;
    })
    .refine((val) => val === undefined || z.string().url().safeParse(val).success, {
      message: "Invalid url",
    }),
  OMDB_API_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  ENABLED_PROVIDERS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [...providersDefault],
    ),
  EMBEDDINGS_API_BASE: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined))
    .refine((val) => val === undefined || z.string().url().safeParse(val).success, {
      message: "Invalid url",
    }),
  EMBEDDINGS_API_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  EMBEDDINGS_DIM: z.coerce.number().int().positive().optional(),
  EMBEDDINGS_PROVIDER: z
    .string()
    .optional()
    .transform((val): EmbeddingProvider => {
      const normalized = val?.trim().toLowerCase();
      if (!normalized) {
        return "generic";
      }
      if ((embeddingProviders as readonly string[]).includes(normalized)) {
        return normalized as EmbeddingProvider;
      }
      throw new Error(`Unsupported embeddings provider: ${val}`);
    }),
  EMBEDDINGS_MODEL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  TMDB_API_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  TMDB_API_BASE: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined))
    .refine((val) => val === undefined || z.string().url().safeParse(val).success, {
      message: "Invalid url",
    })
    .default("https://api.themoviedb.org/3"),
  TMDB_WATCH_REGION: z
    .string()
    .optional()
    .transform((val) => {
      const normalized = (val ?? "US").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(normalized)) {
        throw new Error("TMDB_WATCH_REGION must be a two-letter ISO country code (e.g., US).");
      }
      return normalized;
    }),
  COHERE_API_KEY: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  OMDB_API_URL: z.string().url().default("https://www.omdbapi.com/"),
  ANILIST_API_URL: z
    .string()
    .url()
    .default("https://graphql.anilist.co"),
  EMBEDDINGS_TIMEOUT_MS: z.coerce.number().int().positive().default(7_000),
  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(4_500),
  LLM_RERANK_URL: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined))
    .refine((val) => val === undefined || z.string().url().safeParse(val).success, {
      message: "Invalid url",
    }),
  LLM_RERANK_API_KEY: z.string().optional(),
  AVAILABILITY_AFFILIATE_TAG: z.string().optional(),
  RERANK_ENABLED: booleanDefaultTrue,
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default(process.env.NODE_ENV === "test" ? "test" : "development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration. Check your .env file.");
}

const envData = parsed.data;

export const env = envData;

export const enabledProviders = new Set(envData.ENABLED_PROVIDERS ?? providersDefault);

export function requireDatabaseUrl(): string {
  if (!envData.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for this operation");
  }
  return envData.DATABASE_URL;
}

