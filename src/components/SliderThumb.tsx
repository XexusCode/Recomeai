'use client';

import * as Slider from "@radix-ui/react-slider";
import clsx from "clsx";

interface SliderThumbProps {
  ariaLabel: string;
  ariaValueText?: string;
}

export function SliderThumb({ ariaLabel, ariaValueText }: SliderThumbProps) {
  return (
    <Slider.Thumb
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      className={clsx(
        "block h-5 w-5 rounded-full border-2 border-white bg-blue-600 shadow transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
        "dark:border-slate-900 dark:bg-blue-400",
      )}
    />
  );
}
