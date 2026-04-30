"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";

type ReservationGuestRow = {
  guestId: string;
  guestName: string;
  guestEmail: string;
  guest_national_id_masked?: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
};

function stayRangeParams(): string {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const p = new URLSearchParams();
  p.set("stayStart", start.toISOString().slice(0, 10));
  p.set("stayEnd", end.toISOString().slice(0, 10));
  return p.toString();
}

export default function GuestsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<ReservationGuestRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setIsLoading(false);
      return;
    }
    try {
      const data = await apiFetch<ReservationGuestRow[]>(
        `/api/v1/hotels/${hotelId}/reservations?${stayRangeParams()}`,
      );
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not load guests");
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const guests = useMemo(() => {
    const map = new Map<string, ReservationGuestRow>();
    for (const r of rows) {
      if (!r.guestId) continue;
      if (!map.has(r.guestId)) map.set(r.guestId, r);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.guestName.localeCompare(b.guestName),
    );
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guests.filter((g) => {
      const statusOk = statusFilter === "ALL" || g.status === statusFilter;
      if (!statusOk) return false;
      if (!needle) return true;
      return (
        g.guestName.toLowerCase().includes(needle) ||
        (g.guestEmail || "").toLowerCase().includes(needle) ||
        (g.booking_reference || "").toLowerCase().includes(needle) ||
        g.confirmationCode.toLowerCase().includes(needle) ||
        (g.guest_national_id_masked || "").toLowerCase().includes(needle)
      );
    });
  }, [guests, q, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: string) => guests.filter((g) => g.status === s).length;
    return {
      totalGuests: guests.length,
      inHouseGuests: by("CHECKED_IN"),
      arrivals: by("CONFIRMED"),
      departed: by("CHECKED_OUT"),
    };
  }, [guests]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest directory from current and recent stays. Search by name, email, booking reference, or masked ID.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Guests</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalGuests}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In house</p>
          <p className="mt-1 text-2xl font-bold">{stats.inHouseGuests}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Upcoming arrivals</p>
          <p className="mt-1 text-2xl font-bold">{stats.arrivals}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Checked out</p>
          <p className="mt-1 text-2xl font-bold">{stats.departed}</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label>
            Search
            <input
              type="search"
              placeholder="Name, email, booking ref, masked ID..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Status
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked in</option>
              <option value="CHECKED_OUT">Checked out</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No show</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="hms-btn-outline w-full" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Guest list ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th>Guest</th>
                <th>Contact</th>
                <th>Last booking</th>
                <th>Status</th>
                <th>Room</th>
                <th>Stay</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`g-skeleton-${idx}`} className="border-t border-border/50 animate-pulse">
                    <td className="py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
                    <td><div className="h-4 w-36 rounded bg-muted" /></td>
                    <td><div className="h-4 w-28 rounded bg-muted" /></td>
                    <td><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                    <td><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                  </tr>
                ))}
              {!isLoading &&
                slice.map((g) => (
                  <tr key={g.guestId} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td>
                      <p className="font-medium">{g.guestName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{g.guest_national_id_masked || "—"}</p>
                    </td>
                    <td>{g.guestEmail || "—"}</td>
                    <td>
                      <div className="font-mono text-xs">
                        {g.booking_reference || g.confirmationCode}
                      </div>
                    </td>
                    <td>{g.status.replaceAll("_", " ")}</td>
                    <td>{g.roomNumber || "Unassigned"}</td>
                    <td className="whitespace-nowrap">
                      {g.checkInDate} → {g.checkOutDate}
                    </td>
                    <td>
                      <Link
                        href={staffAppPath("guests", g.guestId)}
                        className="text-sm font-medium text-primary hover:text-primary/80"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              {!isLoading && slice.length === 0 && (
                <tr className="border-t border-border/50">
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    No guests match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          noun="guests"
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
