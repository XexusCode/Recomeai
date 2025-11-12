<p align="center">
  <img src="public/next.svg" alt="Recomeai" width="160" />
</p>

# Recomeai

Recomeai is a production-ready MVP that delivers **exactly 10 hybrid recommendations** for movies, TV series, anime, or books. It combines PostgreSQL Full-Text Search, pgvector similarity, Reciprocal Rank Fusion, AI-driven re-ranking, and MMR-based diversity to ensure every list is relevant, spoiler-free, and franchise-deduplicated. Book mode lets users find literary recommendations using a movie title as the anchor, while every card shows where to watch, buy (including affiliate tags), or read each item.

## Capabilities

- **Hybrid retrieval pipeline**: websearch FTS + cosine pgvector merged with Reciprocal Rank Fusion (k = 60).
- **Seed resolution**: prefers stored embeddings; falls back to provider search + Local TF-IDF embeddings when remote embeddings are unavailable.
- **AI re-ranking**: optional Cohere Rerank integration with a lightweight JSON LLM fallback and deterministic heuristic backup.
- **Diversity**: franchise deduplication + MMR (λ = 0.7) mixing genre overlap, title similarity, and year distance.
- **Providers**: OMDb, AniList, Google Books, and an offline Mock provider (50+ curated titles across media types).
- **Book-from-movie flow**: switch to `Libros` and search any movie title to receive 10 thematically aligned books.
- **Explanations**: 18–25 word Spanish rationales comparing the anchor with each suggestion without spoilers.
- **Frontend UX**: accessible Headless UI combobox, segmented type control, year/popularity filters, and skeleton placeholders to always render 10 slots.

## Stack

- **Frontend**: Next.js 15 (App Router), React 19 RC, Tailwind CSS, Headless UI, SWR, Sonner.
- **Backend**: Next.js route handlers, Prisma ORM, PostgreSQL 16 + pgvector + pg_trgm.
- **Embeddings**: pluggable interface with Local TF-IDF fallback and remote HTTP support.
- **Testing**: Vitest (unit + integration), Testing Library, Playwright e2e.
- **Tooling**: pnpm, TypeScript strict mode, ESLint, Prettier, GitHub Actions CI.

## Quickstart

1. **Clone & install**

   ```bash
   pnpm install
   ```

2. **Start the database** (PostgreSQL 16 + pgvector)

   ```bash
   docker compose up -d
   ```

3. **Configure environment**

   ```bash
   cp env.example .env.local
   # Fill DATABASE_URL, OMDB_API_KEY, optional Cohere/Embeddings keys, affiliate tag, etc.
   ```

4. **Apply migrations & seed mock catalog**

   ```bash
   pnpm prisma migrate dev --name init
   pnpm seed:mock
   ```

5. **Run the dev server**

   ```bash
   pnpm dev
   ```

Open [http://localhost:3000](http://localhost:3000) and search for a title. Switch the type filter to **Libros** to transform any movie/series/anime name into 10 book recommendations.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint with Next + Prettier config |
| `pnpm typecheck` | Strict TypeScript checking |
| `pnpm test` | Vitest unit suite |
| `pnpm test:integration` | Integration tests (API with mocked dependencies) |
| `pnpm test:e2e` | Playwright smoke test (requires running DB, migrations, and `pnpm dev`) |
| `pnpm seed:mock` | Load curated mock catalog, compute embeddings, upsert availability |
| `pnpm ingest:expand -- --provider <omdb|anilist|googlebooks> --query "Naruto" --limit 200` | Expand catalog from live providers |

> **Note**: Playwright’s `webServer` expects the app to start via `pnpm dev`. In CI you may want to run migrations + seed beforehand or target a hosted database.

## Architecture Overview

1. **Seed resolution**
   - Prisma tries to locate the anchor via trigram similarity + FTS to reuse stored vectors.
   - Fallback: enabled providers search (Mock, OMDb, AniList, Google Books) → dynamic embedding via local TF-IDF or remote API.

2. **Hybrid retrieval** (`retrieveCandidates`)
   - FTS query with `websearch_to_tsquery` ranks via `ts_rank_cd`.
   - Vector query uses pgvector cosine (`embedding <=> :query_vector`).
   - Filters applied in SQL (type, year interval, popularity threshold).
   - RRF (k = 60) fuses both rankings.

3. **Re-ranking** (`rerankCandidates`)
   - Cohere Rerank when `COHERE_API_KEY` exists.
   - Else optional lightweight LLM endpoint (JSON schema enforced).
   - Final fallback uses deterministic heuristic (popularity boost + temporal decay).

4. **Diversity** (`applyDiversity`)
   - Deduplicate by normalized `franchiseKey` (title normalization removes seasons/director cuts).
   - Greedy MMR with λ = 0.7 combining genre Jaccard, hashed-title cosine, and year proximity.
   - Backfills from remaining candidates if fewer than 10 survive MMR.

5. **Reasons & availability**
   - Spanish, 18–25 words, highlight shared/contrasting genres and tone without spoilers.
   - Default availability uses JustWatch and Amazon/Audible links, optionally tagging affiliates (`AVAILABILITY_AFFILIATE_TAG`).

## Data Model (`Item`)

| Field | Description |
| --- | --- |
| `id` (cuid) | Primary key |
| `source`, `sourceId` | Provider provenance |
| `type` | `movie` / `tv` / `anime` / `book` |
| `title`, `titleNorm` | Raw title + tsvector |
| `year`, `genres`, `synopsis` | Metadata |
| `popularity`, `popularityRaw` | Normalized 0–100 + original score |
| `posterUrl`, `providerUrl` | Visual & canonical link |
| `availability` | Stream/buy/read entries (label, type, URL, affiliate flag) |
| `franchiseKey` | Normalized key for dedup |
| `embedding` | `vector(768)` (L2-normalized) |

Indexes: GIN on `titleNorm`, IVFFlat (cosine) on `embedding`, btree composite on `(type, year, popularity)`, franchise index for dedupe.

## Testing Strategy

- **Unit**: MMR selection, franchise deduplication, popularity normalization, RRF math.
- **Integration**: `/api/recommendations` success + validation with mocked pipeline dependencies.
- **E2E**: Playwright smoke test - search “Spirited Away”, select suggestion, ensure ≤10 visible cards.

## Deployment Notes

- Provide a PostgreSQL 16+ instance with `pgvector` and `pg_trgm` enabled.
- Set production `EMBEDDINGS_API_BASE` / `COHERE_API_KEY` for higher-quality vectors and reranking.
- Adjust IVFFlat `lists` to match catalog size (default tuned for ~100k items).

## Outstanding Enhancements

- Enrich ingestion pipelines with scheduling and incremental updates.
- Implement streaming availability aggregation beyond default JustWatch/Amazon fallbacks.
- Add caching (Redis/Vercel KV) for autocomplete & recommendations to reduce provider/API pressure.

---

Created with ❤️ for data-driven discovery across film, series, anime y libros.
