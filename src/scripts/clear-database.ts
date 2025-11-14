#!/usr/bin/env ts-node
/**
 * Script to clear all items from the database
 * Usage: ts-node --project tsconfig.scripts.json -r tsconfig-paths/register src/scripts/clear-database.ts
 */

import { prisma } from "@/server/db/client";

async function main() {
  console.log("🗑️  Clearing all items from database...");

  // Count items before deletion
  const countBefore = await prisma.item.count();
  console.log(`📊 Found ${countBefore} items in database`);

  if (countBefore === 0) {
    console.log("✅ Database is already empty");
    await prisma.$disconnect();
    return;
  }

  // Delete all items (ItemLocalization will be deleted automatically due to CASCADE)
  const result = await prisma.item.deleteMany({});

  console.log(`✅ Deleted ${result.count} items from database`);
  console.log("✅ Database cleared successfully");

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Error clearing database:", error);
  process.exit(1);
});

