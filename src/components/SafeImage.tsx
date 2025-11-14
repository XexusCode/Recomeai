"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  fallback?: React.ReactNode;
  priority?: boolean;
}

export function SafeImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className,
  fallback,
  priority,
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = normalizeImageUrl(src);
  const [imageSrc, setImageSrc] = useState<string | null>(normalizedSrc);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    const newSrc = normalizeImageUrl(src);
    setImageSrc(newSrc);
  }, [src]);

  // Set timeout to show fallback if image takes too long
  useEffect(() => {
    if (!imageSrc) return;
    
    const timeout = setTimeout(() => {
      // If image hasn't loaded after 5 seconds, show fallback
      const img = document.querySelector(`img[alt="${alt}"]`) as HTMLImageElement;
      if (img && !img.complete) {
        setHasError(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [imageSrc, alt]);

  if (!imageSrc || hasError) {
    return (
      <>
        {fallback ?? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            No poster available
          </div>
        )}
      </>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      fill={fill}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      onError={() => {
        setHasError(true);
      }}
      onLoad={(e) => {
        const img = e.currentTarget;
        // If image failed to load, set error state
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setHasError(true);
        }
      }}
      unoptimized={imageSrc?.includes("image.tmdb.org") || imageSrc?.includes("amazon.com")}
    />
  );
}

/**
 * Normalizes image URLs, especially for TMDb which requires poster_path to start with /
 */
function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  // If it's already a full URL, return as-is (with minor fixes for TMDb)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // For TMDb URLs, fix double slashes
    if (url.includes("image.tmdb.org")) {
      // Fix double slashes: /t/p/w500//filename.jpg -> /t/p/w500/filename.jpg
      const fixed = url.replace(/\/t\/p\/w\d+\/\/+/, (match) => match.replace(/\/+$/, "/"));
      return fixed;
    }
    return url;
  }

  // Relative URL - not supported for external images
  return null;
}

