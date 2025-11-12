CREATE TABLE "ItemLocalization" (
  "id" TEXT PRIMARY KEY,
  "itemId" TEXT NOT NULL REFERENCES "Item"("id") ON DELETE CASCADE,
  "locale" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "synopsis" TEXT,
  "availability" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "ItemLocalization_itemId_locale_key" ON "ItemLocalization" ("itemId", "locale");
CREATE INDEX "ItemLocalization_locale_idx" ON "ItemLocalization" ("locale");

INSERT INTO "ItemLocalization" ("id", "itemId", "locale", "title", "synopsis", "availability", "createdAt", "updatedAt")
SELECT
  concat('loc_', substr(md5(random()::text || clock_timestamp()::text), 1, 24)) as id,
  i."id",
  'en' as locale,
  i."title",
  i."synopsis",
  i."availability",
  NOW(),
  NOW()
FROM "Item" i
ON CONFLICT DO NOTHING;
