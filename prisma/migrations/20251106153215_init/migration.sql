-- DropIndex
DROP INDEX "Item_embedding_idx";

-- DropIndex
DROP INDEX "Item_titleNorm_idx";

-- AlterTable
ALTER TABLE "Item" ALTER COLUMN "genres" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);
