import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

async function applyTagsMigration() {
  console.log("🔄 Aplicando migración para añadir tags...\n");

  // Add tags column
  await prisma.$executeRaw(Prisma.sql`ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT '{}';`);
  console.log("  ✅ Columna 'tags' añadida");

  console.log("\n✅ Migración aplicada exitosamente!");
}

applyTagsMigration().catch((e) => {
  console.error("❌ Error al aplicar la migración:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

