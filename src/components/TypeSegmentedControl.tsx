"use client";

import clsx from "clsx";

type TypeOption = "all" | "movie" | "tv" | "anime" | "book";

interface TypeSegmentedControlProps {
  value: TypeOption;
  onChange: (value: TypeOption) => void;
  labels?: Partial<Record<TypeOption, string>>;
  ariaLabel?: string;
}

const BASE_LABELS: Record<TypeOption, string> = {
  all: "All",
  movie: "Movies",
  tv: "TV",
  anime: "Anime",
  book: "Books",
};

// Iconos SVG inline para cada tipo de contenido (más pequeños)
const TYPE_ICONS: Record<TypeOption, React.ReactNode> = {
  all: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  movie: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  tv: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  anime: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  book: (
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
};

export function TypeSegmentedControl({ value, onChange, labels, ariaLabel }: TypeSegmentedControlProps) {
  const mergedLabels = { ...BASE_LABELS, ...(labels ?? {}) } satisfies Record<TypeOption, string>;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Filter by type"}
      className="relative flex h-full w-full gap-0.5 rounded-md bg-slate-200/50 p-0.5 dark:bg-slate-800/50"
    >
      {(Object.keys(BASE_LABELS) as TypeOption[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={clsx(
            "relative flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-all duration-150 ease-out",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-slate-900",
            "min-w-0", // Prevents text overflow
            value === option
              ? "bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400"
              : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/40 dark:hover:text-slate-200",
          )}
          title={option === "all" ? "Show all content types" : `Show only ${mergedLabels[option]}`}
        >
          <span className="flex-shrink-0">{TYPE_ICONS[option]}</span>
          <span className="relative z-10 truncate">{mergedLabels[option]}</span>
        </button>
      ))}
    </div>
  );
}

