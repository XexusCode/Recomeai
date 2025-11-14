import "dotenv/config";

import { setTimeout as delay } from "node:timers/promises";

import type { CliOptions } from "./ingest-expand";
import { runIngest } from "./ingest-expand";

type DynamicJob = {
  label: string;
  buildOptions: () => CliOptions | Promise<CliOptions>;
  cooldownMs?: number;
};

const DEFAULT_COOLDOWN_MS = Number(process.env.INGEST_DAEMON_COOLDOWN_MS ?? 25_000);

const MOVIE_GENRES = ["28", "12", "16", "18", "878", "53", "80", "9648", "10752"];
const TV_GENRES = ["16", "18", "35", "80", "9648", "10765"];
const MOVIE_SORTS = ["popularity.desc", "vote_average.desc", "release_date.desc"];
const TV_SORTS = ["vote_average.desc", "popularity.desc", "first_air_date.desc"];

const MOVIE_SOURCES: DynamicJob = {
  label: "tmdb-popular-movies",
  buildOptions: () => {
    const year = randomYear(1985, new Date().getFullYear());
    const sortBy = pickRandom(MOVIE_SORTS);
    const genre = Math.random() < 0.7 ? pickRandom(MOVIE_GENRES) : undefined;
    return {
      provider: "tmdb",
      limit: 90,
      discover: {
        mediaType: "movie",
        pages: 4,
        sortBy,
        year,
        genre,
      },
      skipExisting: true,
    };
  },
  cooldownMs: 30_000,
};

const SERIES_SOURCES: DynamicJob = {
  label: "tmdb-trending-series",
  buildOptions: () => {
    const year = randomYear(1995, new Date().getFullYear());
    const sortBy = pickRandom(TV_SORTS);
    const genre = Math.random() < 0.7 ? pickRandom(TV_GENRES) : undefined;
    return {
      provider: "tmdb",
      limit: 90,
      discover: {
        mediaType: "tv",
        pages: 4,
        sortBy,
        year,
        genre,
      },
      skipExisting: true,
    };
  },
  cooldownMs: 30_000,
};

const ANIME_MODES: Array<{
  mode: "trending" | "popular" | "seasonal";
  label: string;
}> = [
  { mode: "trending", label: "TRENDING" },
  { mode: "popular", label: "POPULAR" },
  { mode: "seasonal", label: "SEASONAL" },
];

const SEASONS: Array<"WINTER" | "SPRING" | "SUMMER" | "FALL"> = ["WINTER", "SPRING", "SUMMER", "FALL"];

const ANIME_SOURCE: DynamicJob = {
  label: "anilist-discover-anime",
  buildOptions: () => {
    const mode = pickRandom(ANIME_MODES);
    const season = pickRandom(SEASONS);
    const year = new Date().getFullYear() - Math.floor(Math.random() * 2);
    return {
      provider: "anilist",
      limit: 70,
      discover: {
        mediaType: "anime",
        mode: mode.mode,
        pages: 2,
        season: season,
        year,
      },
      skipExisting: true,
    };
  },
  cooldownMs: 45_000,
};

const BOOK_CATEGORIES = ["fiction", "fantasy", "mystery", "technology", "business", "history", "biography"];

const BOOK_SOURCE: DynamicJob = {
  label: "googlebooks-category",
  buildOptions: () => ({
    provider: "googlebooks",
    limit: 120,
    discover: {
      category: pickRandom(BOOK_CATEGORIES),
      pages: 3,
    },
    skipExisting: true,
  }),
  cooldownMs: 30_000,
};

const JOBS: DynamicJob[] = [MOVIE_SOURCES, SERIES_SOURCES, ANIME_SOURCE, BOOK_SOURCE];

async function runDaemon() {
  let iteration = 0;
  const controller = new AbortController();

  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());

  console.log(
    `[IngestDaemon] Running ${JOBS.length} jobs · base cooldown ${DEFAULT_COOLDOWN_MS}ms · press Ctrl+C to stop`,
  );

  while (!controller.signal.aborted) {
    iteration += 1;
    for (const job of JOBS) {
      if (controller.signal.aborted) break;
      try {
        const options = await job.buildOptions();
        console.log(`[IngestDaemon] Iteration ${iteration} • ${job.label}`);
        await runIngest(options);
      } catch (error) {
        console.error(`[IngestDaemon] ${job.label} failed`, error);
      }
      const waitMs = job.cooldownMs ?? DEFAULT_COOLDOWN_MS;
      if (waitMs > 0 && !controller.signal.aborted) {
        try {
          await delay(waitMs, undefined, { signal: controller.signal });
        } catch {
          break;
        }
      }
    }
  }
  console.log("[IngestDaemon] Stopped.");
}

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomYear(min: number, max: number): number {
  const start = Math.ceil(min);
  const end = Math.floor(max);
  return Math.floor(Math.random() * (end - start + 1)) + start;
}

runDaemon().catch((error) => {
  console.error("[IngestDaemon] Fatal error", error);
  process.exit(1);
});


