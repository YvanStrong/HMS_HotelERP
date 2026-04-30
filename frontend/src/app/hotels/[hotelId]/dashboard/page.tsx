"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RealtimeKpiCards } from "@/components/RealtimeKpiCards";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";

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

export default function HotelDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [board, setBoard] = useState<RoomDashboard | null>(null);
  const [grid, setGrid] = useState<OccupancyGrid | null>(null);
  const [kpi, setKpi] = useState<RealtimeDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gridPage, setGridPage] = useState(1);
  const GRID_PAGE_SIZE = 10;
  const range = useMemo(() => defaultDateRange(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      try {
        const d = await apiFetch<RoomDashboard>(`/api/v1/hotels/${hotelId}/rooms/dashboard`);
        if (!cancelled) setBoard(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Room dashboard failed");
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
        const k = await apiFetch<RealtimeDashboard>(
          `/api/v1/hotels/${hotelId}/reports/realtime-dashboard`,
        );
        if (!cancelled) setKpi(k);
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, range.from, range.to]);

  const buckets = board?.bucketCounts ? Object.entries(board.bucketCounts).sort((a, b) => a[0].localeCompare(b[0])) : [];
  const days = grid?.days ?? [];
  const {
    slice: daySlice,
    total: dayTotal,
    totalPages: dayTotalPages,
  } = useMemo(() => paginateSlice(days, gridPage, GRID_PAGE_SIZE), [days, gridPage]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Room Operations</h1>
          <p className="text-muted-foreground mt-1">
            Live status buckets and occupancy grid from the backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={staffAppPath("rooms")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
            Rooms List
          </Link>
          <Link href={staffAppPath("room-blocks")} className="hms-btn-outline hms-btn-sm hms-btn-icon">
            Blocks
          </Link>
          <Link href={staffAppPath("reservations")} className="hms-btn-solid hms-btn-sm hms-btn-icon">
            Reservations
          </Link>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Stats Grid */}
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

      {/* Occupancy Grid */}
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

      {/* Realtime KPI */}
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
