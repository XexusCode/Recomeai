import { NextResponse } from "next/server";

import { env } from "@/env";
import { searchProviders, toSuggestions } from "@/server/providers/registry";

const DEFAULT_LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10), 12) : DEFAULT_LIMIT;

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const results = await Promise.race([
      searchProviders(query, { limit: limit + 2 }),
      timeout(env.PROVIDER_TIMEOUT_MS + 500),
    ]);

    if (!Array.isArray(results)) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = toSuggestions(results, Math.min(limit, 12));
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Autocomplete error", error);
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error("autocomplete timeout")), ms);
  });
}

