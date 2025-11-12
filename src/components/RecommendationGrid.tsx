import { RecommendationCard } from "@/components/RecommendationCard";
import type { RecommendationPayload } from "@/lib/types";
import type { Locale } from "@/i18n/config";

interface RecommendationGridProps {
  items: RecommendationPayload[];
  isLoading?: boolean;
  locale: Locale;
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function RecommendationGrid({ items, isLoading = false, locale, emptyMessage, title, description }: RecommendationGridProps) {
  // Don't show loading placeholders - just show results or empty state
  if (isLoading) {
    return null; // Don't show anything while loading, let the header message handle it
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {emptyMessage ?? "Adjust filters or try a different title to see recommendations."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(title || description) && (
        <header className="space-y-1">
          {title && <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>}
          {description && <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>}
        </header>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <RecommendationCard key={item.id} item={item} locale={locale} />
        ))}
      </div>
    </div>
  );
}

