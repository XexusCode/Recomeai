-- AlterTable: Add creators, cast, and synopsisEmbedding columns
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "creators" TEXT[] DEFAULT '{}';
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "cast" TEXT[] DEFAULT '{}';
ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "synopsisEmbedding" vector(768);

-- Create indexes on creators and cast for faster lookups (using GIN for array searches)
CREATE INDEX IF NOT EXISTS "Item_creators_idx" ON "Item" USING GIN ("creators");
CREATE INDEX IF NOT EXISTS "Item_cast_idx" ON "Item" USING GIN ("cast");

