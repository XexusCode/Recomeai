"use client";

import Image from "next/image";
import { useState } from "react";

interface AvailabilityLogoProps {
  icon?: string | null;
  name: string;
  initials: string;
}

export function AvailabilityLogo({ icon, name, initials }: AvailabilityLogoProps) {
  const [showFallback, setShowFallback] = useState(!icon);

  if (showFallback || !icon) {
    return (
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {initials}
      </span>
    );
  }

  return (
    <Image
      src={icon}
      alt={name}
      width={32}
      height={32}
      className="h-10 w-10 rounded-xl object-contain"
      onError={() => setShowFallback(true)}
    />
  );
}


