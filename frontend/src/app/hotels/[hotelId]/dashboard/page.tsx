"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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

export default function HotelDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [dash, setDash] = useState<ExecutiveDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    void load();
    const t = setInterval(() => {
      void load();
    }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const hasData = useMemo(
    () => Boolean(dash && (dash.todaysOperations.length + dash.revenueCards.length + dash.operationsAlerts.length > 0)),
    [dash],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Hotel Executive Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Live operations, revenue, and alerts for today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={staffAppPath("reservations")} className="hms-btn-solid text-sm">
              New Reservation
            </Link>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {lastUpdated ?? "—"}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button type="button" className="hms-btn-outline text-sm mt-2" onClick={() => void load()}>
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
    </div>
  );
}
