# API Keys Guide

This document explains where to obtain each API key used in Recomeai. **All keys are optional** - the app will work with the `mock` provider alone, but adding real API keys enables live data from external providers.

## Required for Development

**None** - You can run the app with just the mock provider.

## Optional API Keys

### 1. OMDB_API_KEY

**Purpose**: Fetch movie and TV series metadata from OMDb (Open Movie Database).

**Where to get it**:
1. Visit https://www.omdbapi.com/apikey.aspx
2. Choose the **FREE** tier (1,000 requests/day)
3. Enter your email address
4. Check your email and click the activation link
5. Copy your API key

**Cost**: Free tier available (1,000 requests/day)

**Usage**: Enables searching for movies and TV shows. Without it, only the `mock` provider will work for movies/TV.

---

### 2. COHERE_API_KEY

**Purpose**: AI-powered reranking of recommendations for better relevance.

**Where to get it**:
1. Visit https://cohere.com/
2. Sign up for a free account
3. Go to https://dashboard.cohere.com/api-keys
4. Create a new API key
5. Copy the key (starts with `co_`)

**Cost**: Free tier available (100 requests/minute, 10k requests/month)

**Usage**: Improves recommendation quality by reranking results. Without it, the app uses a lightweight heuristic fallback.

---

### 3. EMBEDDINGS_API_BASE + EMBEDDINGS_API_KEY

**Purpose**: Generate vector embeddings for semantic search (alternative to the built-in TF-IDF).

**Options**:

#### Option A: OpenAI Embeddings
- **EMBEDDINGS_API_BASE**: `https://api.openai.com/v1/embeddings`
- **EMBEDDINGS_API_KEY**: Get from https://platform.openai.com/api-keys
- **EMBEDDINGS_DIM**: `1536` (for `text-embedding-3-small`) or `3072` (for `text-embedding-3-large`)
- **Cost**: ~$0.02 per 1M tokens

#### Option B: Cohere Embed
- **EMBEDDINGS_API_BASE**: `https://api.cohere.com/v1/embed`
- **EMBEDDINGS_API_KEY**: Same as COHERE_API_KEY above
- **EMBEDDINGS_DIM**: `1024` (default)
- **Cost**: Free tier available

#### Option C: Hugging Face Inference API
- **EMBEDDINGS_API_BASE**: `https://api-inference.huggingface.co/pipeline/feature-extraction/{model_name}`
- **EMBEDDINGS_API_KEY**: Get from https://huggingface.co/settings/tokens
- **EMBEDDINGS_DIM**: Varies by model (e.g., `384` for `sentence-transformers/all-MiniLM-L6-v2`)

#### Option D: Self-hosted (e.g., Sentence Transformers)
- Deploy your own embedding service
- **EMBEDDINGS_API_BASE**: Your service URL (e.g., `http://localhost:8000/embed`)
- **EMBEDDINGS_API_KEY**: Optional, if your service requires auth

**Usage**: Better semantic search than TF-IDF. Without it, the app uses a deterministic local TF-IDF implementation.

---

### 4. LLM_RERANK_URL + LLM_RERANK_API_KEY

**Purpose**: Custom LLM-based reranking endpoint (alternative to Cohere Rerank).

**Where to get it**:
- Deploy your own reranking service that accepts:
  - `query`: string
  - `candidates`: array of items with `id`, `title`, `synopsis`, etc.
  - Returns: `{ results: [{ id: string, score: number }] }`

**Example**: Use OpenAI's chat completions API or a self-hosted model.

**Usage**: Only needed if you want custom reranking logic. Cohere Rerank (via `COHERE_API_KEY`) is preferred.

---

### 5. AVAILABILITY_AFFILIATE_TAG

**Purpose**: Add affiliate tracking to Amazon/JustWatch links for monetization.

**Where to get it**:
- **Amazon Associates**: https://affiliate-program.amazon.com/
  - Sign up, get your tracking ID (format: `yourname-20`)
  - Set `AVAILABILITY_AFFILIATE_TAG=yourname-20`
- **JustWatch**: Contact JustWatch for affiliate partnerships

**Usage**: Optional monetization. Without it, links work normally but don't include affiliate tracking.

---

## 6. TMDB_API_KEY (Películas y series)

**Propósito**: Permite consultar el catálogo de The Movie Database (TMDb) para películas y series, utilizando el proveedor `tmdb` y los comandos de ingestión en modo `discover`.

**Dónde obtenerla**:
1. Crea una cuenta en [TMDb](https://www.themoviedb.org/).
2. En tu perfil, ve a **Settings → API**.
3. Solicita una API key (Developer). La versión gratuita es suficiente para uso personal.
4. Copia la clave y añádela a tu `.env.local` como `TMDB_API_KEY`.

**Opciones adicionales**:
- `TMDB_API_BASE`: Cambia el endpoint (por defecto `https://api.themoviedb.org/3`).
- Puedes habilitar el proveedor añadiendo `tmdb` a `ENABLED_PROVIDERS` (ya está incluido por defecto).

---

## Quick Setup (Minimum Viable)

For local development, you only need:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/recomeai"
ENABLED_PROVIDERS="mock"
```

All other keys can be left empty. The app will:
- Use the mock provider for all content
- Use local TF-IDF embeddings
- Use heuristic reranking
- Work without any external API dependencies

## Recommended Setup (Better Quality)

For better recommendation quality, add:

```bash
OMDB_API_KEY="your_omdb_key"           # Enables real movie/TV data
COHERE_API_KEY="your_cohere_key"       # Enables AI reranking
ENABLED_PROVIDERS="mock,omdb,anilist"  # Use multiple providers
```

## Production Setup (Full Features)

For production, add all keys:

```bash
OMDB_API_KEY="your_omdb_key"
COHERE_API_KEY="your_cohere_key"
EMBEDDINGS_API_BASE="https://api.openai.com/v1/embeddings"
EMBEDDINGS_API_KEY="your_openai_key"
EMBEDDINGS_DIM="1536"
AVAILABILITY_AFFILIATE_TAG="your-amazon-tag"
ENABLED_PROVIDERS="mock,omdb,anilist,googlebooks"
```

---

## Notes

- **AniList** and **Google Books** APIs don't require keys (they're public/free)
- The `mock` provider is always available and doesn't need any keys
- All keys are optional - the app gracefully degrades when keys are missing
- Never commit API keys to version control - use `.env.local` (already in `.gitignore`)

