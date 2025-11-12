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

export function TypeSegmentedControl({ value, onChange, labels, ariaLabel }: TypeSegmentedControlProps) {
  const mergedLabels = { ...BASE_LABELS, ...(labels ?? {}) } satisfies Record<TypeOption, string>;
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Filter by type"}
      className="flex h-full w-full flex-wrap gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800"
    >
      {(Object.keys(BASE_LABELS) as TypeOption[]).map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={clsx(
            "flex-1 rounded-lg px-4 py-3 text-base font-semibold transition-all",
            value === option
              ? "bg-white text-blue-600 shadow-md dark:bg-slate-900 dark:text-blue-300"
              : "text-slate-600 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-slate-700",
          )}
        >
          {mergedLabels[option]}
        </button>
      ))}
    </div>
  );
}

