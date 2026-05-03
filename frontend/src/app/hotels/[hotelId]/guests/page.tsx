"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
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

type GuestProfile = {
  id: string;
  name: string;
  email: string;
  loyalty?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  stayHistory?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  flags?: Record<string, unknown>;
};

type SavedGuestRow = {
  guestId: string;
  guestName: string;
  guestEmail: string;
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

  const [guestId, setGuestId] = useState("");
  const [manualGuestId, setManualGuestId] = useState("");
  const [guestFilter, setGuestFilter] = useState("");
  const [savedGuests, setSavedGuests] = useState<SavedGuestRow[]>([]);
  const [savedGuestsErr, setSavedGuestsErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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

  const loadSavedGuests = useCallback(async () => {
    setSavedGuestsErr(null);
    if (!getToken()) {
      setSavedGuestsErr("Not signed in.");
      return;
    }
    try {
      const list = await apiFetch<{ guest: { id: string; full_name: string; email: string | null } }[]>(
        `/api/v1/hotels/${hotelId}/guests`,
      );
      setSavedGuests(
        list.map((row) => ({
          guestId: row.guest.id,
          guestName: row.guest.full_name || "Unnamed guest",
          guestEmail: row.guest.email ?? "—",
        })),
      );
    } catch (e) {
      setSavedGuests([]);
      setSavedGuestsErr(e instanceof Error ? e.message : "Could not load saved guests");
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSavedGuests();
  }, [loadSavedGuests]);

  const directoryGuests = useMemo(() => {
    const map = new Map<string, ReservationGuestRow>();
    for (const r of rows) {
      if (!r.guestId) continue;
      if (!map.has(r.guestId)) map.set(r.guestId, r);
    }
    return Array.from(map.values()).sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return directoryGuests.filter((g) => {
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
  }, [directoryGuests, q, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: string) => directoryGuests.filter((g) => g.status === s).length;
    return {
      totalGuests: directoryGuests.length,
      inHouseGuests: by("CHECKED_IN"),
      arrivals: by("CONFIRMED"),
      departed: by("CHECKED_OUT"),
    };
  }, [directoryGuests]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const guestChoices = useMemo(
    () => [...savedGuests].sort((a, b) => a.guestName.localeCompare(b.guestName)),
    [savedGuests],
  );

  const filteredSaved = useMemo(() => {
    const needle = guestFilter.trim().toLowerCase();
    if (!needle) return guestChoices;
    return guestChoices.filter(
      (g) =>
        g.guestName.toLowerCase().includes(needle) || g.guestEmail.toLowerCase().includes(needle),
    );
  }, [guestChoices, guestFilter]);

  const selectGuestOptions = useMemo(() => {
    if (!guestId || filteredSaved.some((g) => g.guestId === guestId)) {
      return filteredSaved;
    }
    const cur = guestChoices.find((g) => g.guestId === guestId);
    return cur ? [cur, ...filteredSaved] : filteredSaved;
  }, [guestChoices, guestId, filteredSaved]);

  async function loadProfile() {
    setProfileError(null);
    setProfile(null);
    if (!getToken()) {
      setProfileError("Not signed in.");
      return;
    }
    const id = manualGuestId.trim() || guestId.trim();
    if (!id) {
      setProfileError("Choose a guest from the list, or paste an id in “Guest not on the list”.");
      return;
    }
    try {
      const json = await apiFetch<GuestProfile>(`/api/v1/hotels/${hotelId}/guests/${id}/profile`);
      setProfile(json);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Guest directory from current and recent stays. Search by name, email, booking reference, or masked ID. Use
          the section below to load full CRM profiles for saved guests.
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
                    <td className="py-3">
                      <div className="h-4 w-32 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-36 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-28 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-20 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-16 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-24 rounded bg-muted" />
                    </td>
                    <td>
                      <div className="h-4 w-16 rounded bg-muted" />
                    </td>
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
                      <div className="font-mono text-xs">{g.booking_reference || g.confirmationCode}</div>
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

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold">Guest profile (CRM)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a saved guest, then load loyalty, preferences, and stay history from the profile API.
        </p>
        {savedGuestsErr && <div className="error mt-3">{savedGuestsErr}</div>}
        <div className="mt-4 grid max-w-xl gap-3">
          <label>
            Search saved guests (optional)
            <input
              type="search"
              placeholder="Name or email…"
              value={guestFilter}
              onChange={(e) => setGuestFilter(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label>
            Guest
            <select
              value={guestId}
              onChange={(e) => {
                setGuestId(e.target.value);
                setManualGuestId("");
              }}
              className="w-full"
            >
              <option value="">Choose a guest…</option>
              {selectGuestOptions.map((g) => (
                <option key={g.guestId} value={g.guestId}>
                  {g.guestName} · {g.guestEmail}
                </option>
              ))}
            </select>
          </label>
          {guestChoices.length === 0 && !savedGuestsErr && (
            <p className="text-sm text-muted-foreground">No saved guests yet — create guests or use advanced below.</p>
          )}
          {filteredSaved.length === 0 && guestChoices.length > 0 && (
            <p className="text-sm text-muted-foreground">No matches — clear search to see all saved guests.</p>
          )}
          <button type="button" className="hms-btn-solid w-fit" onClick={() => void loadProfile()}>
            Load profile
          </button>
          <details className="rounded-lg border border-border/60 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Guest not on the list?</summary>
            <p className="mt-2 text-muted-foreground">Paste the guest UUID from the API or PMS export.</p>
            <label className="mt-2 block">
              Guest id
              <input
                value={manualGuestId}
                onChange={(e) => setManualGuestId(e.target.value)}
                placeholder="uuid"
                autoComplete="off"
                spellCheck={false}
                className="mt-1 w-full font-mono text-sm"
              />
            </label>
            <button type="button" className="hms-btn-outline mt-2" onClick={() => void loadProfile()}>
              Load profile
            </button>
          </details>
        </div>
        {profileError && <div className="error mt-4">{profileError}</div>}
        {profile != null && (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <h3 className="text-base font-semibold">{profile.name}</h3>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              <p className="mt-1 font-mono text-xs">{profile.id}</p>
            </div>
            <KeyValueTable title="Loyalty" rows={recordToRows(profile.loyalty)} />
            <KeyValueTable title="Preferences" rows={recordToRows(profile.preferences)} />
            <KeyValueTable title="Stay history" rows={recordToRows(profile.stayHistory)} />
            <KeyValueTable title="Communication" rows={recordToRows(profile.communication)} />
            <KeyValueTable title="Flags" rows={recordToRows(profile.flags)} />
          </div>
        )}
      </div>
    </div>
  );
}
