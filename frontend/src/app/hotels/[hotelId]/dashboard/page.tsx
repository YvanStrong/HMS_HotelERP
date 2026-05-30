"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ChartCard,
  HmsBarChart,
  HmsDonutChart,
  HmsLineChart,
  HmsRadialGauge,
  RealtimeKpiCharts,
  SparkKpiCard,
  paletteAt,
  tonedColor,
} from "@/components/charts";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type KpiCard = {
  key: string;
  title: string;
  value: number;
  valueDisplay: string;
  tone: "green" | "amber" | "red" | "blue" | "violet";
  subtext: string;
  actionPath?: string | null;
};
type ArrivalRow = {
  reservationId: string;
  bookingReference: string;
  guestName: string;
  roomNumber: string;
  checkInTime?: string | null;
  status: string;
};
type DepartureRow = {
  reservationId: string;
  bookingReference: string;
  guestName: string;
  roomNumber: string;
  balanceDue: number;
  status: string;
};
type ActivityRow = {
  timestamp: string;
  staffName: string;
  action: string;
  reference: string;
};
type ExecutiveDashboard = {
  timestamp: string;
  hotelId: string;
  todaysOperations: KpiCard[];
  revenueCards: KpiCard[];
  operationsAlerts: KpiCard[];
  todaysArrivals: ArrivalRow[];
  todaysDepartures: DepartureRow[];
  recentActivity: ActivityRow[];
};

type SalesAnalytics = {
  fromDate: string;
  toDate: string;
  inventoryInvoiceSales: number;
  posSales: number;
  totalSales: number;
  totalExpenses: number;
  netAfterExpenses: number;
  pendingPettyCashCount: number;
};

type RoomDashboard = {
  hotelId: string;
  bucketCounts: Record<string, number>;
  totalRooms: number;
  generatedAt: string;
  staleDndRooms?: { roomId: string; roomNumber: string; dndSetAt: string }[];
};

type OccupancyGrid = {
  hotelId: string;
  days: { date: string; occupiedRooms: number; totalRooms: number }[];
};

type RealtimeDashboard = {
  timestamp?: string;
  hotelId?: string;
  liveMetrics?: Record<string, unknown>;
  alerts?: unknown[];
  quickActions?: unknown[];
};

function defaultDateRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

const STATUS_COLORS: Record<string, string> = {
  OCCUPIED: "#0ea5e9",
  VACANT_CLEAN: "#10b981",
  VACANT_DIRTY: "#f59e0b",
  CLEAN: "#10b981",
  DIRTY: "#f59e0b",
  OUT_OF_ORDER: "#ef4444",
  OUT_OF_SERVICE: "#ef4444",
  DND: "#8b5cf6",
  BLOCKED: "#6b7280",
  INSPECTED: "#3b82f6",
  RESERVED: "#0ea5e9",
};

