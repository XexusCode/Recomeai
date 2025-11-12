import { NextResponse } from "next/server";
import { z } from "zod";

import { buildRandomRecommendations, buildRecommendations } from "@/server/recommendations/pipeline";
import { locales } from "@/i18n/config";

const querySchema = z.object({
  query: z.string().optional(),
  mode: z.enum(["random"]).optional(),
  type: z.enum(["movie", "tv", "anime", "book"]).optional(),
  yearMin: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value), {
      message: "yearMin must be a number",
    }),
  yearMax: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value), {
      message: "yearMax must be a number",
    }),
  popMin: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseFloat(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value), {
      message: "popMin must be numeric",
    }),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine((value) => value === undefined || (!Number.isNaN(value) && value > 0), {
      message: "limit must be positive",
    }),
  locale: z.enum(locales).optional(),
}).refine((data) => {
  if (data.mode === "random") return true;
  const query = data.query?.trim() ?? "";
  return query.length > 0;
}, {
  message: "query is required unless mode=random",
  path: ["query"],
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const mode = parsed.data.mode === "random" ? "random" : "search";
    const limit = parsed.data.limit;
    const locale = parsed.data.locale;

    const result = mode === "random"
      ? await buildRandomRecommendations({
          limit,
          locale,
          type: parsed.data.type,
          yearMin: parsed.data.yearMin,
          yearMax: parsed.data.yearMax,
          popMin: parsed.data.popMin,
        })
      : await buildRecommendations({
          query: (parsed.data.query ?? "").trim(),
          type: parsed.data.type,
          yearMin: parsed.data.yearMin,
          yearMax: parsed.data.yearMax,
          popMin: parsed.data.popMin,
          limit,
          locale,
        });

    return NextResponse.json({
      anchor: result.anchor,
      items: result.items,
      debug: result.debug,
    });
  } catch (error) {
    console.error("Recommendation error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

