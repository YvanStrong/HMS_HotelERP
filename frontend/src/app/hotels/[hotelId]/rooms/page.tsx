"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { RoomDetailDrawer } from "@/components/RoomDetailDrawer";
import { RoomStatusBadge } from "@/components/RoomStatusBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { loadAuthUser } from "@/lib/auth";
import { staffAppPath } from "@/lib/staffAppRoutes";

const STATUS_OPTIONS = [
  "",
  "OCCUPIED",
  "VACANT_CLEAN",
  "VACANT_DIRTY",
  "INSPECTED",
  "BLOCKED",
  "OUT_OF_ORDER",
  "UNDER_MAINTENANCE",
  "RESERVED",
] as const;

type RoomTypeSummary = {
  id: string;
  name: string;
  baseRate: number;
};

type RoomRow = {
  id: string;
  roomNumber: string;
  floor: number | null;
  building?: string | null;
  lastUpdated?: string;
  roomType: RoomTypeSummary;
  status: string;
  cleanliness: string;
  isOutOfOrder: boolean;
  dnd?: boolean;
  dndUntil?: string | null;
  operationalState?: string;
  hasActiveBlock?: boolean;
  currentReservation: { confirmationCode: string; guestId?: string; status?: string } | null;
};

type PagedRooms = {
  data: RoomRow[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
};

type RoomStatusSummary = {
  total: number;
  occupied: number;
  vacantClean: number;
  vacantDirty: number;
  outOfOrder: number;
};

type PublicRoomType = { id: string; code: string; name: string };

type RoomDashboard = {
  staleDndRooms?: { roomId: string; roomNumber: string; dndSetAt: string }[];
};

const PAGE_SIZE = 200;
const POLL_MS = 30_000;

export default function RoomsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [floorFilter, setFloorFilter] = useState<string>("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [drawerRoomId, setDrawerRoomId] = useState<string | null>(null);

  useEffect(() => {
    setUser(loadAuthUser());
    setHasToken(!!getToken());
  }, []);

  useEffect(() => {
    setPage(1);
  }, [hotelId, statusFilter, floorFilter, roomTypeFilter]);

  const roomTypesQuery = useQuery({
    queryKey: ["publicRoomTypes", hotelId],
    queryFn: () => apiFetch<PublicRoomType[]>(`/api/v1/public/hotels/${hotelId}/room-types`),
  });

  const summaryQuery = useQuery({
    queryKey: ["roomSummary", hotelId],
    enabled: hasToken,
    queryFn: () => apiFetch<RoomStatusSummary>(`/api/v1/hotels/${hotelId}/rooms/summary`),
    refetchInterval: POLL_MS,
  });

  const dashboardQuery = useQuery({
    queryKey: ["roomDashboard", hotelId],
    enabled: hasToken && user?.role === "HOUSEKEEPING_SUPERVISOR",
    queryFn: () => apiFetch<RoomDashboard>(`/api/v1/hotels/${hotelId}/rooms/dashboard`),
    refetchInterval: POLL_MS,
  });

  const listQuery = useQuery({
    queryKey: ["rooms", hotelId, page, statusFilter, floorFilter, roomTypeFilter],
    enabled: hasToken,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("size", String(PAGE_SIZE));
      if (statusFilter) sp.set("status", statusFilter);
      if (floorFilter.trim() !== "") sp.set("floor", floorFilter.trim());
      if (roomTypeFilter) sp.set("roomType", roomTypeFilter);
      return apiFetch<PagedRooms>(`/api/v1/hotels/${hotelId}/rooms?${sp.toString()}`);
    },
    refetchInterval: POLL_MS,
  });

  const pg = listQuery.data?.pagination;
  const totalPages = pg?.totalPages ?? Math.max(1, Math.ceil((pg?.total ?? 0) / (pg?.size ?? PAGE_SIZE)));

  const floors = useMemo(() => {
    const rows = listQuery.data?.data ?? [];
    const s = new Set<number>();
    for (const r of rows) {
      if (r.floor != null) s.add(r.floor);
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [listQuery.data?.data]);

  const staleDnd = dashboardQuery.data?.staleDndRooms ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground mt-1">
            Live grid, filters, and room detail drawer (refreshes every 30s)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              className={`px-3 py-1.5 ${view === "grid" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 ${view === "table" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}
              onClick={() => setView("table")}
            >
              Table
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.href = staffAppPath("rooms", "new");
            }}
            className="hms-btn-solid text-sm inline-flex items-center gap-2"
          >
            Create room
          </button>
        </div>
      </div>

      {!hasToken && <div className="error">Not signed in. Open /login first.</div>}
      {listQuery.error && (
        <div className="error">{listQuery.error instanceof Error ? listQuery.error.message : "Failed to load"}</div>
      )}

      {user?.role === "HOUSEKEEPING_SUPERVISOR" && staleDnd.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">DND over 24h — attention needed</p>
          <ul className="mt-2 list-disc list-inside text-xs">
            {staleDnd.map((r) => (
              <li key={r.roomId}>
                Room {r.roomNumber} (since {new Date(r.dndSetAt).toLocaleString()})
              </li>
            ))}
          </ul>
        </div>
      )}

      {summaryQuery.data && (
        <div className="flex flex-wrap gap-3 text-sm bg-muted/40 rounded-xl border border-border/60 px-4 py-3">
          <span>
            <strong className="text-foreground">{summaryQuery.data.total}</strong> total
          </span>
          <span className="text-muted-foreground">|</span>
          <span>
            <strong className="text-red-600">{summaryQuery.data.occupied}</strong> occupied
          </span>
          <span>
            <strong className="text-green-600">{summaryQuery.data.vacantClean}</strong> vacant clean
          </span>
          <span>
            <strong className="text-orange-600">{summaryQuery.data.vacantDirty}</strong> vacant dirty
          </span>
          <span>
            <strong className="text-slate-600">{summaryQuery.data.outOfOrder}</strong> out of order
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end bg-card border border-border/60 rounded-xl p-4">
        <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
          Status
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-sm min-w-[160px] bg-background"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? s.replaceAll("_", " ") : "All statuses"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
          Floor
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-sm min-w-[100px] bg-background"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          >
            <option value="">All</option>
            {floors.map((f) => (
              <option key={f} value={String(f)}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground flex flex-col gap-1">
          Room type
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-sm min-w-[180px] bg-background"
            value={roomTypeFilter}
            onChange={(e) => setRoomTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {(roomTypesQuery.data ?? []).map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listQuery.data && view === "grid" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {listQuery.data.data.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDrawerRoomId(r.id)}
                className="text-left bg-card rounded-xl border border-border/60 p-4 shadow-soft hover:shadow-md hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Room {r.roomNumber}</h3>
                    <p className="text-xs text-muted-foreground">Fl {r.floor ?? "—"} · {r.roomType.name}</p>
                  </div>
                  <RoomStatusBadge status={r.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.dnd && (
                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded">
                      🚫 DND
                    </span>
                  )}
                  {r.hasActiveBlock && (
                    <span className="text-[11px] font-medium text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                      🔒 Block
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={listQuery.data.pagination.total}
            pageSize={listQuery.data.pagination.size}
            noun="rooms"
            onPageChange={setPage}
          />
        </>
      )}

      {listQuery.data && view === "table" && (
        <>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2">Floor</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {listQuery.data.data.map((r) => (
                  <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{r.roomNumber}</td>
                    <td className="px-3 py-2">{r.floor ?? "—"}</td>
                    <td className="px-3 py-2">{r.roomType.name}</td>
                    <td className="px-3 py-2">
                      <RoomStatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button type="button" className="text-primary text-xs font-medium" onClick={() => setDrawerRoomId(r.id)}>
                        Drawer
                      </button>
                      <Link href={staffAppPath("rooms", r.id)} className="text-muted-foreground text-xs">
                        Page
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={listQuery.data.pagination.total}
            pageSize={listQuery.data.pagination.size}
            noun="rooms"
            onPageChange={setPage}
          />
        </>
      )}

      <RoomDetailDrawer
        hotelId={hotelId}
        roomId={drawerRoomId}
        open={!!drawerRoomId}
        user={user}
        onClose={() => setDrawerRoomId(null)}
      />
    </div>
  );
}