function statusColor(name: string, fallbackIndex: number): string {
  return STATUS_COLORS[name.toUpperCase()] ?? paletteAt(fallbackIndex);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatClock(now: Date | null): { time: string; date: string } {
  if (!now) return { time: "--:--:--", date: "Loading time..." };
  return {
    time: now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    date: now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
  };
}

function timeBucketArrivals(arrivals: ArrivalRow[]): { label: string; value: number }[] {
  const buckets = ["Early (<12)", "Afternoon (12–17)", "Evening (17–21)", "Late (21+)", "Unknown"];
  const counts = [0, 0, 0, 0, 0];
  for (const a of arrivals) {
    if (!a.checkInTime) {
      counts[4] += 1;
      continue;
    }
    const d = new Date(a.checkInTime);
    if (Number.isNaN(d.getTime())) {
      counts[4] += 1;
      continue;
    }
    const h = d.getHours();
    if (h < 12) counts[0] += 1;
    else if (h < 17) counts[1] += 1;
    else if (h < 21) counts[2] += 1;
    else counts[3] += 1;
  }
  return buckets.map((label, i) => ({ label, value: counts[i] }));
}

export default function HotelDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [dash, setDash] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState<Date | null>(null);

  const [board, setBoard] = useState<RoomDashboard | null>(null);
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [kpi, setKpi] = useState<RealtimeDashboard | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const range = useMemo(() => defaultDateRange(), []);
  const clock = formatClock(clockNow);

  useEffect(() => {
    setClockNow(new Date());
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadExecutive = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await apiFetch<ExecutiveDashboard>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`);
      setDash(res);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void loadExecutive();
    const t = setInterval(() => {
      void loadExecutive();
    }, 60_000);
    return () => clearInterval(t);
  }, [loadExecutive]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRoomError(null);
      if (!getToken()) {
        setBoardLoading(false);
        setGridLoading(false);
        setKpiLoading(false);
        return;
      }
      try {
        const d = await apiFetch<RoomDashboard>(`/api/v1/hotels/${hotelId}/rooms/dashboard`);
        if (!cancelled) setBoard(d);
      } catch (e) {
        if (!cancelled) setRoomError(e instanceof Error ? e.message : "Room dashboard failed");
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
      try {
        const g = await apiFetch<OccupancyGrid>(
          `/api/v1/hotels/${hotelId}/rooms/occupancy-grid?from=${range.from}&to=${range.to}`,
        );
        if (!cancelled) setGrid(g);
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setGridLoading(false);
      }
      try {
        const k = await apiFetch<RealtimeDashboard>(`/api/v1/hotels/${hotelId}/reports/realtime-dashboard`);
        if (!cancelled) setKpi(k);
      } catch {
        /* optional */
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
      try {
        const now = new Date();
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const to = now.toISOString().slice(0, 10);
        const a = await apiFetch<SalesAnalytics>(
          `/api/v1/hotels/${hotelId}/accounting/sales-analytics?from=${from}&to=${to}`,
          { quiet: true },
        );
        if (!cancelled) setSalesAnalytics(a);
      } catch {
        /* manager/finance only */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, range.from, range.to]);

  const hasData = useMemo(
    () => Boolean(dash && (dash.todaysOperations.length + dash.revenueCards.length + dash.operationsAlerts.length > 0)),
    [dash],
  );

  const todaysOperationsBars = useMemo(() => {
    if (!dash) return [];
    return dash.todaysOperations.map((c) => ({
      label: c.title,
      value: Number(c.value) || 0,
      color: tonedColor(c.tone),
    }));
  }, [dash]);

  const revenueBars = useMemo(() => {
    if (!dash) return [];
    return dash.revenueCards.map((c) => ({
      label: c.title,
      value: Number(c.value) || 0,
      color: tonedColor(c.tone),
    }));
  }, [dash]);

  const accountingSalesBars = useMemo(() => {
    if (!salesAnalytics) return [];
    return [
      { label: "POS", value: Number(salesAnalytics.posSales) || 0, color: "#0ea5e9" },
      { label: "Invoices", value: Number(salesAnalytics.inventoryInvoiceSales) || 0, color: "#0ea5e9" },
      { label: "Expenses", value: Number(salesAnalytics.totalExpenses) || 0, color: "#f59e0b" },
    ];
  }, [salesAnalytics]);

  const alertsBars = useMemo(() => {
    if (!dash) return [];
    return dash.operationsAlerts.map((c) => ({
      label: c.title,
      value: Number(c.value) || 0,
      color: tonedColor(c.tone),
    }));
  }, [dash]);

  const occupancyChartData = useMemo(() => {
    if (!grid) return [];
    return grid.days.map((row) => ({
      date: shortDate(row.date),
      Occupied: row.occupiedRooms,
      Available: Math.max(0, row.totalRooms - row.occupiedRooms),
      Occupancy: row.totalRooms > 0 ? Math.round((row.occupiedRooms / row.totalRooms) * 100) : 0,
    }));
  }, [grid]);

  const occupancySparkSeries = useMemo(() => {
    if (!grid) return undefined;
    return grid.days.map((d) => (d.totalRooms > 0 ? Math.round((d.occupiedRooms / d.totalRooms) * 100) : 0));
  }, [grid]);

  const occupiedSparkSeries = useMemo(() => {
    if (!grid) return undefined;
    return grid.days.map((d) => d.occupiedRooms);
  }, [grid]);

  const averageOccupancyPct = useMemo(() => {
    if (!grid || grid.days.length === 0) return 0;
    const totals = grid.days.reduce(
      (acc, d) => ({ occ: acc.occ + d.occupiedRooms, tot: acc.tot + d.totalRooms }),
      { occ: 0, tot: 0 },
    );
    return totals.tot > 0 ? (totals.occ / totals.tot) * 100 : 0;
  }, [grid]);

  const buckets = useMemo(() => {
    if (!board?.bucketCounts) return [];
    return Object.entries(board.bucketCounts)
      .filter(([, v]) => Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: statusColor(name, i) }));
  }, [board]);

  const arrivalsTimeline = useMemo(() => {
    if (!dash) return [];
    return timeBucketArrivals(dash.todaysArrivals);
  }, [dash]);

  const departuresBalanceData = useMemo(() => {
    if (!dash) return [];
    const sorted = [...dash.todaysDepartures]
      .filter((d) => Number.isFinite(d.balanceDue))
      .sort((a, b) => b.balanceDue - a.balanceDue)
      .slice(0, 8);
    return sorted.map((r, i) => ({
      label: `Rm ${r.roomNumber || "?"} · ${r.guestName.split(" ")[0] || ""}`,
      value: Number(r.balanceDue) || 0,
      color: paletteAt(i),
    }));
  }, [dash]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hotel Executive Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              Live operations, revenue, and alerts at a glance — visualised with charts so trends are easy to spot.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2 text-right shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current time</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{clock.time}</p>
              <p className="text-xs text-muted-foreground">{clock.date}</p>
            </div>
            <Link href={staffAppPath("rooms")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
              Rooms List
            </Link>
            <Link href={staffAppPath("room-blocks")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
              Blocks
            </Link>
            <Link href={staffAppPath("reservations", "new")} className="hms-btn-solid text-sm">
              New reservation
            </Link>
          </div>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated ?? "—"}</div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button type="button" className="hms-btn-outline text-sm mt-2" onClick={() => void loadExecutive()}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-2 h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="font-medium">No dashboard data yet</p>
          <p className="text-sm text-muted-foreground">
            Create reservations and operations activity to populate executive KPIs.
          </p>
          <Link href={staffAppPath("reservations/new")} className="hms-btn-solid mt-3 inline-block text-sm">
            Create first reservation
          </Link>
        </div>
      )}

      {!loading && dash && (
        <>
          <section>
            <h2 className="mb-2 text-lg font-semibold">Today&apos;s Operations</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {dash.todaysOperations.map((c, idx) => (
                <SparkKpiCard
                  key={c.key}
                  title={c.title}
                  valueDisplay={c.valueDisplay}
                  subtext={c.subtext}
                  tone={c.tone}
                  href={c.actionPath ?? null}
                  series={
                    /occupan/i.test(c.key) || /occupan/i.test(c.title)
                      ? occupancySparkSeries
                      : /arriv/i.test(c.title) || /depart/i.test(c.title) || /in.?house/i.test(c.title)
                        ? occupiedSparkSeries
                        : occupiedSparkSeries?.map((v) => Math.max(0, v + ((idx % 3) - 1)))
                  }
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <ChartCard
                title="Operations totals"
                subtitle="Side-by-side comparison of today's operational KPIs"
                bodyHeight={260}
                empty={todaysOperationsBars.length === 0}
                className="xl:col-span-2"
              >
                <HmsBarChart data={todaysOperationsBars} layout="horizontal" showValues />
              </ChartCard>
              <ChartCard
                title="Average occupancy"
                subtitle={`Next ${grid?.days.length ?? 0} days · rolling`}
                bodyHeight={260}
                loading={gridLoading}
                empty={!gridLoading && (!grid || grid.days.length === 0)}
                emptyTitle="No upcoming occupancy"
                emptyHint="Add reservations to see the rolling occupancy gauge."
              >
                <HmsRadialGauge
                  value={averageOccupancyPct}
                  label="Occupancy"
                  caption={`Mean across ${grid?.days.length ?? 0} day(s)`}
                />
              </ChartCard>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Revenue</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {dash.revenueCards.map((c) => (
                <SparkKpiCard
                  key={c.key}
                  title={c.title}
                  valueDisplay={c.valueDisplay}
                  subtext={c.subtext}
                  tone={c.tone}
                  href={c.actionPath ?? null}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard
                title="Revenue mix"
                subtitle="Side-by-side comparison of revenue cards"
                bodyHeight={260}
                empty={revenueBars.length === 0}
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
                subtitle="Share of each revenue stream"
                bodyHeight={260}
                empty={revenueBars.length === 0}
              >
                <HmsDonutChart
                  data={revenueBars.map((b) => ({ name: b.label, value: b.value, color: b.color }))}
                  centerLabel={`$${revenueBars.reduce((s, b) => s + b.value, 0).toLocaleString()}`}
                  centerSub="total"
                />
              </ChartCard>
            </div>
          </section>

          {salesAnalytics ? (
            <section>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Sales analytics</h2>
                  <p className="text-sm text-muted-foreground">
                    Month-to-date POS and invoice sales against recorded expenses.
                  </p>
                </div>
                <Link href={staffAppPath("accounting")} className="hms-btn-outline hms-btn-sm">
                  Open Accounting
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <SparkKpiCard
                  title="Total sales"
                  valueDisplay={`$${Number(salesAnalytics.totalSales).toLocaleString()}`}
                  subtext={`${salesAnalytics.fromDate} → ${salesAnalytics.toDate}`}
                  tone="green"
                  href={staffAppPath("accounting")}
                />
                <SparkKpiCard
                  title="POS sales"
                  valueDisplay={`$${Number(salesAnalytics.posSales).toLocaleString()}`}
                  subtext="Menu / outlet sales"
                  tone="blue"
                  href={staffAppPath("pos")}
                />
                <SparkKpiCard
                  title="Expenses"
                  valueDisplay={`$${Number(salesAnalytics.totalExpenses).toLocaleString()}`}
                  subtext="Recorded expenses"
                  tone="amber"
                  href={staffAppPath("accounting")}
                />
                <SparkKpiCard
                  title="Net after expenses"
                  valueDisplay={`$${Number(salesAnalytics.netAfterExpenses).toLocaleString()}`}
                  subtext={`${salesAnalytics.pendingPettyCashCount} petty cash pending`}
                  tone={salesAnalytics.netAfterExpenses >= 0 ? "green" : "red"}
                  href={staffAppPath("accounting")}
                />
              </div>
              <ChartCard
                title="Sales vs expenses"
                subtitle="POS, inventory invoices, and expenses"
                bodyHeight={240}
                empty={accountingSalesBars.length === 0}
                className="mt-4"
              >
                <HmsBarChart
                  data={accountingSalesBars}
                  layout="horizontal"
                  showValues
                  formatValue={(n) => `$${Number(n).toLocaleString()}`}
                />
              </ChartCard>
            </section>
          ) : null}

          <section>
            <h2 className="mb-2 text-lg font-semibold">Operations Alerts</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {dash.operationsAlerts.map((c) => (
                <SparkKpiCard
                  key={c.key}
                  title={c.title}
                  valueDisplay={c.valueDisplay}
                  subtext={c.subtext}
                  tone={c.tone}
                  href={c.actionPath ?? null}
                />
              ))}
            </div>
            {alertsBars.length > 0 && (
              <ChartCard
                title="Alerts by category"
                subtitle="Higher bars need attention sooner"
                bodyHeight={220}
                className="mt-4"
              >
                <HmsBarChart data={alertsBars} layout="horizontal" showValues />
              </ChartCard>
            )}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Today's arrivals by check-in window"
              subtitle={`${dash.todaysArrivals.length} arrival(s) scheduled`}
              bodyHeight={240}
              empty={dash.todaysArrivals.length === 0}
              emptyTitle="No arrivals today"
              emptyHint="Newly created reservations will appear here once their date matches today."
              action={
                <Link href={staffAppPath("reservations?filter=arrivals_today")} className="text-sm text-primary">
                  See all
                </Link>
              }
            >
              <HmsBarChart data={arrivalsTimeline} showValues />
            </ChartCard>

            <ChartCard
              title="Departures by balance due"
              subtitle="Top outstanding balances on departures today"
              bodyHeight={240}
              empty={departuresBalanceData.length === 0}
              emptyTitle="No outstanding balances"
              emptyHint="Departing folios with no balance due will not appear here."
              action={
                <Link href={staffAppPath("reservations?filter=departures_today")} className="text-sm text-primary">
                  See all
                </Link>
              }
            >
              <HmsBarChart
                data={departuresBalanceData}
                layout="horizontal"
                showValues
                formatValue={(n) => `$${Number(n).toLocaleString()}`}
              />
            </ChartCard>
          </section>

          {dash.recentActivity.length > 0 && (
            <section className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h3 className="mb-2 font-semibold">Recent Activity</h3>
              <div className="hms-table-wrap">
                <table className="hms-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Staff</th>
                      <th>Action</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.recentActivity.map((a, idx) => (
                      <tr key={`${a.reference}-${idx}`}>
                        <td>{new Date(a.timestamp).toLocaleString()}</td>
                        <td>{a.staffName}</td>
                        <td>{a.action}</td>
                        <td>{a.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Rooms and occupancy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Room counts by status, day-by-day occupancy, and live KPIs for the selected hotel.
        </p>
      </div>

      {roomError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{roomError}</div>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Room status board"
          subtitle={board ? `Total ${board.totalRooms} room(s)` : "Live operational status"}
          bodyHeight={300}
          loading={boardLoading}
          empty={!boardLoading && buckets.length === 0}
          emptyTitle="No room status yet"
          emptyHint="Once rooms are created, their housekeeping/operational state will appear here."
        >
          <HmsDonutChart
            data={buckets}
            centerLabel={String(board?.totalRooms ?? 0)}
            centerSub="rooms"
          />
        </ChartCard>

        <ChartCard
          title={`Occupancy outlook (${range.from} → ${range.to})`}
          subtitle="Stacked daily room mix with occupancy % overlay"
          bodyHeight={300}
          loading={gridLoading}
          empty={!gridLoading && occupancyChartData.length === 0}
          emptyTitle="No occupancy data yet"
          emptyHint="Try a wider date range or check once reservations are added."
        >
          <HmsLineChart
            data={occupancyChartData}
            xKey="date"
            rightAxis
            leftAxisLabel="Rooms"
            rightAxisLabel="%"
            series={[
              { key: "Occupied", label: "Occupied", type: "bar", color: "#0ea5e9" },
              { key: "Available", label: "Available", type: "bar", color: "#d2bab0" },
              {
                key: "Occupancy",
                label: "Occupancy %",
                type: "line",
                color: "#3b82f6",
                yAxisId: "right",
                format: (n) => `${n}%`,
              },
            ]}
          />
        </ChartCard>
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-4 shadow-soft md:p-5">
        <header className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Realtime KPI</h2>
            {kpi?.timestamp && (
              <p className="text-xs text-muted-foreground">
                Snapshot: {new Date(kpi.timestamp).toLocaleString()}
                {kpi.alerts && kpi.alerts.length > 0 && (
                  <span className="ml-2 font-medium text-amber-600">· {kpi.alerts.length} alert(s)</span>
                )}
              </p>
            )}
          </div>
        </header>
        {kpiLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl bg-muted/40" />
            ))}
          </div>
        ) : (
          <RealtimeKpiCharts liveMetrics={kpi?.liveMetrics as Record<string, unknown> | undefined} />
        )}
      </section>
    </div>
  );
}
