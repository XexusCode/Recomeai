import { prisma } from "@/server/db/client";
import { Prisma } from "@prisma/client";

async function applyMigration() {
  console.log("🔄 Aplicando migración para añadir creators y cast...\n");

  try {
    // Aplicar migración SQL directamente
    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "creators" TEXT[] DEFAULT '{}';
    `);
    console.log("  ✅ Columna 'creators' añadida");

    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "cast" TEXT[] DEFAULT '{}';
    `);
    console.log("  ✅ Columna 'cast' añadida");

    await prisma.$executeRaw(Prisma.sql`
      ALTER TABLE "Item" ADD COLUMN IF NOT EXISTS "synopsisEmbedding" vector(768);
    `);
    console.log("  ✅ Columna 'synopsisEmbedding' añadida");

    await prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS "Item_creators_idx" ON "Item" USING GIN ("creators");
    `);
    console.log("  ✅ Índice 'Item_creators_idx' creado");

    await prisma.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS "Item_cast_idx" ON "Item" USING GIN ("cast");
    `);
    console.log("  ✅ Índice 'Item_cast_idx' creado");

    console.log("\n✅ Migración aplicada exitosamente!");
  } catch (error) {
    console.error("\n❌ Error aplicando migración:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  applyMigration().catch(console.error);
}

