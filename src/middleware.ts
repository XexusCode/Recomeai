import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { defaultLocale, isLocale, locales } from "@/i18n/config";

/**
 * Detects the preferred locale from the Accept-Language header
 */
function detectLocale(acceptLanguage: string | null): string {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  // Parse Accept-Language header (e.g., "es-ES,es;q=0.9,en;q=0.8")
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [locale, qValue] = lang.trim().split(";");
      const quality = qValue ? parseFloat(qValue.split("=")[1]) : 1.0;
      return {
        locale: locale.toLowerCase().split("-")[0], // Extract base language (es, en, etc.)
        quality,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find the first supported locale
  for (const { locale } of languages) {
    if (isLocale(locale)) {
      return locale;
    }
  }

  // Check for Spanish variants
  if (acceptLanguage.toLowerCase().includes("es")) {
    return "es";
  }

  // Default to English
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the pathname already starts with a locale
  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  // If already has a locale, let it pass through
  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Detect locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  const locale = detectLocale(acceptLanguage);

  // Redirect to the locale-specific path
  const newUrl = request.nextUrl.clone();
  newUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;

  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml
     * - files with extensions (e.g., .png, .jpg, .svg)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)",
  ],
};

