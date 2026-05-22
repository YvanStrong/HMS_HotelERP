"use client";

import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { tonedColor } from "./chartTheme";

export type SparkKpiTone = "green" | "amber" | "red" | "blue" | "violet" | "muted";

type Props = {
  title: string;
  /** Display string (already formatted). */
  valueDisplay: string;
  subtext?: string | null;
  tone?: SparkKpiTone | string | null;
  /** Optional series of recent values used for the sparkline. */
  series?: number[];
  /** Optional second series (e.g. paired comparison). */
  compareSeries?: number[];
  /** Optional anchor when the card is also a link. */
  href?: string | null;
  className?: string;
};

/**
 * Compact KPI card with a sparkline behind the headline value.
 * Falls back gracefully when no series is provided (no chart, just the value).
 */
export function SparkKpiCard({
  title,
  valueDisplay,
  subtext,
  tone,
  series,
  compareSeries,
  href,
  className = "",
}: Props) {
  const accent = tonedColor(typeof tone === "string" ? tone : null);
  const data = (series ?? []).map((v, i) => ({
    i,
    v,
    c: compareSeries?.[i] ?? null,
  }));
  const hasChart = data.length >= 2;
  const gradientId = `spark-grad-${title.replace(/\W+/g, "-")}-${accent.replace(/[^0-9a-z]/gi, "")}`;
  const max = hasChart ? Math.max(...data.map((d) => d.v)) : 0;
  const min = hasChart ? Math.min(...data.map((d) => d.v)) : 0;
  const trend = hasChart ? data[data.length - 1].v - data[0].v : 0;

  const body = (
    <div
      className={`relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-soft transition-all hover:shadow-float ${className}`}
    >
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-end gap-2">
        <p className="text-2xl font-bold text-foreground">{valueDisplay}</p>
        {hasChart && (
          <span
            className="mb-1 text-xs font-semibold"
            style={{ color: trend >= 0 ? "#10b981" : "#ef4444" }}
            title={`Range: ${min.toLocaleString()} – ${max.toLocaleString()}`}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toLocaleString()}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>}
      {hasChart && (
        <div className="-mx-4 -mb-4 mt-2 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: accent, strokeOpacity: 0.4 }}
                contentStyle={{
                  fontSize: 11,
                  borderRadius: 6,
                  border: "1px solid rgba(20,83,45,0.12)",
                  background: "#fff",
                }}
                labelFormatter={() => ""}
                formatter={(value) => [Number(value).toLocaleString(), title]}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={accent}
                strokeWidth={1.6}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {body}
      </Link>
    );
  }
  return body;
}
