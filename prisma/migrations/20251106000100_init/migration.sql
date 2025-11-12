CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "Source" AS ENUM ('mock', 'omdb', 'anilist', 'googlebooks');
CREATE TYPE "ItemType" AS ENUM ('movie', 'tv', 'anime', 'book');

CREATE TABLE "Item" (
  "id" TEXT PRIMARY KEY,
  "source" "Source" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "type" "ItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "titleNorm" tsvector NOT NULL,
  "year" INTEGER,
  "genres" TEXT[] NOT NULL DEFAULT '{}',
  "synopsis" TEXT,
  "popularity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "popularityRaw" DOUBLE PRECISION,
  "posterUrl" TEXT,
  "franchiseKey" TEXT,
  "embedding" vector(768),
  "availability" JSONB,
  "providerUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "Item_source_sourceId_key" ON "Item"("source", "sourceId");
CREATE INDEX "Item_type_year_popularity_idx" ON "Item"("type", "year", "popularity");
CREATE INDEX "Item_franchiseKey_idx" ON "Item"("franchiseKey");
CREATE INDEX "Item_titleNorm_idx" ON "Item" USING GIN ("titleNorm");

CREATE INDEX "Item_embedding_idx"
ON "Item"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 200);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_item_updated_at
BEFORE UPDATE ON "Item"
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();

