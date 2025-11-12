"use client";

import * as Slider from "@radix-ui/react-slider";
import { useId, useMemo } from "react";

import { SliderThumb } from "@/components/SliderThumb";

interface YearRangeSliderProps {
  value: [number | null, number | null];
  onChange: (value: [number | null, number | null]) => void;
  min?: number;
  max?: number;
  labels?: {
    min: (value: string | number) => string;
    max: (value: string | number) => string;
    any: string;
    ariaMin: string;
    ariaMax: string;
    instructions?: string;
  };
}

export function YearRangeSlider({ value, onChange, min = 1960, max, labels }: YearRangeSliderProps) {
  const labelId = useId();
  const helperId = useId();
  const upperBound = useMemo(() => max ?? new Date().getFullYear(), [max]);
  const lowerBound = min;

  const [rawMin, rawMax] = value;
  const sliderMin = normalizeMin(rawMin, lowerBound, upperBound);
  const sliderMax = normalizeMax(rawMax, lowerBound, upperBound, sliderMin);
  const sliderValue: [number, number] = [sliderMin, sliderMax];

  const anyLabel = labels?.any ?? "any";
  const displayMin = rawMin ?? anyLabel;
  const displayMax = rawMax ?? anyLabel;

  return (
    <div className="space-y-4">
      <div id={labelId} className="flex items-center justify-between text-base font-medium text-slate-700 dark:text-slate-300">
        <span>{labels?.min ? labels.min(displayMin) : `Min: ${displayMin}`}</span>
        <span>{labels?.max ? labels.max(displayMax) : `Max: ${displayMax}`}</span>
      </div>
      <Slider.Root
        className="relative flex w-full touch-none select-none items-center py-3"
        min={lowerBound}
        max={upperBound}
        step={1}
        value={sliderValue}
        onValueChange={(vals) => {
          const [nextMin, nextMax] = vals as [number, number];
          const normalizedMin = nextMin <= lowerBound ? null : nextMin;
          const normalizedMax = nextMax >= upperBound ? null : nextMax;
          onChange([normalizedMin, normalizedMax]);
        }}
        aria-labelledby={labelId}
        aria-describedby={labels?.instructions ? helperId : undefined}
      >
        <Slider.Track className="relative h-3 w-full rounded-full bg-slate-200 dark:bg-slate-700">
          <Slider.Range className="absolute h-full rounded-full bg-blue-500 dark:bg-blue-400" />
        </Slider.Track>
        <SliderThumb
          ariaLabel={labels?.ariaMin ?? "Minimum year"}
          ariaValueText={rawMin === null ? labels?.any ?? "Any year" : `${sliderMin}`}
        />
        <SliderThumb
          ariaLabel={labels?.ariaMax ?? "Maximum year"}
          ariaValueText={rawMax === null ? labels?.any ?? "Any year" : `${sliderMax}`}
        />
      </Slider.Root>
      {labels?.instructions && (
        <p id={helperId} className="text-xs text-slate-600 dark:text-slate-300">
          {labels.instructions}
        </p>
      )}
    </div>
  );
}

function normalizeMin(rawMin: number | null, lowerBound: number, upperBound: number): number {
  if (typeof rawMin === "number") {
    return clamp(rawMin, lowerBound, upperBound - 1);
  }
  return lowerBound;
}

function normalizeMax(
  rawMax: number | null,
  lowerBound: number,
  upperBound: number,
  currentMin: number,
): number {
  if (typeof rawMax === "number") {
    return clamp(rawMax, currentMin + 1, upperBound);
  }
  return upperBound;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

