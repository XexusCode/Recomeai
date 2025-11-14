import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

import { env } from "@/env";
import { defaultLocale, locales } from "@/i18n/config";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "https://recomeai.com";
const title = "Recomeai · Hybrid movie, series, anime & book recommender";
const description =
  "Recomeai blends semantic vectors, full-text search, and AI reranking to deliver diverse, spoiler-free recommendations for movies, series, anime, and books.";
const keywords = [
  "movie recommendations",
  "tv recommendations",
  "anime recommendations",
  "book recommendations",
  "hybrid search",
  "ai rerank",
  "pgvector",
  "recomeai",
  "content discovery",
];

const languageAlternates = Object.fromEntries(locales.map((locale) => [locale, `/${locale}`]));

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords,
  category: "entertainment",
  authors: [{ name: "Recomeai Team" }],
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "Recomeai",
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image.png`,
        width: 1200,
        height: 630,
        alt: "Recomeai recommendations dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    site: "@recomeai",
    creator: "@recomeai",
    images: [`${siteUrl}/opengraph-image.png`],
  },
  alternates: {
    canonical: "/",
    languages: languageAlternates,
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang={defaultLocale}>
      <head>
        {gaId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId}', {
                    page_path: window.location.pathname,
                  });
                `,
              }}
            />
          </>
        )}
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100`}>
        {children}
        <Toaster position="top-right" richColors />
        <Analytics />
      </body>
    </html>
  );
}
