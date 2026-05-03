"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RealtimeKpiCards } from "@/components/RealtimeKpiCards";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
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

function toneClasses(tone: KpiCard["tone"]): string {
  switch (tone) {
    case "green":
      return "border-emerald-200 bg-emerald-50";
    case "amber":
      return "border-amber-200 bg-amber-50";
    case "red":
      return "border-red-200 bg-red-50";
    case "violet":
      return "border-violet-200 bg-violet-50";
    default:
      return "border-sky-200 bg-sky-50";
  }
}

function defaultDateRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 14);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function HotelDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [dash, setDash] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [board, setBoard] = useState<RoomDashboard | null>(null);
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [kpi, setKpi] = useState<RealtimeDashboard | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [gridPage, setGridPage] = useState(1);
  const GRID_PAGE_SIZE = 10;
  const range = useMemo(() => defaultDateRange(), []);

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
      if (!getToken()) return;
      try {
        const d = await apiFetch<RoomDashboard>(`/api/v1/hotels/${hotelId}/rooms/dashboard`);
        if (!cancelled) setBoard(d);
      } catch (e) {
        if (!cancelled) setRoomError(e instanceof Error ? e.message : "Room dashboard failed");
      }
      try {
        const g = await apiFetch<OccupancyGrid>(
          `/api/v1/hotels/${hotelId}/rooms/occupancy-grid?from=${range.from}&to=${range.to}`,
        );
        if (!cancelled) {
          setGrid(g);
          setGridPage(1);
        }
      } catch {
        /* optional */
      }
      try {
        const k = await apiFetch<RealtimeDashboard>(`/api/v1/hotels/${hotelId}/reports/realtime-dashboard`);
        if (!cancelled) setKpi(k);
      } catch {
        /* optional */
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

  const buckets = board?.bucketCounts ? Object.entries(board.bucketCounts).sort((a, b) => a[0].localeCompare(b[0])) : [];
  const days = grid?.days ?? [];
  const {
    slice: daySlice,
    total: dayTotal,
    totalPages: dayTotalPages,
  } = useMemo(() => paginateSlice(days, gridPage, GRID_PAGE_SIZE), [days, gridPage]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hotel Executive Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Live operations, revenue, and alerts for today — plus room status and occupancy from operations APIs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={staffAppPath("rooms")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
              Rooms List
            </Link>
            <Link href={staffAppPath("room-blocks")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
              Blocks
            </Link>
            <Link href={staffAppPath("reservations")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
              Reservations
            </Link>
            <Link href={staffAppPath("reservations", "new")} className="hms-btn-solid text-sm">
              New reservation
            </Link>
          </div>
        </div>
        <div className="text-sm text-muted-foreground mt-3">
          Last updated: {lastUpdated ?? "—"}
        </div>
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
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-8 w-20 bg-muted animate-pulse rounded mt-2" />
                <div className="h-3 w-40 bg-muted animate-pulse rounded mt-2" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded mb-2" />
              ))}
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted animate-pulse rounded mb-2" />
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <div className="text-4xl">📊</div>
          <p className="mt-2 font-medium">No dashboard data yet</p>
          <p className="text-sm text-muted-foreground">Create reservations and operations activity to populate executive KPIs.</p>
          <Link href={staffAppPath("reservations/new")} className="hms-btn-solid text-sm inline-block mt-3">
            Create first reservation
          </Link>
        </div>
      )}

      {!loading && dash && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-2">Today&apos;s Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {dash.todaysOperations.map((c) => (
                <Link
                  key={c.key}
                  href={c.actionPath ?? "#"}
                  className={`rounded-xl border p-4 ${toneClasses(c.tone)} ${c.actionPath ? "cursor-pointer" : "pointer-events-none"}`}
                >
                  <p className="text-xs uppercase text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold">{c.valueDisplay}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.subtext}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Revenue</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dash.revenueCards.map((c) => (
                <Link
                  key={c.key}
                  href={c.actionPath ?? "#"}
                  className={`rounded-xl border p-4 ${toneClasses(c.tone)} ${c.actionPath ? "cursor-pointer" : "pointer-events-none"}`}
                >
                  <p className="text-xs uppercase text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold">{c.valueDisplay}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.subtext}</p>
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">Operations Alerts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {dash.operationsAlerts.map((c) => (
                <Link
                  key={c.key}
                  href={c.actionPath ?? "#"}
                  className={`rounded-xl border p-4 ${toneClasses(c.tone)} ${c.actionPath ? "cursor-pointer" : "pointer-events-none"}`}
                >
                  <p className="text-xs uppercase text-muted-foreground">{c.title}</p>
                  <p className="text-2xl font-bold">{c.valueDisplay}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.subtext}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Today&apos;s Arrivals</h3>
                <Link href={staffAppPath("reservations?filter=arrivals_today")} className="text-sm text-primary">See all</Link>
              </div>
              <table>
                <thead>
                  <tr><th>Booking Ref</th><th>Guest Name</th><th>Room</th><th>Check-in Time</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {dash.todaysArrivals.map((r) => (
                    <tr key={r.reservationId}>
                      <td>{r.bookingReference}</td>
                      <td>{r.guestName}</td>
                      <td>{r.roomNumber}</td>
                      <td>{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : "—"}</td>
                      <td>{r.status}</td>
                      <td><Link className="hms-btn-outline text-xs" href={staffAppPath(`reservations/${r.reservationId}`)}>Check In</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Today&apos;s Departures</h3>
                <Link href={staffAppPath("reservations?filter=departures_today")} className="text-sm text-primary">See all</Link>
              </div>
              <table>
                <thead>
                  <tr><th>Booking Ref</th><th>Guest Name</th><th>Room</th><th>Balance Due</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {dash.todaysDepartures.map((r) => (
                    <tr key={r.reservationId}>
                      <td>{r.bookingReference}</td>
                      <td>{r.guestName}</td>
                      <td>{r.roomNumber}</td>
                      <td>{r.balanceDue}</td>
                      <td>{r.status}</td>
                      <td><Link className="hms-btn-outline text-xs" href={staffAppPath(`reservations/${r.reservationId}`)}>Check Out</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="font-semibold mb-2">Recent Activity</h3>
            <table>
              <thead>
                <tr><th>Timestamp</th><th>Staff</th><th>Action</th><th>Reference</th></tr>
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
          </section>
        </>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Room operations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Live status buckets, occupancy grid, and realtime KPIs (from YVAN_ERP operations APIs).
        </p>
      </div>

      {roomError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{roomError}</div>
      )}

      {board && (
        <section className="hms-section-card">
          <div className="hms-section-head">
            <h2 className="hms-section-title">Status Board</h2>
            <span className="hms-section-sub">
              Total: <strong className="text-foreground">{board.totalRooms}</strong> rooms
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {buckets.map(([k, v]) => (
              <div key={k} className="bg-muted/50 rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium truncate">{k}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{v}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Buckets reflect operational states (OCCUPIED, VACANT_CLEAN, etc.). DND skips housekeeping; active blocks prevent assignment.
          </p>
        </section>
      )}

      {grid && grid.days.length > 0 && (
        <section className="hms-section-card">
          <h2 className="hms-section-title mb-4">
            Occupancy Grid <span className="text-muted-foreground font-normal">({range.from} → {range.to})</span>
          </h2>

          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Occupied</th>
                  <th>Total</th>
                  <th>Occupancy %</th>
                </tr>
              </thead>
              <tbody>
                {daySlice.map((row) => (
                  <tr key={row.date}>
                    <td className="font-medium">{row.date}</td>
                    <td>{row.occupiedRooms}</td>
                    <td>{row.totalRooms}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(row.occupiedRooms / row.totalRooms) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {Math.round((row.occupiedRooms / row.totalRooms) * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={gridPage}
            totalPages={dayTotalPages}
            totalItems={dayTotal}
            pageSize={GRID_PAGE_SIZE}
            noun="days"
            onPageChange={setGridPage}
          />
        </section>
      )}

      {grid && grid.days.length === 0 && (
        <section className="hms-section-card">
          <div className="hms-empty-state">
            <p className="hms-empty-title">No occupancy data yet</p>
            <p className="hms-empty-copy">Try a wider date range or check once reservations are added.</p>
          </div>
        </section>
      )}

      {kpi != null && (
        <section className="hms-section-card">
          <div className="hms-section-head">
            <h2 className="hms-section-title">Realtime KPI</h2>
            {kpi.timestamp && (
              <span className="hms-section-sub">
                Snapshot: {new Date(kpi.timestamp).toLocaleString()}
                {kpi.alerts && kpi.alerts.length > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">· {kpi.alerts.length} alert(s)</span>
                )}
              </span>
            )}
          </div>

          <RealtimeKpiCards liveMetrics={kpi.liveMetrics as Record<string, unknown> | undefined} />

          {(!kpi.liveMetrics || Object.keys(kpi.liveMetrics).length === 0) && (
            <div className="hms-empty-state">
              <p className="hms-empty-title">No live metrics in this snapshot</p>
              <p className="hms-empty-copy">Realtime KPIs appear here when event traffic is available.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
