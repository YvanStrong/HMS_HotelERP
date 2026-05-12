"use client";

import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
  /** Pass children. If `loading` is true, a shimmer placeholder is rendered instead. */
  loading?: boolean;
  /** Show an empty state when no data is available. */
  empty?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  /** Fixed height for the chart canvas. Defaults to 240px. */
  bodyHeight?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Wraps every chart panel with consistent header, height and loading/empty states.
 * Uses the `hms-section-card` look already used elsewhere on the staff app.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  loading = false,
  empty = false,
  emptyTitle = "No data yet",
  emptyHint = "Charts will appear here once data is available.",
  bodyHeight = 240,
  className = "",
  children,
}: Props) {
  return (
    <section
      className={`rounded-xl border border-border/60 bg-card p-4 md:p-5 shadow-soft ${className}`}
      aria-busy={loading || undefined}
    >
      <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="text-xs text-muted-foreground">{action}</div>}
      </header>
      <div style={{ height: bodyHeight }} className="relative">
        {loading ? (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-muted/40" aria-hidden />
        ) : empty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 text-center">
            <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">{emptyHint}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
