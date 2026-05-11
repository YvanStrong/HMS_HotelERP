"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { API_BASE, apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";

type ReservationRow = {
  id: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  nights?: number;
  guestName: string;
  guestEmail: string;
  guest_national_id_masked?: string;
  guestId: string;
  roomNumber: string;
  totalAmount: number;
  currency: string;
  booking_source?: string;
  createdAt?: string;
  portalBooking: boolean;
};

type AvailabilityResponse = {
  available: boolean;
  pricing: { baseRate: number; taxes: number; fees: number; totalPerNight: number };
};

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Compare ISO date or datetime strings as YYYY-MM-DD (hotel list uses dates; API may add time). */
function ymdOnly(s: string) {
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function ReservationsOperationsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stayStart, setStayStart] = useState("");
  const [stayEnd, setStayEnd] = useState("");
  const [statuses, setStatuses] = useState<Record<string, boolean>>({
    CONFIRMED: true,
    CHECKED_IN: true,
    CHECKED_OUT: true,
    CANCELLED: false,
    NO_SHOW: false,
    PENDING: false,
  });
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [availError, setAvailError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState("2026-06-01");
  const [checkOut, setCheckOut] = useState("2026-06-04");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  const [isNoShowSubmitting, setIsNoShowSubmitting] = useState(false);
  const PAGE_SIZE = 12;
  const STATUS_OPTIONS = [
    { key: "CONFIRMED", label: "Confirmed" },
    { key: "CHECKED_IN", label: "Checked in" },
    { key: "CHECKED_OUT", label: "Checked out" },
    { key: "CANCELLED", label: "Cancelled" },
    { key: "NO_SHOW", label: "No show" },
    { key: "PENDING", label: "Pending" },
  ] as const;

  async function loadList() {
    setIsLoading(true);
    setError(null);
    setPage(1);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const p = new URLSearchParams();
      if (stayStart) {
        p.set("check_in_from", stayStart);
        p.set("stayStart", stayStart);
      }
      if (stayEnd) {
        p.set("check_in_to", stayEnd);
        p.set("stayEnd", stayEnd);
      }
      const stCsv = Object.entries(statuses)
        .filter(([, on]) => on)
        .map(([k]) => k)
        .join(",");
      if (stCsv) p.set("status", stCsv);
      if (q.trim()) p.set("q", q.trim());
      const data = await apiFetch<ReservationRow[]>(`/api/v1/hotels/${hotelId}/reservations?${p.toString()}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reservations");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- manual reload via button
  }, [hotelId]);

  const { slice: pageRows, total, totalPages } = useMemo(
    () => paginateSlice(rows, page, PAGE_SIZE),
    [rows, page],
  );
  const stats = useMemo(() => {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      confirmed: by("CONFIRMED"),
      inHouse: by("CHECKED_IN"),
      arrivalsToday: rows.filter((r) => r.checkInDate === localYmd() && r.status === "CONFIRMED").length,
    };
  }, [rows]);

  async function loadSampleAvailability() {
    setAvailError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/hotels/${hotelId}/reservations/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0`,
      );
      if (!res.ok) throw new Error(await res.text());
      setAvail((await res.json()) as AvailabilityResponse);
    } catch (e) {
      setAvail(null);
      setAvailError(e instanceof Error ? e.message : "Availability failed");
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return <span className="badge badge-default bg-gray-200 text-gray-800 border-0">Pending</span>;
      case "CONFIRMED":
        return <span className="badge badge-default bg-blue-100 text-blue-800 border-0">Confirmed</span>;
      case "CHECKED_IN":
        return <span className="badge badge-default bg-green-100 text-green-800 border-0">Checked in</span>;
      case "CHECKED_OUT":
        return <span className="badge badge-default bg-teal-100 text-teal-900 border-0">Checked out</span>;
      case "CANCELLED":
        return <span className="badge badge-destructive">Cancelled</span>;
      case "NO_SHOW":
        return <span className="badge badge-default bg-orange-100 text-orange-900 border-0">No show</span>;
      default:
        return <span className="badge badge-default">{status}</span>;
    }
  };

  async function markNoShow(reservationId: string) {
    setIsNoShowSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/no-show`, {
        method: "POST",
        body: JSON.stringify({}),
        quiet: true,
      });
      setConfirmNoShowId(null);
      await loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No-show failed");
    } finally {
      setIsNoShowSubmitting(false);
    }
  }

  async function loadTodaysArrivals() {
    const t = localYmd();
    const tomorrow = localYmd(new Date(new Date(t + "T12:00:00").getTime() + 24 * 60 * 60 * 1000));
    setStayStart(t);
    setStayEnd(t);
    setStatuses({
      CONFIRMED: true,
      CHECKED_IN: false,
      CHECKED_OUT: false,
      CANCELLED: false,
      NO_SHOW: false,
      PENDING: false,
    });
    setPage(1);
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const p = new URLSearchParams();
      p.set("check_in_from", t);
      p.set("check_in_to", tomorrow);
      p.set("status", "CONFIRMED");
      if (q.trim()) p.set("q", q.trim());
      const data = await apiFetch<ReservationRow[]>(`/api/v1/hotels/${hotelId}/reservations?${p.toString()}`);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reservations");
    }
  }

  function applyPreset(preset: "arrivals" | "inhouse" | "departures" | "all") {
    const today = localYmd();
    const tomorrow = localYmd(new Date(new Date(today + "T12:00:00").getTime() + 24 * 60 * 60 * 1000));
    if (preset === "arrivals") {
      setStayStart(today);
      setStayEnd(today);
      setStatuses({
        CONFIRMED: true,
        CHECKED_IN: false,
        CHECKED_OUT: false,
        CANCELLED: false,
        NO_SHOW: false,
        PENDING: false,
      });
      return;
    }
    if (preset === "inhouse") {
      setStayStart("");
      setStayEnd("");
      setStatuses({
        CONFIRMED: false,
        CHECKED_IN: true,
        CHECKED_OUT: false,
        CANCELLED: false,
        NO_SHOW: false,
        PENDING: false,
      });
      return;
    }
    if (preset === "departures") {
      setStayStart(today);
      setStayEnd(tomorrow);
      setStatuses({
        CONFIRMED: false,
        CHECKED_IN: true,
        CHECKED_OUT: false,
        CANCELLED: false,
        NO_SHOW: false,
        PENDING: false,
      });
      return;
    }
    setStayStart("");
    setStayEnd("");
    setStatuses({
      CONFIRMED: true,
      CHECKED_IN: true,
      CHECKED_OUT: true,
      CANCELLED: false,
      NO_SHOW: false,
      PENDING: false,
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reservations</h1>
            <p className="text-muted-foreground mt-1">
              In-house board: filter by stay window, status, or search confirmation / guest
            </p>
            <p className="text-xs text-muted-foreground mt-2 max-w-3xl">
              <strong>No-show</strong> means the guest did not arrive for a confirmed booking. The stay is closed as
              no-show, the room is released, and a default no-show fee may be posted (see hotel fee policy). Use it for
              arrivals on or before today — not for future check-in dates.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={staffAppPath("reservations", "new")} className="hms-btn-solid text-sm">
              New reservation
            </Link>
            <Link href={`${staffAppPath("reservations", "new")}?type=walkin`} className="hms-btn-outline text-sm">
              Walk-in
            </Link>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Confirmed</p>
          <p className="mt-1 text-2xl font-bold">{stats.confirmed}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Checked in</p>
          <p className="mt-1 text-2xl font-bold">{stats.inHouse}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrivals today</p>
          <p className="mt-1 text-2xl font-bold">{stats.arrivalsToday}</p>
        </div>
      </div>

      {!getToken() && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">Sign in to load reservations.</p>
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Filters</h2>
            <p className="text-xs text-muted-foreground">Refine by stay window, booking status, and guest/reference search</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {rows.length} result{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" className="hms-btn-outline text-xs" onClick={() => applyPreset("arrivals")}>
            Arrivals today
          </button>
          <button type="button" className="hms-btn-outline text-xs" onClick={() => applyPreset("inhouse")}>
            In-house
          </button>
          <button type="button" className="hms-btn-outline text-xs" onClick={() => applyPreset("departures")}>
            Departures
          </button>
          <button type="button" className="hms-btn-outline text-xs" onClick={() => applyPreset("all")}>
            All active
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label>Stay from</label>
            <input type="date" value={stayStart} onChange={(e) => setStayStart(e.target.value)} />
          </div>
          <div>
            <label>Stay to</label>
            <input type="date" value={stayEnd} onChange={(e) => setStayEnd(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-2 block">Status (multi)</label>
            <div className="flex flex-wrap gap-2 text-sm">
              {STATUS_OPTIONS.map((s) => (
                <label
                  key={s.key}
                  onClick={() =>
                    setStatuses((prev) => ({
                      ...prev,
                      [s.key]: !prev[s.key],
                    }))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 cursor-pointer transition-all ${
                    statuses[s.key]
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-border/70 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4">
            <label>Search</label>
            <input 
              value={q} 
              onChange={(e) => setQ(e.target.value)} 
              placeholder="Reference, code, name, national ID…"
              type="search"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <button type="button" onClick={() => loadList()} className="hms-btn-solid">
            Apply Filters
          </button>
          <button type="button" onClick={() => void loadTodaysArrivals()} className="hms-btn-outline">
            Today&apos;s arrivals (CONFIRMED)
          </button>
          <button 
            type="button" 
            onClick={() => {
              setStayStart("");
              setStayEnd("");
              setStatuses({
                CONFIRMED: true,
                CHECKED_IN: true,
                CHECKED_OUT: true,
                CANCELLED: false,
                NO_SHOW: false,
                PENDING: false,
              });
              setQ("");
              loadList();
            }}
            className="hms-btn-outline"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Availability Preview */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-soft">
        <h2 className="text-lg font-semibold mb-2">Availability Preview</h2>
        <p className="text-muted-foreground text-sm mb-4">
          Same engine guests use. Adjust dates to check inventory.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label>Check-in</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div>
            <label>Check-out</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <button 
            type="button" 
            onClick={() => loadSampleAvailability()}
            className="hms-btn-outline"
          >
            Preview
          </button>
        </div>
        {availError && <p className="error mt-3">{availError}</p>}
        {avail && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">
              {avail.available ? (
                <span className="text-green-600">✓ Rooms available</span>
              ) : (
                <span className="text-red-600">✗ No availability</span>
              )}
            </p>
            <p className="text-muted-foreground text-sm">
              From <strong>{avail.pricing.baseRate}</strong> / night + taxes/fees; all-in about{" "}
              <strong>{avail.pricing.totalPerNight}</strong> / night.
            </p>
          </div>
        )}
      </div>

      {/* Reservations List */}
      <div className="bg-card rounded-2xl border border-border/60 p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Reservations ({rows.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th>Booking ref</th>
                <th>Guest</th>
                <th>Stay</th>
                <th>Status</th>
                <th>Room</th>
                <th>Source</th>
                <th>Created</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="border-t border-border/50 animate-pulse">
                    <td className="py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td><div className="h-4 w-32 rounded bg-muted" /></td>
                    <td><div className="h-4 w-28 rounded bg-muted" /></td>
                    <td><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                    <td><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                    <td><div className="h-4 w-12 rounded bg-muted" /></td>
                  </tr>
                ))}
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                  <td>
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded block">
                      {r.booking_reference || "—"}
                    </code>
                    <code className="text-[10px] text-muted-foreground font-mono">{r.confirmationCode}</code>
                  </td>
                  <td>
                    <p className="font-medium">{r.guestName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {r.guest_national_id_masked ?? "—"}
                    </p>
                    {r.guestEmail && (
                      <p className="text-xs text-muted-foreground">{r.guestEmail}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-sm">
                    {r.checkInDate} → {r.checkOutDate}
                    {typeof r.nights === "number" && (
                      <span className="text-muted-foreground"> · {r.nights}n</span>
                    )}
                  </td>
                  <td>{getStatusBadge(r.status)}</td>
                  <td>{r.roomNumber || "Unassigned"}</td>
                  <td>
                    <span className="text-xs font-medium uppercase">
                      {r.booking_source
                        ? r.booking_source.replace(/_/g, " ")
                        : r.portalBooking
                          ? "Guest portal"
                          : "Front desk"}
                    </span>
                  </td>
                  <td className="text-xs text-muted-foreground whitespace-nowrap">
                    {r.createdAt ? r.createdAt.slice(0, 10) : "—"}
                  </td>
                  <td className="font-medium">
                    {r.totalAmount} {r.currency}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 items-start">
                      <Link
                        href={staffAppPath("reservations", r.id)}
                        className="text-sm font-medium text-primary hover:text-primary/80"
                      >
                        Open →
                      </Link>
                      {String(r.status || "").toUpperCase() === "CONFIRMED" &&
                        ymdOnly(r.checkInDate) <= localYmd() && (
                        <button
                          type="button"
                          className="text-xs text-orange-700 underline"
                          onClick={() => setConfirmNoShowId(r.id)}
                        >
                          Mark no-show
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && pageRows.length === 0 && (
                <tr className="border-t border-border/50">
                  <td colSpan={9} className="py-10 text-center text-muted-foreground">
                    No reservations found for the current filters.
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
          noun="reservations"
          onPageChange={setPage}
        />
      </div>
      {confirmNoShowId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Mark as no-show?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This reservation will be updated to no-show status. Continue?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="hms-btn-outline"
                disabled={isNoShowSubmitting}
                onClick={() => setConfirmNoShowId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid"
                disabled={isNoShowSubmitting}
                onClick={() => void markNoShow(confirmNoShowId)}
              >
                {isNoShowSubmitting ? "Updating..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
