#!/usr/bin/env ts-node
/**
 * Script to analyze an item from the database
 * Usage: ts-node --project tsconfig.scripts.json -r tsconfig-paths/register src/scripts/analyze-item.ts [title]
 */

import { prisma } from "@/server/db/client";

async function main() {
  const titleArg = process.argv[2];
  
  if (!titleArg) {
    // Get the most recently added item
    const item = await prisma.item.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        localizations: true,
      },
    });
    
    if (!item) {
      console.log("No items found in database");
      await prisma.$disconnect();
      return;
    }
    
    analyzeItem(item);
  } else {
    const item = await prisma.item.findFirst({
      where: {
        title: {
          contains: titleArg,
          mode: "insensitive",
        },
      },
      include: {
        localizations: true,
      },
    });
    
    if (!item) {
      console.log(`No item found with title containing "${titleArg}"`);
      await prisma.$disconnect();
      return;
    }
    
    analyzeItem(item);
  }
  
  await prisma.$disconnect();
}

function analyzeItem(item: any) {
  console.log("\n" + "=".repeat(80));
  console.log("📊 ITEM ANALYSIS");
  console.log("=".repeat(80));
  
  console.log("\n📝 BASIC INFO:");
  console.log(`  ID: ${item.id}`);
  console.log(`  Title: ${item.title}`);
  console.log(`  Source: ${item.source}`);
  console.log(`  Source ID: ${item.sourceId}`);
  console.log(`  Type: ${item.type}`);
  console.log(`  Year: ${item.year ?? "N/A"}`);
  
  console.log("\n🎭 GENRES:");
  if (item.genres && item.genres.length > 0) {
    item.genres.forEach((genre: string, index: number) => {
      console.log(`  ${index + 1}. ${genre}`);
    });
  } else {
    console.log("  No genres");
  }
  
  console.log("\n📈 POPULARITY:");
  console.log(`  Raw (Original): ${item.popularityRaw ?? "N/A"} ${getRawUnit(item.source)}`);
  console.log(`  Normalized (Nuestra): ${item.popularity.toFixed(2)}/100`);
  if (item.popularityRaw !== null && item.popularityRaw !== undefined) {
    console.log(`  Source: ${getPopularitySource(item.source, item.popularityRaw)}`);
    console.log(`  Conversion: ${item.popularityRaw.toFixed(2)} → ${item.popularity.toFixed(2)}/100`);
  }
  
  console.log("\n🖼️  POSTER:");
  console.log(`  URL: ${item.posterUrl ?? "N/A"}`);
  if (item.posterUrl) {
    console.log(`  Status: ✅ Available`);
  } else {
    console.log(`  Status: ❌ Missing`);
  }
  
  console.log("\n📖 SYNOPSIS:");
  if (item.synopsis) {
    const words = item.synopsis.split(/\s+/).filter(Boolean).length;
    console.log(`  Length: ${item.synopsis.length} characters, ${words} words`);
    console.log(`  Preview: ${item.synopsis.substring(0, 200)}${item.synopsis.length > 200 ? "..." : ""}`);
  } else {
    console.log("  No synopsis");
  }
  
  console.log("\n🔗 LINKS:");
  console.log(`  Provider URL: ${item.providerUrl ?? "N/A"}`);
  
  console.log("\n🌐 LOCALIZATIONS:");
  if (item.localizations && item.localizations.length > 0) {
    item.localizations.forEach((loc: any) => {
      console.log(`  ${loc.locale}:`);
      console.log(`    Title: ${loc.title}`);
      if (loc.synopsis) {
        console.log(`    Synopsis: ${loc.synopsis.substring(0, 100)}${loc.synopsis.length > 100 ? "..." : ""}`);
      }
    });
  } else {
    console.log("  No localizations");
  }
  
  console.log("\n📅 METADATA:");
  console.log(`  Created: ${item.createdAt}`);
  console.log(`  Updated: ${item.updatedAt}`);
  console.log(`  Franchise Key: ${item.franchiseKey ?? "N/A"}`);
  
  console.log("\n" + "=".repeat(80));
}

function getPopularitySource(source: string, rawValue: number): string {
  switch (source) {
    case "tmdb":
      return `TMDb popularity metric`;
    case "anilist":
      if (rawValue <= 100) {
        return `AniList average score`;
      }
      return `AniList popularity`;
    case "googlebooks":
      return `Google Books average rating`;
    case "omdb":
      return `IMDb rating`;
    default:
      return `Unknown source`;
  }
}

function getRawUnit(source: string): string {
  switch (source) {
    case "tmdb":
      return "(métrica TMDb, sin escala fija)";
    case "anilist":
      return "(0-100)";
    case "googlebooks":
      return "(0-5)";
    case "omdb":
      return "(0-10)";
    default:
      return "";
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

