-- DropForeignKey
ALTER TABLE "ItemLocalization" DROP CONSTRAINT "ItemLocalization_itemId_fkey";

-- AlterTable
ALTER TABLE "ItemLocalization" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "ItemLocalization" ADD CONSTRAINT "ItemLocalization_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
