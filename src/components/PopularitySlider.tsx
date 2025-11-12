"use client";

import * as Slider from "@radix-ui/react-slider";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useId, useMemo } from "react";

import { SliderThumb } from "@/components/SliderThumb";

interface PopularitySliderProps {
  value: number | null;
  onChange: (value: number | null) => void;
  labels?: {
    minLabel: string;
    noMinimum: string;
    aria: string;
    clear: string;
    tooltipTitle?: string;
    tooltipBody?: string;
    marks?: number[];
    instructions?: string;
    inputLabel?: string;
  };
}

const MIN = 0;
const MAX = 100;

export function PopularitySlider({ value, onChange, labels }: PopularitySliderProps) {
  const labelId = useId();
  const helperId = useId();
  const inputId = useId();
  const sliderValue = [value ?? MIN];
  const minLabel = labels?.minLabel ?? "Minimum popularity";
  const noMinimumLabel = labels?.noMinimum ?? "No minimum";
  const marks = labels?.marks ?? [0, 25, 50, 75, 100];
  const helperText = labels?.instructions ?? "Use the slider or enter a number between 0 and 100.";
  const formattedValue = useMemo(() => {
    if (value === null || value === MIN) {
      return noMinimumLabel;
    }
    return `${value}`;
  }, [value, noMinimumLabel]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw.trim() === "") {
      onChange(null);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      return;
    }
    const clamped = Math.min(Math.max(parsed, MIN), MAX);
    onChange(clamped <= MIN ? null : clamped);
  };

  const handleInputBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw.trim() === "") {
      onChange(null);
      return;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
      onChange(null);
      return;
    }
    const clamped = Math.min(Math.max(parsed, MIN), MAX);
    onChange(clamped <= MIN ? null : clamped);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 text-base font-medium text-slate-700 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span id={labelId}>{minLabel}</span>
          {labels?.tooltipBody && (
            <span className="inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300">
              <InformationCircleIcon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{labels.tooltipTitle ?? minLabel}</span>
            </span>
          )}
        </div>
        <span className="whitespace-nowrap font-semibold">{formattedValue}</span>
      </div>
      <Slider.Root
        className="relative flex w-full touch-none select-none items-center py-3"
        min={MIN}
        max={MAX}
        step={1}
        value={sliderValue}
        onValueChange={(vals) => {
          const next = vals[0] ?? MIN;
          onChange(next <= MIN ? null : next);
        }}
        aria-labelledby={labelId}
        aria-describedby={helperId}
      >
        <Slider.Track className="relative h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <Slider.Range className="absolute h-full rounded-full bg-blue-500 dark:bg-blue-400" />
        </Slider.Track>
        <SliderThumb
          ariaLabel={labels?.aria ?? minLabel}
          ariaValueText={value === null || value === MIN ? noMinimumLabel : `${value}`}
        />
      </Slider.Root>
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
        {marks.map((mark) => (
          <span key={mark}>{mark}</span>
        ))}
      </div>
      <p id={helperId} className="text-xs text-slate-600 dark:text-slate-300">
        {helperText}
      </p>
      <label htmlFor={inputId} className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
        <span>{labels?.inputLabel ?? "Exact minimum"}</span>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={MIN}
          max={MAX}
          value={value === null ? "" : value}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>
      {labels?.tooltipBody && (
        <p className="text-xs text-slate-600 dark:text-slate-300">{labels.tooltipBody}</p>
      )}
      <button
        type="button"
        onClick={() => onChange(null)}
        className="text-sm font-medium text-blue-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-blue-300"
      >
        {labels?.clear ?? "Clear minimum"}
      </button>
    </div>
  );
}

