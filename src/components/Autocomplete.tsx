"use client";

import { Combobox } from "@headlessui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import useSWR from "swr";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { hasLatinCharacters } from "@/lib/non-latin-filter";
import type { Suggestion } from "@/lib/types";

interface AutocompleteProps {
  initialQuery?: string;
  onSelect: (selection: { suggestion?: Suggestion; query: string }) => void;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  messages?: {
    ariaLabel?: string;
    loading?: string;
    error?: string;
    empty?: string;
    minChars?: string;
    select?: string;
    pressEnter?: string;
    yearUnknown?: string;
    romaji?: string;
  };
  typeLabel?: (type: Suggestion["type"]) => string;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function Autocomplete({
  initialQuery = "",
  onSelect,
  onQueryChange,
  placeholder,
  messages,
  typeLabel,
  inputRef,
}: AutocompleteProps) {
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const assignInputRef = useCallback(
    (node: HTMLInputElement | null) => {
      if (inputRef) {
        inputRef.current = node;
      }
    },
    [inputRef],
  );

  const shouldFetch = debouncedQuery.trim().length >= 2;
  const { data, isLoading, error } = useSWR<{ suggestions: Suggestion[] }>(
    shouldFetch ? `/api/autocomplete?q=${encodeURIComponent(debouncedQuery)}&limit=12` : null,
    fetcher,
    { keepPreviousData: true },
  );

  const suggestions = useMemo(() => {
    const raw = data?.suggestions ?? [];
    // Filter out non-Latin titles as a safety measure (should already be filtered server-side)
    return raw.filter((suggestion) => hasLatinCharacters(suggestion.title));
  }, [data]);

  useEffect(() => {
    if (selected) {
      setQuery(selected.title);
    }
  }, [selected]);

  const handleSelect = (value: Suggestion | null) => {
    setSelected(value);
    // Only update query and show poster, don't trigger search
    onSelect({ suggestion: value ?? undefined, query: value?.title ?? query });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      // Don't trigger search on Enter from autocomplete - let the form submit handle it
      onSelect({ suggestion: selected ?? undefined, query });
    }
  };

  return (
    <div className="relative w-full">
      <Combobox value={selected} onChange={handleSelect} nullable>
        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-slate-400" />
          <Combobox.Input
            id="search-input"
            className="w-full rounded-xl border-2 border-slate-200 bg-white py-4 pl-12 pr-5 text-lg shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:py-5 sm:text-xl"
            displayValue={(value: Suggestion | null) => value?.title ?? query}
            onChange={(event) => {
              const newQuery = event.target.value;
              setQuery(newQuery);
              if (selected) {
                setSelected(null);
              }
              // Notify parent of query change
              onQueryChange?.(newQuery);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? "Search movies, series, anime, or books"}
            aria-label={messages?.ariaLabel ?? "Search title"}
            ref={assignInputRef}
          />
        </div>
        <Combobox.Options className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border-2 border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {isLoading && (
            <li className="px-4 py-3 text-sm text-slate-600">{messages?.loading ?? "Looking for suggestions…"}</li>
          )}
          {error && !isLoading && (
            <li className="px-4 py-3 text-sm text-rose-500">{messages?.error ?? "Unable to load suggestions"}</li>
          )}
          {!isLoading && !error && suggestions.length === 0 && shouldFetch && (
            <li className="px-4 py-3 text-sm text-slate-600">{messages?.empty ?? "No matches found, try a variation."}</li>
          )}
          {!shouldFetch && (
            <li className="px-4 py-3 text-sm text-slate-600">{messages?.minChars ?? "Type at least two characters."}</li>
          )}
          {suggestions.map((suggestion) => (
            <Combobox.Option
              key={suggestion.id}
              value={suggestion}
              className={({ active }) =>
                clsx(
                  "flex cursor-pointer items-center justify-between px-5 py-4 text-sm transition",
                  active
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-100"
                    : "text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/50",
                )
              }
            >
              {({ active }) => (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold leading-tight text-base">{suggestion.title}</span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {(typeLabel?.(suggestion.type) ?? badgeForType(suggestion.type))} • {suggestion.year ?? messages?.yearUnknown ?? "Year N/A"}
                      {suggestion.titleLang === "romaji" ? ` • ${messages?.romaji ?? "romaji title"}` : null}
                    </span>
                  </div>
                  {active && (
                    <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 dark:bg-blue-500/30 dark:text-blue-100">
                      {messages?.select ?? "Select"}
                    </span>
                  )}
                </>
              )}
            </Combobox.Option>
          ))}
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-500">
            {messages?.pressEnter ?? "Press Enter to search with the current text."}
          </div>
        </Combobox.Options>
      </Combobox>
    </div>
  );
}

function badgeForType(type: Suggestion["type"]): string {
  switch (type) {
    case "movie":
      return "Movie";
    case "tv":
      return "Series";
    case "anime":
      return "Anime";
    case "book":
      return "Book";
    default:
      return type;
  }
}

