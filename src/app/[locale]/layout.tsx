import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { isLocale, locales } from "@/i18n/config";
import { getStrings } from "@/i18n/strings";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const resolved = await params;
  if (!isLocale(resolved.locale)) {
    notFound();
  }
  const strings = getStrings(resolved.locale);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:text-white focus:shadow-lg"
      >
        {strings.common.a11y.skipToContent}
      </a>
      {children}
    </>
  );
}
