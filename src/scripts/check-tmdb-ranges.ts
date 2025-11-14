#!/usr/bin/env ts-node
/**
 * Script to check TMDb popularity ranges
 */

import { prisma } from "@/server/db/client";

async function main() {
  const items = await prisma.item.findMany({
    where: { source: "tmdb", popularityRaw: { not: null } },
    select: {
      title: true,
      popularityRaw: true,
      popularity: true,
      type: true,
    },
    orderBy: { popularityRaw: "desc" },
  });

  console.log("\n📊 TMDb Popularity Analysis");
  console.log("=".repeat(80));
  console.log(`Total items: ${items.length}`);
  
  if (items.length === 0) {
    await prisma.$disconnect();
    return;
  }

  const rawValues = items.map((i) => i.popularityRaw!).filter(Boolean);
  const min = Math.min(...rawValues);
  const max = Math.max(...rawValues);
  const avg = rawValues.reduce((a, b) => a + b, 0) / rawValues.length;
  const median = rawValues.sort((a, b) => a - b)[Math.floor(rawValues.length / 2)];

  console.log(`\nRaw values:`);
  console.log(`  Min: ${min.toFixed(2)}`);
  console.log(`  Max: ${max.toFixed(2)}`);
  console.log(`  Average: ${avg.toFixed(2)}`);
  console.log(`  Median: ${median.toFixed(2)}`);

  console.log(`\nTop 20 by raw popularity:`);
  items.slice(0, 20).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.title.padEnd(50)} Raw: ${item.popularityRaw!.toFixed(2).padStart(8)} → Norm: ${item.popularity.toFixed(2)}`);
  });

  console.log(`\nBottom 10 by raw popularity:`);
  items.slice(-10).forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.title.padEnd(50)} Raw: ${item.popularityRaw!.toFixed(2).padStart(8)} → Norm: ${item.popularity.toFixed(2)}`);
  });

  // Check specific popular shows
  const popularShows = ["The Sopranos", "Breaking Bad", "Game of Thrones", "The Wire", "The Office"];
  console.log(`\n📺 Popular shows check:`);
  popularShows.forEach((showName) => {
    const item = items.find((i) => i.title.toLowerCase().includes(showName.toLowerCase()));
    if (item) {
      console.log(`  ${showName.padEnd(25)} Raw: ${item.popularityRaw!.toFixed(2).padStart(8)} → Norm: ${item.popularity.toFixed(2)}`);
    }
  });

  await prisma.$disconnect();
}

main().catch(console.error);

