"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChartCard,
  HmsBarChart,
  HmsDonutChart,
  HmsLineChart,
  HmsRadialGauge,
  SparkKpiCard,
  paletteAt,
  tonedColor,
} from "@/components/charts";
import { apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";

function monthRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

type OccupancyRow = {
  date?: string;
  totalRooms?: number;
  occupiedRooms?: number;
  occupancyRate?: number;
  adr?: number | string;
  revpar?: number | string;
};

type OccupancyReport = {
  reportType: string;
  summary: Record<string, unknown>;
  data: OccupancyRow[];
};

type GuestAnalyticsReport = {
  reportType: string;
  filters: Record<string, unknown>;
  summary: Record<string, unknown>;
  insights: Record<string, unknown>[];
  segments: Record<string, unknown>[];
};

type NightAuditRun = {
  run_date: string;
  rooms_audited: number;
  charges_posted: number;
  total_amount: number;
  status: string;
  errors?: string | null;
  run_at: string;
  run_by: string;
};

type ExecutiveCard = {
  key: string;
  title: string;
  valueDisplay: string;
  subtext: string;
  tone: string;
  value?: number;
};

type Executive = {
  timestamp: string;
  todaysOperations: ExecutiveCard[];
  revenueCards: ExecutiveCard[];
  operationsAlerts: ExecutiveCard[];
};

type ComplaintsMetrics = {
  period_start: string;
  average_resolution_hours: number | null;
  by_type: Array<{ type: string; count: number }>;
  by_staff: Array<{ staff_user_id: string; staff_username: string; count: number }>;
  total_in_range: number;
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function summaryNumber(summary: Record<string, unknown> | undefined, key: string): number {
  if (!summary) return 0;
  return toNumber(summary[key]);
}

function summaryText(summary: Record<string, unknown> | undefined, key: string, fallback = "—"): string {
  if (!summary) return fallback;
  const v = summary[key];
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export default function HotelReportsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<"executive" | "occupancy" | "guests" | "complaints" | "audit">("executive");
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [executive, setExecutive] = useState<Executive | null>(null);
  const [guestAnalytics, setGuestAnalytics] = useState<GuestAnalyticsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [audits, setAudits] = useState<NightAuditRun[]>([]);
  const [auditMsg, setAuditMsg] = useState<string | null>(null);
  const [showAuditConfirm, setShowAuditConfirm] = useState(false);
  const [auditSubmitting, setAuditSubmitting] = useState(false);
  const user = typeof window !== "undefined" ? loadAuthUser() : null;
  const [complaintsMetrics, setComplaintsMetrics] = useState<ComplaintsMetrics | null>(null);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [complaintsErr, setComplaintsErr] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(monthRange().start);
  const [endDate, setEndDate] = useState(monthRange().end);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      setLoading(true);
      try {
        const [ex, o, g, hist] = await Promise.all([
          apiFetch<Executive>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`),
          apiFetch<OccupancyReport>(
            `/api/v1/hotels/${hotelId}/reports/occupancy?startDate=${startDate}&endDate=${endDate}&groupBy=day`,
          ),
          apiFetch<GuestAnalyticsReport>(
            `/api/v1/hotels/${hotelId}/reports/guest-analytics?segment=RETURNING&tier=GOLD&minSpend=500`,
          ),
          apiFetch<NightAuditRun[]>(`/api/v1/hotels/${hotelId}/night-audit/history`),
        ]);
        if (cancelled) return;
        setExecutive(ex);
        setOccupancy(o);
        setGuestAnalytics(g);
        setAudits(hist);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, startDate, endDate]);

  useEffect(() => {
    if (tab !== "complaints") return;
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setComplaintsErr("Not signed in.");
        return;
      }
      setComplaintsLoading(true);
      setComplaintsErr(null);
      try {
        const cm = await apiFetch<ComplaintsMetrics>(
          `/api/v1/hotels/${hotelId}/reports/complaints-metrics?fromDate=${encodeURIComponent(startDate)}`,
        );
        if (!cancelled) setComplaintsMetrics(cm);
      } catch (e) {
        if (!cancelled) {
          setComplaintsErr(e instanceof Error ? e.message : "Failed to load complaint metrics");
          setComplaintsMetrics(null);
        }
      } finally {
        if (!cancelled) setComplaintsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, hotelId, startDate]);

  const occChartData = useMemo(() => {
    const rows = occupancy?.data ?? [];
    return rows.map((r) => ({
      date: shortDate(String(r.date ?? "")),
      Occupancy: toNumber(r.occupancyRate),
      ADR: toNumber(r.adr),
      RevPAR: toNumber(r.revpar),
      Occupied: toNumber(r.occupiedRooms),
      Total: toNumber(r.totalRooms),
    }));
  }, [occupancy]);

  const occupancySeries = useMemo(() => occChartData.map((r) => r.Occupancy), [occChartData]);

  const insightsBars = useMemo(() => {
    if (!guestAnalytics) return [];
    return guestAnalytics.insights.map((row, i) => {
      const numericKey = Object.entries(row).find(
        ([, v]) => typeof v === "number" && Number.isFinite(v as number),
      );
      const label = String(row.type ?? row.name ?? row.label ?? `Insight ${i + 1}`);
      const value = numericKey ? Number(numericKey[1]) : 1;
      return { label, value, color: paletteAt(i) };
    });
  }, [guestAnalytics]);

  const segmentsBars = useMemo(() => {
    if (!guestAnalytics) return [];
    return guestAnalytics.segments.map((row, i) => {
      const label = String(row.name ?? row.segment ?? `Segment ${i + 1}`);
      const value = toNumber(row.count ?? row.value);
      return { label, value, color: paletteAt(i) };
    });
  }, [guestAnalytics]);

  const auditChartData = useMemo(() => {
    return [...audits]
      .sort((a, b) => a.run_date.localeCompare(b.run_date))
      .slice(-30)
      .map((a) => ({
        date: shortDate(a.run_date),
        Charges: a.charges_posted,
        Rooms: a.rooms_audited,
        Total: a.total_amount,
      }));
  }, [audits]);

  const auditStatuses = useMemo(() => {
    if (!audits.length) return [];
    const counts = new Map<string, number>();
    for (const a of audits) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        color:
          name.toUpperCase().includes("OK") || name.toUpperCase().includes("SUCCESS")
            ? "#10b981"
            : name.toUpperCase().includes("FAIL") || name.toUpperCase().includes("ERROR")
              ? "#ef4444"
              : paletteAt(i),
      }));
  }, [audits]);

  async function runNightAuditNow() {
    setAuditMsg(null);
    setAuditSubmitting(true);
    try {
      const run = await apiFetch<NightAuditRun>(`/api/v1/hotels/${hotelId}/night-audit/run`, { method: "POST" });
      setAuditMsg(`Audit complete: ${run.charges_posted} charges posted`);
      const hist = await apiFetch<NightAuditRun[]>(`/api/v1/hotels/${hotelId}/night-audit/history`);
      setAudits(hist);
      setShowAuditConfirm(false);
    } catch (e) {
      setAuditMsg(e instanceof Error ? e.message : "Night audit failed");
    } finally {
      setAuditSubmitting(false);
    }
  }

  async function exportFile(url: string, filename: string) {
    try {
      const token = getToken();
      if (!token) throw new Error("Not signed in.");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      setBanner(`Downloaded ${filename}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const operationsBars = useMemo(() => {
    if (!executive) return [];
    return executive.todaysOperations.map((c) => ({
      label: c.title,
      value: toNumber(c.value),
      color: tonedColor(c.tone),
    }));
  }, [executive]);

  const revenueBars = useMemo(() => {
    if (!executive) return [];
    return executive.revenueCards.map((c) => ({
      label: c.title,
      value: toNumber(c.value),
      color: tonedColor(c.tone),
    }));
  }, [executive]);

  const alertBars = useMemo(() => {
    if (!executive) return [];
    return executive.operationsAlerts.map((c) => ({
      label: c.title,
      value: toNumber(c.value),
      color: tonedColor(c.tone),
    }));
  }, [executive]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="mt-1 text-muted-foreground">
          Executive KPIs, occupancy, guest analytics, complaint analytics, and audit controls — every tab is now visualised
          with charts.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={tab === "executive" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setTab("executive")}
          >
            Executive
          </button>
          <button
            type="button"
            className={tab === "occupancy" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setTab("occupancy")}
          >
            Occupancy
          </button>
          <button
            type="button"
            className={tab === "guests" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setTab("guests")}
          >
            Guest Analytics
          </button>
          <button
            type="button"
            className={tab === "complaints" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setTab("complaints")}
          >
            Complaints
          </button>
          <button
            type="button"
            className={tab === "audit" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setTab("audit")}
          >
            Night Audit
          </button>
        </div>
      </div>

      {loading && <div className="panel">Loading reports...</div>}
      {error && <div className="error panel">{error}</div>}
      {banner && <div className="panel">{banner}</div>}

      {tab === "executive" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(executive?.todaysOperations ?? []).slice(0, 4).map((c) => (
              <SparkKpiCard
                key={c.key}
                title={c.title}
                valueDisplay={c.valueDisplay}
                subtext={c.subtext}
                tone={c.tone}
                series={occupancySeries.length >= 2 ? occupancySeries : undefined}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
              title="Today's operations"
              subtitle="Side-by-side comparison of operational KPIs"
              bodyHeight={260}
              loading={loading && !executive}
              empty={!loading && operationsBars.length === 0}
              className="xl:col-span-2"
            >
              <HmsBarChart data={operationsBars} layout="horizontal" showValues />
            </ChartCard>

            <ChartCard
              title="Operations by tone"
              subtitle="Distribution of KPI alert tones"
              bodyHeight={260}
              loading={loading && !executive}
              empty={!loading && operationsBars.length === 0}
            >
              <HmsDonutChart
                data={(() => {
                  const map = new Map<string, number>();
                  for (const c of executive?.todaysOperations ?? []) {
                    const k = (c.tone || "muted").toLowerCase();
                    map.set(k, (map.get(k) ?? 0) + 1);
                  }
                  return Array.from(map.entries()).map(([name, value]) => ({
                    name,
                    value,
                    color: tonedColor(name),
                  }));
                })()}
                centerLabel={String(executive?.todaysOperations.length ?? 0)}
                centerSub="cards"
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Revenue mix"
              subtitle="Revenue card values, side-by-side"
              bodyHeight={260}
              loading={loading && !executive}
              empty={!loading && revenueBars.length === 0}
            >
              <HmsBarChart
                data={revenueBars}
                layout="horizontal"
                showValues
                formatValue={(n) => `$${Number(n).toLocaleString()}`}
              />
            </ChartCard>
            <ChartCard
              title="Revenue share"
              subtitle="Each card's contribution to total revenue today"
              bodyHeight={260}
              loading={loading && !executive}
              empty={!loading && revenueBars.length === 0}
            >
              <HmsDonutChart
                data={revenueBars.map((b) => ({ name: b.label, value: b.value, color: b.color }))}
                centerLabel={`$${revenueBars.reduce((s, b) => s + b.value, 0).toLocaleString()}`}
                centerSub="total"
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Operations alerts"
            subtitle="Higher bars need attention sooner"
            bodyHeight={220}
            loading={loading && !executive}
            empty={!loading && alertBars.length === 0}
            emptyTitle="No alerts"
            emptyHint="Alerts surface when on-property thresholds (overdue checkout, no-show, etc.) trip."
          >
            <HmsBarChart data={alertBars} layout="horizontal" showValues />
          </ChartCard>
        </div>
      )}

      {tab === "complaints" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <label className="text-sm font-medium text-foreground">Period start (from)</label>
            <input
              type="date"
              className="mt-1 block rounded-md border border-border px-2 py-1.5 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Matches occupancy report start when unchanged. Metrics include complaints opened on or after this date.
            </p>
          </div>

          {complaintsLoading && <div className="panel">Loading complaint metrics…</div>}
          {complaintsErr && <div className="error panel">{complaintsErr}</div>}

          {complaintsMetrics && !complaintsLoading && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <SparkKpiCard
                  title="Cases opened"
                  valueDisplay={String(complaintsMetrics.total_in_range)}
                  subtext={`From ${new Date(complaintsMetrics.period_start).toLocaleDateString()}`}
                  tone="amber"
                />
                <SparkKpiCard
                  title="Avg resolution"
                  valueDisplay={
                    complaintsMetrics.average_resolution_hours != null &&
                    Number.isFinite(complaintsMetrics.average_resolution_hours)
                      ? `${complaintsMetrics.average_resolution_hours.toFixed(1)} h`
                      : "—"
                  }
                  subtext="Resolved cases only"
                  tone="blue"
                />
                <SparkKpiCard
                  title="Active staff"
                  valueDisplay={String(complaintsMetrics.by_staff.length)}
                  subtext="Distinct assignees with cases"
                  tone="violet"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                <ChartCard
                  title="Complaints by type"
                  subtitle="Share of complaint categories in the period"
                  bodyHeight={280}
                  empty={complaintsMetrics.by_type.length === 0}
                  emptyTitle="No complaints in range"
                  emptyHint="Charts will populate once cases are logged."
                >
                  <HmsDonutChart
                    data={complaintsMetrics.by_type.map((r, i) => ({
                      name: r.type,
                      value: r.count,
                      color: paletteAt(i),
                    }))}
                    centerLabel={String(complaintsMetrics.total_in_range)}
                    centerSub="cases"
                  />
                </ChartCard>

                <ChartCard
                  title="Cases by assigned staff"
                  subtitle="Workload across the team"
                  bodyHeight={280}
                  empty={complaintsMetrics.by_staff.length === 0}
                  emptyTitle="No assignments in range"
                  emptyHint="Once cases are routed to staff members, their workload appears here."
                  className="xl:col-span-2"
                >
                  <HmsBarChart
                    data={complaintsMetrics.by_staff.map((r, i) => ({
                      label: r.staff_username,
                      value: r.count,
                      color: paletteAt(i),
                    }))}
                    layout="horizontal"
                    showValues
                  />
                </ChartCard>
              </div>

              <ChartCard
                title="Average resolution time"
                subtitle="Lower is better — target ≤ 24 h"
                bodyHeight={220}
                empty={
                  complaintsMetrics.average_resolution_hours == null ||
                  !Number.isFinite(complaintsMetrics.average_resolution_hours)
                }
                emptyTitle="Awaiting resolved cases"
              >
                <HmsRadialGauge
                  value={complaintsMetrics.average_resolution_hours ?? 0}
                  max={Math.max(48, (complaintsMetrics.average_resolution_hours ?? 0) * 1.25)}
                  label="Resolution"
                  caption="Avg hours to resolve"
                  color={(complaintsMetrics.average_resolution_hours ?? 0) > 24 ? "#ef4444" : "#10b981"}
                  formatValue={(n) => `${n.toFixed(1)} h`}
                />
              </ChartCard>
            </>
          )}
        </div>
      )}

      {tab === "occupancy" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label>Start</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label>End</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="hms-btn-outline w-full"
                  onClick={() =>
                    void exportFile(
                      `/api/v1/hotels/${hotelId}/reports/occupancy/export?startDate=${startDate}&endDate=${endDate}&groupBy=day&format=csv`,
                      "occupancy-report.csv",
                    )
                  }
                >
                  Export CSV
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="hms-btn-outline w-full"
                  onClick={() =>
                    void exportFile(
                      `/api/v1/hotels/${hotelId}/reports/occupancy/export?startDate=${startDate}&endDate=${endDate}&groupBy=day&format=pdf`,
                      "occupancy-report.pdf",
                    )
                  }
                >
                  Export PDF
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SparkKpiCard
              title="Avg occupancy"
              valueDisplay={`${summaryNumber(occupancy?.summary, "averageOccupancy").toFixed(1)}%`}
              subtext="Across the selected window"
              tone="blue"
              series={occupancySeries}
            />
            <SparkKpiCard
              title="Peak occupancy"
              valueDisplay={`${summaryNumber(occupancy?.summary, "peakOccupancy").toFixed(1)}%`}
              subtext={`On ${summaryText(occupancy?.summary, "peakDate")}`}
              tone="green"
              series={occupancySeries}
            />
            <SparkKpiCard
              title="Avg ADR"
              valueDisplay={`$${summaryNumber(occupancy?.summary, "averageADR").toLocaleString()}`}
              subtext="Average daily rate"
              tone="amber"
              series={occChartData.map((r) => r.ADR)}
            />
            <SparkKpiCard
              title="Avg RevPAR"
              valueDisplay={`$${summaryNumber(occupancy?.summary, "averageRevPAR").toLocaleString()}`}
              subtext="Revenue per available room"
              tone="violet"
              series={occChartData.map((r) => r.RevPAR)}
            />
          </div>

          <ChartCard
            title="Occupancy %, ADR and RevPAR over time"
            subtitle={`Daily series · ${startDate} → ${endDate}`}
            bodyHeight={320}
            loading={loading && !occupancy}
            empty={!loading && occChartData.length === 0}
            emptyTitle="No occupancy data in range"
          >
            <HmsLineChart
              data={occChartData}
              xKey="date"
              rightAxis
              leftAxisLabel="%"
              rightAxisLabel="$"
              series={[
                {
                  key: "Occupancy",
                  label: "Occupancy %",
                  type: "area",
                  color: "#0ea5e9",
                  format: (n) => `${n.toFixed(1)}%`,
                },
                {
                  key: "ADR",
                  label: "ADR",
                  type: "line",
                  color: "#3b82f6",
                  yAxisId: "right",
                  format: (n) => `$${n.toLocaleString()}`,
                },
                {
                  key: "RevPAR",
                  label: "RevPAR",
                  type: "line",
                  color: "#10b981",
                  yAxisId: "right",
                  format: (n) => `$${n.toLocaleString()}`,
                },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="Daily occupied vs total rooms"
            subtitle="How much capacity is being absorbed each day"
            bodyHeight={280}
            loading={loading && !occupancy}
            empty={!loading && occChartData.length === 0}
          >
            <HmsLineChart
              data={occChartData}
              xKey="date"
              series={[
                { key: "Occupied", label: "Occupied", type: "bar", color: "#0ea5e9" },
                { key: "Total", label: "Total", type: "line", color: "#6b7280" },
              ]}
            />
          </ChartCard>
        </div>
      )}

      {tab === "guests" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="hms-btn-outline text-sm"
                onClick={() =>
                  void exportFile(
                    `/api/v1/hotels/${hotelId}/reports/guest-analytics/export?segment=RETURNING&tier=GOLD&minSpend=500&format=csv`,
                    "guest-analytics-report.csv",
                  )
                }
              >
                Export CSV
              </button>
              <button
                type="button"
                className="hms-btn-outline text-sm"
                onClick={() =>
                  void exportFile(
                    `/api/v1/hotels/${hotelId}/reports/guest-analytics/export?segment=RETURNING&tier=GOLD&minSpend=500&format=pdf`,
                    "guest-analytics-report.pdf",
                  )
                }
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SparkKpiCard
              title="Total guests"
              valueDisplay={String(summaryNumber(guestAnalytics?.summary, "totalGuests"))}
              subtext="Matching the active filters"
              tone="blue"
            />
            <SparkKpiCard
              title="Avg lifetime value"
              valueDisplay={`$${summaryNumber(guestAnalytics?.summary, "averageLifetimeValue").toLocaleString()}`}
              subtext="Per guest in cohort"
              tone="green"
            />
            <SparkKpiCard
              title="Avg stays / guest"
              valueDisplay={summaryNumber(guestAnalytics?.summary, "averageStaysPerGuest").toFixed(1)}
              subtext="Reservation count divided by guests"
              tone="violet"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Segments"
              subtitle="Sizes of guest cohorts"
              bodyHeight={280}
              loading={loading && !guestAnalytics}
              empty={!loading && segmentsBars.length === 0}
              emptyTitle="No segments yet"
              emptyHint="Adjust filters to surface guest cohorts."
            >
              <HmsBarChart data={segmentsBars} layout="horizontal" showValues />
            </ChartCard>

            <ChartCard
              title="Insights"
              subtitle="Detected patterns from the analytics service"
              bodyHeight={280}
              loading={loading && !guestAnalytics}
              empty={!loading && insightsBars.length === 0}
              emptyTitle="No insights"
              emptyHint="Insights surface once enough guest history accumulates."
            >
              <HmsBarChart data={insightsBars} layout="horizontal" showValues />
            </ChartCard>
          </div>

          {(guestAnalytics?.insights.length ?? 0) > 0 && (
            <section className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h3 className="mb-2 font-semibold">Insight notes</h3>
              <ul className="space-y-2">
                {guestAnalytics!.insights.map((row, i) => (
                  <li key={i} className="rounded-lg border border-border/40 bg-muted/30 p-3 text-sm">
                    {Object.entries(row).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
                        <span className="text-foreground">{String(v)}</span>
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="space-y-4">
          {(user?.role === "FINANCE" || user?.role === "MANAGER" || user?.role === "HOTEL_ADMIN") && (
            <div>
              <button type="button" className="hms-btn-solid" onClick={() => setShowAuditConfirm(true)}>
                Run Night Audit
              </button>
            </div>
          )}
          {auditMsg && <div className="panel">{auditMsg}</div>}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SparkKpiCard
              title="Latest charges posted"
              valueDisplay={String(audits[0]?.charges_posted ?? 0)}
              subtext={audits[0] ? `Run ${audits[0].run_date}` : "No runs yet"}
              tone="green"
              series={auditChartData.map((d) => d.Charges)}
            />
            <SparkKpiCard
              title="Latest total amount"
              valueDisplay={`$${(audits[0]?.total_amount ?? 0).toLocaleString()}`}
              subtext={audits[0]?.status ?? "—"}
              tone="blue"
              series={auditChartData.map((d) => d.Total)}
            />
            <SparkKpiCard
              title="Rooms audited"
              valueDisplay={String(audits[0]?.rooms_audited ?? 0)}
              subtext={audits[0]?.run_at ? new Date(audits[0].run_at).toLocaleString() : "—"}
              tone="violet"
              series={auditChartData.map((d) => d.Rooms)}
            />
          </div>

          <ChartCard
            title="Audit run trend"
            subtitle="Charges posted (bars) and total amount (line) per run"
            bodyHeight={300}
            loading={loading && audits.length === 0}
            empty={auditChartData.length === 0}
            emptyTitle="No audit runs yet"
            emptyHint="Once nightly audits run they will populate this chart."
          >
            <HmsLineChart
              data={auditChartData}
              xKey="date"
              rightAxis
              leftAxisLabel="Charges"
              rightAxisLabel="$"
              series={[
                { key: "Charges", label: "Charges posted", type: "bar", color: "#0ea5e9" },
                {
                  key: "Total",
                  label: "Total amount",
                  type: "line",
                  color: "#3b82f6",
                  yAxisId: "right",
                  format: (n) => `$${n.toLocaleString()}`,
                },
              ]}
            />
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Run statuses"
              subtitle="Distribution of audit run outcomes"
              bodyHeight={260}
              empty={auditStatuses.length === 0}
            >
              <HmsDonutChart
                data={auditStatuses}
                centerLabel={String(audits.length)}
                centerSub="runs"
              />
            </ChartCard>

            <ChartCard
              title="Recent runs"
              subtitle="Latest audit history"
              bodyHeight={260}
              empty={audits.length === 0}
            >
              <div className="absolute inset-0 overflow-auto">
                <table className="hms-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Rooms</th>
                      <th>Charges</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.slice(0, 8).map((a) => (
                      <tr key={`${a.run_date}-${a.run_at}`}>
                        <td>{a.run_date}</td>
                        <td>{a.rooms_audited}</td>
                        <td>{a.charges_posted}</td>
                        <td>${a.total_amount.toLocaleString()}</td>
                        <td>{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          </div>
        </div>
      )}

      {showAuditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Run Night Audit?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will post nightly room charges for checked-in stays.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="hms-btn-outline"
                onClick={() => setShowAuditConfirm(false)}
                disabled={auditSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid"
                onClick={() => void runNightAuditNow()}
                disabled={auditSubmitting}
              >
                {auditSubmitting ? "Running..." : "Confirm run"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
