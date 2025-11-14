#!/usr/bin/env ts-node
/**
 * Script to check vote count for a specific item from TMDb
 */

import "dotenv/config";
import { env } from "@/env";
import { TmdbProvider } from "@/server/providers/tmdb";

async function main() {
  const titleArg = process.argv[2];
  
  if (!titleArg) {
    console.log("Usage: pnpm check:vote-count \"Title\"");
    process.exit(1);
  }

  const tmdb = new TmdbProvider();
  
  try {
    // Search for the item
    const results = await tmdb.search(titleArg, { limit: 5 });
    
    if (results.length === 0) {
      console.log(`No results found for "${titleArg}"`);
      process.exit(1);
    }
    
    // Find exact match or first result
    const item = results.find((r) => 
      r.title.toLowerCase() === titleArg.toLowerCase()
    ) || results[0];
    
    console.log(`\n🔍 Found: "${item.title}" (${item.type})`);
    console.log(`   Source ID: ${item.sourceId}\n`);
    
    // Fetch full details to get vote_count
    // fetchById expects format: "tmdb-{type}:{id}"
    // For TMDb, anime is stored as "anime" but API uses "tv"
    const tmdbType = item.type === "anime" ? "tv" : item.type;
    const fetchId = `tmdb-${tmdbType}:${item.sourceId}`;
    console.log(`   Fetching details with ID: ${fetchId}`);
    const details = await tmdb.fetchById(fetchId);
    
    if (details) {
      console.log("=".repeat(80));
      console.log("📊 TMDb DETAILS");
      console.log("=".repeat(80));
      console.log(`\n📝 Title: ${details.title}`);
      console.log(`   Type: ${details.type}`);
      console.log(`   Year: ${details.year ?? "N/A"}`);
      
      console.log(`\n📈 RATINGS:`);
      console.log(`   Vote Average: ${details.popularityRaw ?? "N/A"}`);
      console.log(`   Vote Count: ${details.voteCount ?? "N/A"}`);
      
      if (details.popularityRaw && details.voteCount !== null && details.voteCount !== undefined) {
        const hasPenalty = details.voteCount < 50;
        console.log(`\n⚠️  Penalty Applied: ${hasPenalty ? "YES (-30 points)" : "NO"}`);
        if (hasPenalty) {
          const adjustedRaw = Math.max(0, details.popularityRaw - 3.0);
          const normalized = Math.min(100, adjustedRaw * 10);
          console.log(`   Adjusted Score: ${normalized.toFixed(2)}/100`);
        } else {
          const normalized = Math.min(100, details.popularityRaw * 10);
          console.log(`   Normalized Score: ${normalized.toFixed(2)}/100`);
        }
      }
      
      console.log("\n" + "=".repeat(80));
    } else {
      // Try direct API call as fallback
      console.log("Could not fetch via provider, trying direct API call...");
      const tmdbType = item.type === "anime" ? "tv" : item.type;
      const apiUrl = `https://api.themoviedb.org/3/${tmdbType}/${item.sourceId}?api_key=${env.TMDB_API_KEY}`;
      try {
        const response = await fetch(apiUrl);
        if (response.ok) {
          const data = await response.json();
          console.log("=".repeat(80));
          console.log("📊 TMDb API DIRECT RESPONSE");
          console.log("=".repeat(80));
          console.log(`\n📝 Title: ${data.title || data.name}`);
          console.log(`   Vote Average: ${data.vote_average ?? "N/A"}`);
          console.log(`   Vote Count: ${data.vote_count ?? "N/A"}`);
          
          if (data.vote_average !== null && data.vote_average !== undefined && data.vote_count !== null && data.vote_count !== undefined) {
            const hasPenalty = data.vote_count < 50;
            console.log(`\n⚠️  Penalty Applied: ${hasPenalty ? "YES (-30 points)" : "NO"}`);
            if (hasPenalty) {
              const adjustedRaw = Math.max(0, data.vote_average - 3.0);
              const normalized = Math.min(100, adjustedRaw * 10);
              console.log(`   Adjusted Score: ${normalized.toFixed(2)}/100`);
            } else {
              const normalized = Math.min(100, data.vote_average * 10);
              console.log(`   Normalized Score: ${normalized.toFixed(2)}/100`);
            }
          }
          console.log("\n" + "=".repeat(80));
        } else {
          console.log(`API Error: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error("Error fetching from API:", error);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});

