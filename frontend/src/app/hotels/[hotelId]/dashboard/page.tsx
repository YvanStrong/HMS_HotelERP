"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
};

type OccupancyGrid = {
  hotelId: string;
  days: { date: string; occupiedRooms: number; totalRooms: number }[];
};

type RealtimeDashboard = {
  timestamp?: string;
  liveMetrics?: Record<string, unknown>;
  alerts?: unknown[];
};

type GuestSnapshot = {
  repeatGuestCount: number;
  vipGuestCount: number;
  noShowRatePercent: number;
  averageStayNights: number;
  revenuePerGuest: number;
  averageGuestLifetimeValue: number;
};

type AccountingSnapshot = {
  netProfit: number;
  totalIncome: number;
  totalExpenses: number;
  pendingPettyCash: number;
};

function defaultDateRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function monthToDate(): { from: string; to: string } {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function guestRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(amount || 0),
  );
}

const STATUS_COLORS: Record<string, string> = {
  OCCUPIED: "#0ea5e9",
  VACANT_CLEAN: "#10b981",
  VACANT_DIRTY: "#f59e0b",
  CLEAN: "#10b981",
  DIRTY: "#f59e0b",
  OUT_OF_ORDER: "#ef4444",
  DND: "#8b5cf6",
  BLOCKED: "#6b7280",
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

function SectionShell({
  id,
  title,
  subtitle,
  accentClass,
  children,
  links,
}: {
  id: string;
  title: string;
  subtitle: string;
  accentClass: string;
  children: ReactNode;
  links?: { href: string; label: string }[];
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <div className={`rounded-2xl border p-5 shadow-sm ${accentClass}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1 text-sm opacity-90">{subtitle}</p>
          </div>
          {links && links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="hms-btn-outline hms-btn-sm bg-background/80">
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function HotelDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const mtd = useMemo(() => monthToDate(), []);
  const guestDates = useMemo(() => guestRange(), []);
  const range = useMemo(() => defaultDateRange(), []);

  const [dash, setDash] = useState<ExecutiveDashboard | null>(null);
  const [board, setBoard] = useState<RoomDashboard | null>(null);
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [kpi, setKpi] = useState<RealtimeDashboard | null>(null);
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [guestSnapshot, setGuestSnapshot] = useState<GuestSnapshot | null>(null);
  const [accountingSnapshot, setAccountingSnapshot] = useState<AccountingSnapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [clockNow, setClockNow] = useState<Date | null>(null);
  const clock = formatClock(clockNow);

  useEffect(() => {
    setClockNow(new Date());
    const t = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      setBoardLoading(false);
      setGridLoading(false);
      setKpiLoading(false);
      return;
    }
    setError(null);
    setRoomError(null);

    try {
      const res = await apiFetch<ExecutiveDashboard>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`);
      setDash(res);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }

    try {
      setBoard(await apiFetch<RoomDashboard>(`/api/v1/hotels/${hotelId}/rooms/dashboard`));
    } catch (e) {
      setRoomError(e instanceof Error ? e.message : "Room data unavailable");
    } finally {
      setBoardLoading(false);
    }

    try {
      setGrid(
        await apiFetch<OccupancyGrid>(
          `/api/v1/hotels/${hotelId}/rooms/occupancy-grid?from=${range.from}&to=${range.to}`,
        ),
      );
    } catch {
      /* optional */
    } finally {
      setGridLoading(false);
    }

    try {
      setKpi(await apiFetch<RealtimeDashboard>(`/api/v1/hotels/${hotelId}/reports/realtime-dashboard`));
    } catch {
      /* optional */
    } finally {
      setKpiLoading(false);
    }

    try {
      setSalesAnalytics(
        await apiFetch<SalesAnalytics>(
          `/api/v1/hotels/${hotelId}/accounting/sales-analytics?from=${mtd.from}&to=${mtd.to}`,
          { quiet: true },
        ),
      );
    } catch {
      /* finance only */
    }

    try {
      const g = await apiFetch<GuestSnapshot>(
        `/api/v1/hotels/${hotelId}/reports/guests?fromDate=${guestDates.from}&toDate=${guestDates.to}`,
        { quiet: true },
      );
      setGuestSnapshot(g);
    } catch {
      /* optional */
    }

    try {
      const acc = await apiFetch<{
        analytics?: SalesAnalytics;
        pettyCashRequests?: { status: string }[];
        reports?: { profitAndLoss?: { netProfit?: number; totalIncome?: number; totalExpenses?: number } };
      }>(`/api/v1/hotels/${hotelId}/accounting?from=${mtd.from}&to=${mtd.to}`, { quiet: true });
      const pl = acc.reports?.profitAndLoss;
      const pending = (acc.pettyCashRequests ?? []).filter((p) => p.status === "PENDING").length;
      setAccountingSnapshot({
        netProfit: Number(pl?.netProfit ?? acc.analytics?.netAfterExpenses ?? 0),
        totalIncome: Number(pl?.totalIncome ?? acc.analytics?.totalSales ?? 0),
        totalExpenses: Number(pl?.totalExpenses ?? acc.analytics?.totalExpenses ?? 0),
        pendingPettyCash: pending,
      });
    } catch {
      /* finance only */
    }
  }, [guestDates.from, guestDates.to, hotelId, mtd.from, mtd.to, range.from, range.to]);

  useEffect(() => {
    void loadAll();
    const t = setInterval(() => void loadAll(), 60_000);
    return () => clearInterval(t);
  }, [loadAll]);

  const buckets = useMemo(() => {
    if (!board?.bucketCounts) return [];
    return Object.entries(board.bucketCounts)
      .filter(([, v]) => Number.isFinite(v))
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: statusColor(name, i) }));
  }, [board]);

  const occupancyChartData = useMemo(() => {
    if (!grid) return [];
    return grid.days.map((row) => ({
      date: shortDate(row.date),
      Occupied: row.occupiedRooms,
      Available: Math.max(0, row.totalRooms - row.occupiedRooms),
      Occupancy: row.totalRooms > 0 ? Math.round((row.occupiedRooms / row.totalRooms) * 100) : 0,
    }));
  }, [grid]);

  const averageOccupancyPct = useMemo(() => {
    if (!grid || grid.days.length === 0) return 0;
    const totals = grid.days.reduce(
      (acc, d) => ({ occ: acc.occ + d.occupiedRooms, tot: acc.tot + d.totalRooms }),
      { occ: 0, tot: 0 },
    );
    return totals.tot > 0 ? (totals.occ / totals.tot) * 100 : 0;
  }, [grid]);

  const occupancySparkSeries = useMemo(() => {
    if (!grid) return undefined;
    return grid.days.map((d) => (d.totalRooms > 0 ? Math.round((d.occupiedRooms / d.totalRooms) * 100) : 0));
  }, [grid]);

  const revenueBars = useMemo(() => {
    if (!dash) return [];
    return dash.revenueCards.map((c) => ({
      label: c.title,
      value: Number(c.value) || 0,
      color: tonedColor(c.tone),
    }));
  }, [dash]);

  const salesBars = useMemo(() => {
    if (!salesAnalytics) return [];
    return [
      { label: "POS", value: Number(salesAnalytics.posSales) || 0, color: "#0ea5e9" },
      { label: "Invoices", value: Number(salesAnalytics.inventoryInvoiceSales) || 0, color: "#3b82f6" },
      { label: "Expenses", value: Number(salesAnalytics.totalExpenses) || 0, color: "#f59e0b" },
    ];
  }, [salesAnalytics]);

  const arrivalsTimeline = useMemo(() => (dash ? timeBucketArrivals(dash.todaysArrivals) : []), [dash]);

  const alertsBars = useMemo(() => {
    if (!dash) return [];
    return dash.operationsAlerts.map((c) => ({
      label: c.title,
      value: Number(c.value) || 0,
      color: tonedColor(c.tone),
    }));
  }, [dash]);

  const hasExecutive = Boolean(
    dash && dash.todaysOperations.length + dash.revenueCards.length + dash.operationsAlerts.length > 0,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hotel Dashboard</h1>
            <p className="mt-1 text-muted-foreground">
              All-in-one view — rooms & guests, sales, and accounting in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-2 text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Now</p>
              <p className="text-2xl font-bold tabular-nums">{clock.time}</p>
              <p className="text-xs text-muted-foreground">{clock.date}</p>
            </div>
            <Link href="#rooms" className="hms-btn-outline hms-btn-sm">Rooms</Link>
            <Link href="#sales" className="hms-btn-outline hms-btn-sm">Sales</Link>
            <Link href="#accounting" className="hms-btn-outline hms-btn-sm">Accounting</Link>
            <Link href={staffAppPath("reservations/new")} className="hms-btn-solid hms-btn-sm">New reservation</Link>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated ?? "—"}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button type="button" className="hms-btn-outline text-sm mt-2" onClick={() => void loadAll()}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
      )}

      {/* ── ROOMS, RESERVATIONS & GUESTS ── */}
      <SectionShell
        id="rooms"
        title="Rooms, Reservations & Guests"
        subtitle="Live room status, today's arrivals and departures, guest insights, and operational alerts."
        accentClass="border-sky-200/80 bg-sky-50/60 dark:bg-sky-950/20"
        links={[
          { href: staffAppPath("rooms"), label: "Rooms" },
          { href: staffAppPath("reservations"), label: "Reservations" },
          { href: staffAppPath("guests"), label: "Guests" },
          { href: staffAppPath("housekeeping"), label: "Housekeeping" },
        ]}
      >
        {roomError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{roomError}</div>
        )}

        {!loading && dash && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {dash.todaysOperations.map((c) => (
              <SparkKpiCard
                key={c.key}
                title={c.title}
                valueDisplay={c.valueDisplay}
                subtext={c.subtext}
                tone={c.tone}
                href={c.actionPath ?? null}
                series={/occupan/i.test(c.title) ? occupancySparkSeries : undefined}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartCard
            title="Room status board"
            subtitle={board ? `${board.totalRooms} room(s) total` : "Operational status"}
            bodyHeight={280}
            loading={boardLoading}
            empty={!boardLoading && buckets.length === 0}
          >
            <HmsDonutChart data={buckets} centerLabel={String(board?.totalRooms ?? 0)} centerSub="rooms" />
          </ChartCard>

          <ChartCard
            title={`Occupancy outlook (${range.from} → ${range.to})`}
            subtitle="Daily occupied vs available"
            bodyHeight={280}
            loading={gridLoading}
            empty={!gridLoading && occupancyChartData.length === 0}
          >
            <HmsLineChart
              data={occupancyChartData}
              xKey="date"
              rightAxis
              series={[
                { key: "Occupied", label: "Occupied", type: "bar", color: "#0ea5e9" },
                { key: "Available", label: "Available", type: "bar", color: "#d2bab0" },
                { key: "Occupancy", label: "Occupancy %", type: "line", color: "#3b82f6", yAxisId: "right", format: (n) => `${n}%` },
              ]}
            />
          </ChartCard>
        </div>

        {guestSnapshot && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <SparkKpiCard title="Repeat guests" valueDisplay={String(guestSnapshot.repeatGuestCount)} subtext="Last 90 days" tone="blue" href={staffAppPath("guests")} />
            <SparkKpiCard title="VIP guests" valueDisplay={String(guestSnapshot.vipGuestCount)} subtext="Active VIP tier" tone="violet" href={staffAppPath("guests")} />
            <SparkKpiCard title="No-show rate" valueDisplay={`${guestSnapshot.noShowRatePercent.toFixed(1)}%`} subtext="Of scheduled arrivals" tone="amber" />
            <SparkKpiCard title="Avg stay" valueDisplay={`${guestSnapshot.averageStayNights.toFixed(1)} nights`} subtext="Per guest" tone="green" />
            <SparkKpiCard title="Revenue / guest" valueDisplay={formatMoney(guestSnapshot.revenuePerGuest)} subtext="Average" tone="green" />
            <SparkKpiCard title="Guest LTV" valueDisplay={formatMoney(guestSnapshot.averageGuestLifetimeValue)} subtext="Lifetime value" tone="blue" />
          </div>
        )}

        {dash && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Today's arrivals"
              subtitle={`${dash.todaysArrivals.length} scheduled`}
              bodyHeight={220}
              empty={dash.todaysArrivals.length === 0}
              action={<Link href={staffAppPath("reservations?filter=arrivals_today")} className="text-sm text-primary">See all</Link>}
            >
              {dash.todaysArrivals.length > 0 ? (
                <HmsBarChart data={arrivalsTimeline} showValues />
              ) : (
                <p className="text-sm text-muted-foreground">No arrivals today.</p>
              )}
            </ChartCard>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Arrivals list</h3>
                <Link href={staffAppPath("reservations?filter=arrivals_today")} className="text-xs text-primary">All</Link>
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="hms-table text-sm">
                  <thead><tr><th>Guest</th><th>Room</th><th>Ref</th></tr></thead>
                  <tbody>
                    {dash.todaysArrivals.slice(0, 8).map((r) => (
                      <tr key={r.reservationId}>
                        <td>{r.guestName}</td>
                        <td>{r.roomNumber || "—"}</td>
                        <td className="text-muted-foreground">{r.bookingReference}</td>
                      </tr>
                    ))}
                    {dash.todaysArrivals.length === 0 && (
                      <tr><td colSpan={3} className="text-muted-foreground">No arrivals.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {dash && dash.todaysDepartures.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Today's departures</h3>
              <Link href={staffAppPath("reservations?filter=departures_today")} className="text-xs text-primary">All</Link>
            </div>
            <div className="overflow-auto">
              <table className="hms-table text-sm">
                <thead><tr><th>Guest</th><th>Room</th><th>Balance due</th><th>Status</th></tr></thead>
                <tbody>
                  {dash.todaysDepartures.map((r) => (
                    <tr key={r.reservationId}>
                      <td>{r.guestName}</td>
                      <td>{r.roomNumber || "—"}</td>
                      <td className="tabular-nums font-medium">{formatMoney(r.balanceDue)}</td>
                      <td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {dash && dash.operationsAlerts.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {dash.operationsAlerts.map((c) => (
                <SparkKpiCard key={c.key} title={c.title} valueDisplay={c.valueDisplay} subtext={c.subtext} tone={c.tone} href={c.actionPath ?? null} />
              ))}
            </div>
            {alertsBars.length > 0 && (
              <ChartCard title="Operational alerts" subtitle="Items needing attention" bodyHeight={200}>
                <HmsBarChart data={alertsBars} layout="horizontal" showValues />
              </ChartCard>
            )}
          </>
        )}

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">Realtime KPI</h3>
          {kpiLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
          ) : (
            <RealtimeKpiCharts liveMetrics={kpi?.liveMetrics as Record<string, unknown> | undefined} />
          )}
        </div>

        {dash && dash.recentActivity.length > 0 && (
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <h3 className="mb-3 font-semibold">Recent activity</h3>
            <div className="overflow-auto max-h-56">
              <table className="hms-table text-sm">
                <thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Reference</th></tr></thead>
                <tbody>
                  {dash.recentActivity.slice(0, 12).map((a, i) => (
                    <tr key={`${a.timestamp}-${i}`}>
                      <td className="whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</td>
                      <td>{a.staffName}</td>
                      <td>{a.action}</td>
                      <td className="text-muted-foreground">{a.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionShell>

      {/* ── SALES ── */}
      <SectionShell
        id="sales"
        title="Sales"
        subtitle="Revenue streams, POS and invoice sales, month-to-date performance."
        accentClass="border-emerald-200/80 bg-emerald-50/60 dark:bg-emerald-950/20"
        links={[
          { href: staffAppPath("pos"), label: "POS" },
          { href: staffAppPath("invoices"), label: "Invoices" },
          { href: staffAppPath("menu"), label: "Menu" },
          { href: staffAppPath("inventory"), label: "Inventory" },
        ]}
      >
        {!loading && dash && dash.revenueCards.length > 0 && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {dash.revenueCards.map((c) => (
              <SparkKpiCard key={c.key} title={c.title} valueDisplay={c.valueDisplay} subtext={c.subtext} tone={c.tone} href={c.actionPath ?? null} />
            ))}
          </div>
        )}

        {salesAnalytics ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <SparkKpiCard title="Total sales (MTD)" valueDisplay={formatMoney(salesAnalytics.totalSales)} subtext={`${salesAnalytics.fromDate} → ${salesAnalytics.toDate}`} tone="green" href={staffAppPath("invoices")} />
              <SparkKpiCard title="POS sales" valueDisplay={formatMoney(salesAnalytics.posSales)} subtext="Outlets & menu" tone="blue" href={staffAppPath("pos")} />
              <SparkKpiCard title="Invoice sales" valueDisplay={formatMoney(salesAnalytics.inventoryInvoiceSales)} subtext="Inventory invoices" tone="blue" href={staffAppPath("invoices")} />
              <SparkKpiCard title="Net after expenses" valueDisplay={formatMoney(salesAnalytics.netAfterExpenses)} subtext="Sales minus expenses" tone={salesAnalytics.netAfterExpenses >= 0 ? "green" : "red"} href={staffAppPath("accounting")} />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ChartCard title="Sales mix (MTD)" subtitle="POS vs inventory invoices vs expenses" bodyHeight={260} empty={salesBars.length === 0}>
                <HmsBarChart data={salesBars} layout="horizontal" showValues formatValue={(n) => formatMoney(n)} />
              </ChartCard>
              <ChartCard title="Revenue streams" subtitle="Today's revenue KPIs" bodyHeight={260} empty={revenueBars.length === 0}>
                {revenueBars.length > 0 ? (
                  <HmsDonutChart
                    data={revenueBars.map((b) => ({ name: b.label, value: b.value, color: b.color }))}
                    centerLabel={formatMoney(revenueBars.reduce((s, b) => s + b.value, 0))}
                    centerSub="total"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No revenue data yet.</p>
                )}
              </ChartCard>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
            Sales analytics require finance or manager access. Revenue cards above still show when available.
          </p>
        )}

        {!loading && !hasExecutive && !salesAnalytics && (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
            Record POS sales and invoices to populate this section.
          </p>
        )}
      </SectionShell>

      {/* ── ACCOUNTING ── */}
      <SectionShell
        id="accounting"
        title="Accounting"
        subtitle="Month-to-date profit, expenses, petty cash, and financial health."
        accentClass="border-violet-200/80 bg-violet-50/60 dark:bg-violet-950/20"
        links={[{ href: staffAppPath("accounting"), label: "Open Accounting" }]}
      >
        {accountingSnapshot ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <SparkKpiCard title="Total income" valueDisplay={formatMoney(accountingSnapshot.totalIncome)} subtext="MTD recorded income" tone="green" href={staffAppPath("accounting")} />
              <SparkKpiCard title="Total expenses" valueDisplay={formatMoney(accountingSnapshot.totalExpenses)} subtext="MTD recorded expenses" tone="amber" href={staffAppPath("accounting")} />
              <SparkKpiCard title="Net profit" valueDisplay={formatMoney(accountingSnapshot.netProfit)} subtext="Income minus expenses" tone={accountingSnapshot.netProfit >= 0 ? "green" : "red"} href={staffAppPath("accounting")} />
              <SparkKpiCard title="Petty cash pending" valueDisplay={String(accountingSnapshot.pendingPettyCash)} subtext="Awaiting approval" tone="violet" href={staffAppPath("accounting")} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ChartCard title="Income vs expenses" subtitle="Month to date" bodyHeight={240}>
                <HmsBarChart
                  data={[
                    { label: "Income", value: accountingSnapshot.totalIncome, color: "#10b981" },
                    { label: "Expenses", value: accountingSnapshot.totalExpenses, color: "#f59e0b" },
                    { label: "Net", value: accountingSnapshot.netProfit, color: accountingSnapshot.netProfit >= 0 ? "#3b82f6" : "#ef4444" },
                  ]}
                  layout="horizontal"
                  showValues
                  formatValue={(n) => formatMoney(n)}
                />
              </ChartCard>
              <ChartCard title="Financial health" subtitle="Expense ratio vs income" bodyHeight={240}>
                <HmsRadialGauge
                  value={
                    accountingSnapshot.totalIncome > 0
                      ? Math.min(100, (accountingSnapshot.totalExpenses / accountingSnapshot.totalIncome) * 100)
                      : 0
                  }
                  label="Expense ratio"
                  caption={`${formatMoney(accountingSnapshot.totalExpenses)} of ${formatMoney(accountingSnapshot.totalIncome)}`}
                />
              </ChartCard>
            </div>
          </>
        ) : salesAnalytics ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SparkKpiCard title="Total sales" valueDisplay={formatMoney(salesAnalytics.totalSales)} subtext="MTD" tone="green" href={staffAppPath("accounting")} />
            <SparkKpiCard title="Expenses" valueDisplay={formatMoney(salesAnalytics.totalExpenses)} subtext="MTD" tone="amber" href={staffAppPath("accounting")} />
            <SparkKpiCard title="Petty cash pending" valueDisplay={String(salesAnalytics.pendingPettyCashCount)} subtext="Requests" tone="violet" href={staffAppPath("accounting")} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
            Accounting summary requires finance or manager access. Use the Accounting page for full ledger and reports.
          </p>
        )}
      </SectionShell>
    </div>
  );
}
