"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type GuestNationalitySlice = {
  nationality: string;
  count: number;
  percent: number;
};

type GuestRepeatBookingsMonth = {
  month: string;
  repeatBookingCount: number;
};

type GuestDashboardDocumentation = {
  averageGuestLifetimeValueMeaning: string;
  revenuePerGuestMeaning: string;
  noShowRateDenominator: string;
  staySelectionCriteria: string;
  repeatBookingTrendWindow: string;
};

type GuestDashboardResponse = {
  reportType: string;
  hotelId: string;
  fromDate: string;
  toDate: string;
  nationalityDistribution: GuestNationalitySlice[];
  repeatGuestCount: number;
  repeatBookingTrendLast12Months: GuestRepeatBookingsMonth[];
  vipGuestCount: number;
  noShowRatePercent: number;
  averageStayNights: number;
  averageGuestLifetimeValue: number;
  averageGuestLifetimeValueNote: string;
  revenuePerGuest: number;
  revenuePerGuestNote: string;
  documentation: GuestDashboardDocumentation;
};

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const PIE_COLORS = [
  "hsl(32 55% 52%)",
  "hsl(200 45% 45%)",
  "hsl(280 40% 48%)",
  "hsl(145 40% 40%)",
  "hsl(25 70% 48%)",
  "hsl(340 50% 50%)",
  "hsl(210 30% 55%)",
  "hsl(50 60% 45%)",
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function piePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y} Z`;
}

export default function GuestAnalyticsDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [fromDate, setFromDate] = useState(defaultDateRange().from);
  const [toDate, setToDate] = useState(defaultDateRange().to);
  const [data, setData] = useState<GuestDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ fromDate, toDate });
      const res = await apiFetch<GuestDashboardResponse>(
        `/api/v1/hotels/${hotelId}/reports/guests?${q.toString()}`,
      );
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load guest analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [hotelId, fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const pieSlices = useMemo(() => {
    if (!data?.nationalityDistribution?.length) return [];
    const total = data.nationalityDistribution.reduce((s, n) => s + n.count, 0);
    if (total <= 0) return [];
    let angle = 0;
    return data.nationalityDistribution.map((n, i) => {
      const sweep = (n.count / total) * 360;
      const slice = { ...n, startAngle: angle, endAngle: angle + sweep, color: PIE_COLORS[i % PIE_COLORS.length] };
      angle += sweep;
      return slice;
    });
  }, [data]);

  const maxTrend = useMemo(() => {
    if (!data?.repeatBookingTrendLast12Months?.length) return 1;
    return Math.max(1, ...data.repeatBookingTrendLast12Months.map((m) => m.repeatBookingCount));
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Guest analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stays with check-in in the selected range.{" "}
            <Link href={staffAppPath("reports")} className="text-primary underline-offset-2 hover:underline">
              All reports
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
            <input
              type="date"
              className="rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
            <input
              type="date"
              className="rounded-md border border-border px-2 py-1.5 text-sm bg-background"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button type="button" className="hms-btn-solid text-sm" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}
      {loading && !data && <div className="panel rounded-xl border border-border/60 bg-card p-6">Loading dashboard…</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">VIP guests</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.vipGuestCount}</p>
              <p className="text-xs text-muted-foreground mt-2">Distinct guests with VIP level ≠ NONE in period.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">No-show rate</p>
              <p className="text-3xl font-bold text-foreground mt-1">{Number(data.noShowRatePercent).toFixed(1)}%</p>
              <div
                className="mt-3 h-2 rounded-full bg-muted overflow-hidden"
                title={data.documentation.noShowRateDenominator}
              >
                <div
                  className="h-full rounded-full bg-amber-600 transition-all"
                  style={{ width: `${Math.min(100, Number(data.noShowRatePercent))}%` }}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg stay (nights)</p>
              <p className="text-3xl font-bold text-foreground mt-1">{Number(data.averageStayNights).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">Non-cancelled stays only.</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Repeat guests</p>
              <p className="text-3xl font-bold text-foreground mt-1">{data.repeatGuestCount}</p>
              <p className="text-xs text-muted-foreground mt-2">Distinct guests with a prior stay at this hotel.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="font-semibold text-foreground mb-1">Nationality distribution</h2>
              <p className="text-xs text-muted-foreground mb-4">Share of stays in range by nationality / country label.</p>
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <svg viewBox="0 0 120 120" className="w-44 h-44 shrink-0">
                  {pieSlices.length === 0 ? (
                    <text x="60" y="64" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      No data
                    </text>
                  ) : (
                    pieSlices.map((s, i) => (
                      <path key={`${s.nationality}-${i}`} d={piePath(60, 60, 52, s.startAngle, s.endAngle)} fill={s.color} stroke="white" strokeWidth="0.5" />
                    ))
                  )}
                </svg>
                <ul className="flex-1 space-y-2 text-sm w-full max-h-56 overflow-y-auto pr-1">
                  {data.nationalityDistribution.map((n, i) => (
                    <li key={n.nationality} className="flex items-center justify-between gap-2 border-b border-border/40 pb-1">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate">{n.nationality}</span>
                      </span>
                      <span className="font-mono text-muted-foreground shrink-0">
                        {n.count} ({Number(n.percent).toFixed(1)}%)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="font-semibold text-foreground mb-1">Repeat booking trend</h2>
              <p className="text-xs text-muted-foreground mb-4">{data.documentation.repeatBookingTrendWindow}</p>
              <div className="flex items-end justify-between gap-1 h-40 px-1 border-b border-border/40">
                {data.repeatBookingTrendLast12Months.map((m) => {
                  const barH = Math.max(10, Math.round((m.repeatBookingCount / maxTrend) * 120));
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full">
                      <div
                        className="w-full max-w-[28px] rounded-t-md bg-primary/80 transition-all"
                        style={{ height: barH }}
                        title={`${m.month}: ${m.repeatBookingCount}`}
                      />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">
                        {m.month.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <h3 className="font-semibold text-foreground">Guest lifetime value (avg)</h3>
              <p className="text-2xl font-bold mt-2">{Number(data.averageGuestLifetimeValue).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">{data.averageGuestLifetimeValueNote}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.documentation.averageGuestLifetimeValueMeaning}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-5 shadow-soft">
              <h3 className="font-semibold text-foreground">Revenue per guest</h3>
              <p className="text-2xl font-bold mt-2">{Number(data.revenuePerGuest).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-2">{data.revenuePerGuestNote}</p>
              <p className="text-xs text-muted-foreground mt-1">{data.documentation.revenuePerGuestMeaning}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Stay selection: </span>
              {data.documentation.staySelectionCriteria}
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">No-show denominator: </span>
              {data.documentation.noShowRateDenominator}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
