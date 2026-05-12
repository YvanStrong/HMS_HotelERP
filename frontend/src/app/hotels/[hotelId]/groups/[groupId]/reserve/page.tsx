"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarRange,
  CheckCircle2,
  Layers,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

type GroupDetail = {
  id: string;
  groupName: string;
  groupCode?: string;
  companyName?: string;
  contactPerson?: string;
  status: string;
  expectedGuests?: number | null;
  roomsNeeded?: number | null;
  targetCheckIn?: string | null;
  targetCheckOut?: string | null;
  eventType?: string | null;
  roomMixSummary?: string | null;
  billingPreference?: string | null;
  notes?: string | null;
};

type AvailType = {
  room_type_id: string;
  name: string;
  base_price_per_night: number;
  total_price: number;
  currency: string;
  nights: number;
  available_count: number;
};

type AvailResponse = { available_room_types: AvailType[] };

type GuestHit = {
  guest: {
    id: string;
    full_name: string;
    national_id: string;
    email: string | null;
  };
};

type BlockRes = {
  createdCount: number;
  message?: string;
  reservations: Array<{
    id: string;
    booking_reference?: string;
    bookingReference?: string;
    confirmationCode?: string;
    room?: { roomNumber?: string; room_number?: string };
  }>;
};

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function GroupReserveBlockPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState(localYmd());
  const [checkOut, setCheckOut] = useState(addDays(localYmd(), 2));
  const [adultsPerRoom, setAdultsPerRoom] = useState(2);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomCount, setRoomCount] = useState(3);
  const [avail, setAvail] = useState<AvailResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  const [guestQ, setGuestQ] = useState("");
  const [guestHits, setGuestHits] = useState<GuestHit[]>([]);
  const [guestSearchLoading, setGuestSearchLoading] = useState(false);
  const [leadGuestId, setLeadGuestId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [blockResult, setBlockResult] = useState<BlockRes | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!getToken()) {
        setLoadErr("Not signed in.");
        return;
      }
      try {
        const g = await apiFetch<GroupDetail>(`/api/v1/hotels/${hotelId}/groups/${groupId}`);
        if (!c) {
          setGroup(g);
          const ymd = (v: unknown) => {
            if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
            if (Array.isArray(v) && v.length >= 3) {
              return `${v[0]}-${String(v[1]).padStart(2, "0")}-${String(v[2]).padStart(2, "0")}`;
            }
            return null;
          };
          const ti = ymd(g.targetCheckIn as unknown);
          const to = ymd(g.targetCheckOut as unknown);
          if (ti) setCheckIn(ti);
          if (to) setCheckOut(to);
          if (g.roomsNeeded != null && g.roomsNeeded > 0) setRoomCount(g.roomsNeeded);
          if (g.expectedGuests != null && g.expectedGuests > 0) {
            const rooms = g.roomsNeeded && g.roomsNeeded > 0 ? g.roomsNeeded : 1;
            const per = Math.max(1, Math.ceil(g.expectedGuests / rooms));
            setAdultsPerRoom(Math.min(6, per));
          }
        }
      } catch (e) {
        if (!c) setLoadErr(e instanceof Error ? e.message : "Could not load group");
      }
    })();
    return () => {
      c = true;
    };
  }, [hotelId, groupId]);

  const loadAvailability = useCallback(async () => {
    setAvail(null);
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    setAvailLoading(true);
    try {
      const p = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        adults: String(adultsPerRoom),
      });
      const data = await apiFetch<AvailResponse>(`/api/v1/hotels/${hotelId}/rooms/availability?${p}`);
      setAvail(data);
      if (data.available_room_types.length && !roomTypeId) {
        setRoomTypeId(data.available_room_types[0].room_type_id);
      }
    } catch {
      setAvail({ available_room_types: [] });
    } finally {
      setAvailLoading(false);
    }
  }, [hotelId, checkIn, checkOut, adultsPerRoom, roomTypeId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const selectedType = useMemo(
    () => avail?.available_room_types.find((t) => t.room_type_id === roomTypeId),
    [avail, roomTypeId],
  );

  const capacity = selectedType?.available_count ?? 0;
  const shortfall = Math.max(0, roomCount - capacity);
  const canBookAll = capacity >= roomCount && roomCount > 0;

  async function searchGuests() {
    const q = guestQ.trim();
    if (q.length < 2) return;
    setGuestSearchLoading(true);
    try {
      const rows = await apiFetch<GuestHit[]>(
        `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(q)}`,
      );
      setGuestHits(rows);
    } catch {
      setGuestHits([]);
    } finally {
      setGuestSearchLoading(false);
    }
  }

  async function submitBlock() {
    setBanner(null);
    setBlockResult(null);
    if (!leadGuestId) {
      setBanner({ kind: "err", text: "Select a lead guest (coordinator or master account holder)." });
      return;
    }
    if (!roomTypeId) {
      setBanner({ kind: "err", text: "Pick a room type with availability." });
      return;
    }
    if (roomCount < 1) {
      setBanner({ kind: "err", text: "Room count must be at least 1." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<BlockRes>(`/api/v1/hotels/${hotelId}/groups/${groupId}/reserve-block`, {
        method: "POST",
        body: JSON.stringify({
          checkInDate: checkIn,
          checkOutDate: checkOut,
          roomTypeId,
          roomCount,
          adultsPerRoom,
          leadGuestId,
        }),
      });
      setBlockResult(res);
      setBanner({ kind: "ok", text: res.message ?? "Block created." });
      void loadAvailability();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Block reserve failed";
      setBanner({
        kind: "err",
        text: raw.includes("No VACANT_CLEAN") || raw.toLowerCase().includes("conflict")
          ? `${raw} — Inventory changed while booking; refresh availability and try a smaller block or different dates.`
          : raw,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loadErr) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <p className="text-rose-600">{loadErr}</p>
        <Link href={staffAppPath("groups")} className="mt-4 inline-block text-indigo-600 font-semibold">
          ← Back to groups
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl p-10 text-slate-500 flex items-center gap-2">
        <Sparkles className="h-5 w-5 animate-pulse text-indigo-500" />
        Loading group…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 pb-16">
      <div>
        <Link
          href={staffAppPath("groups")}
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Rooming radar</h1>
        <p className="mt-1 text-slate-600">
          Lock <strong>{roomCount}</strong> parallel stays for{" "}
          <span className="font-semibold text-indigo-700">{group.groupName}</span> — one lead guest, one room type,
          instant keys on the folio. If inventory is shy, use the playbook below before you commit.
        </p>
      </div>

      {(group.roomMixSummary || group.eventType || group.billingPreference) && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm text-indigo-950 space-y-1">
          <div className="flex items-center gap-2 font-bold text-indigo-900">
            <Building2 className="h-4 w-4" />
            Brief from group record
          </div>
          {group.eventType ? <p>Event vibe: {group.eventType.replaceAll("_", " ")}</p> : null}
          {group.roomMixSummary ? <p>Room wish-list: {group.roomMixSummary}</p> : null}
          {group.billingPreference ? (
            <p>Billing intent: {group.billingPreference.replaceAll("_", " ").toLowerCase()}</p>
          ) : null}
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <CalendarRange className="h-5 w-5 text-indigo-600" />
            Stay window & density
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold uppercase text-slate-500">
              Check-in
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-500">
              Check-out
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </label>
          </div>
          <label className="text-xs font-bold uppercase text-slate-500">
            Adults per room (occupancy filter)
            <input
              type="number"
              min={1}
              max={12}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={adultsPerRoom}
              onChange={(e) => setAdultsPerRoom(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-xs font-bold uppercase text-slate-500">
            Room type
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              value={roomTypeId}
              onChange={(e) => setRoomTypeId(e.target.value)}
            >
              <option value="">— pick a type —</option>
              {(avail?.available_room_types ?? []).map((t) => (
                <option key={t.room_type_id} value={t.room_type_id}>
                  {t.name} · {t.available_count} ready @ {t.currency} {t.total_price} total
                </option>
              ))}
            </select>
          </label>
          {availLoading && <p className="text-xs text-slate-500">Scanning vacant-clean inventory…</p>}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Layers className="h-5 w-5 text-indigo-600" />
            How many keys tonight?
          </div>
          <label className="text-xs font-bold uppercase text-slate-500">
            Rooms to create (same type, same lead guest)
            <input
              type="number"
              min={1}
              max={40}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
              value={roomCount}
              onChange={(e) => setRoomCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
            />
          </label>
          {selectedType ? (
            <div
              className={`rounded-xl p-4 text-sm ${
                canBookAll ? "bg-emerald-50 text-emerald-900 border border-emerald-100" : "bg-amber-50 text-amber-950 border border-amber-100"
              }`}
            >
              <div className="flex items-start gap-2">
                {canBookAll ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                )}
                <div>
                  <p className="font-bold">
                    {capacity} sellable {selectedType.name} rooms match this window & party size.
                  </p>
                  <p className="mt-1">
                    You asked for <strong>{roomCount}</strong>.{" "}
                    {canBookAll
                      ? "Green light — backend will atomically create every reservation or roll all back if one room cannot be pinned."
                      : `Short by ${shortfall}. You can still book ${capacity} now, then remix dates or types for the remainder.`}
                  </p>
                </div>
              </div>
              {!canBookAll && capacity > 0 && (
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-amber-600 py-2 text-xs font-black uppercase tracking-wide text-white shadow hover:bg-amber-700"
                  onClick={() => setRoomCount(capacity)}
                >
                  Clip target to {capacity} (book what fits)
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Pick dates + adults to load types.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5">
        <div className="flex items-center gap-2 font-black text-slate-800">
          <Zap className="h-5 w-5 text-amber-500" />
          When you do not have enough identical rooms
        </div>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <strong>Stagger waves:</strong> book the {capacity || "…"} ready rooms now, nudge check-in/out by a night
            for the tail, or mix a second room type via another pass.
          </li>
          <li>
            <strong>Release inventory:</strong> housekeeping marks rooms inspected faster, or move OOO repairs behind
            lower-priority floors.
          </li>
          <li>
            <strong>Partner property:</strong> overflow guests onto a sister hotel and shuttle — note it in group
            notes.
          </li>
          <li>
            <strong>Single-room wizard:</strong>{" "}
            <Link
              className="font-semibold text-indigo-600 underline"
              href={`${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(groupId)}&check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}${roomTypeId ? `&room_type_id=${encodeURIComponent(roomTypeId)}` : ""}&adults=${adultsPerRoom}`}
            >
              open the classic reservation form
            </Link>{" "}
            for bespoke guest profiles per room.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Users className="h-5 w-5 text-indigo-600" />
          Lead guest (re-used on every room)
        </div>
        <p className="text-xs text-slate-500">
          Perfect for a tour leader, wedding planner, or corporate booker. Each reservation still gets its own room &
          folio — only the profile is shared for speed.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search name or national ID"
            value={guestQ}
            onChange={(e) => setGuestQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void searchGuests()}
          />
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white"
            disabled={guestSearchLoading}
            onClick={() => void searchGuests()}
          >
            {guestSearchLoading ? "Searching…" : "Search guests"}
          </button>
        </div>
        {guestHits.length > 0 && (
          <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
            {guestHits.map((h) => (
              <li key={h.guest.id}>
                <button
                  type="button"
                  onClick={() => {
                    setLeadGuestId(h.guest.id);
                    setGuestHits([]);
                    setGuestQ("");
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    leadGuestId === h.guest.id ? "bg-indigo-600 text-white" : "hover:bg-white"
                  }`}
                >
                  <strong>{h.guest.full_name}</strong>
                  <span className="block text-xs opacity-80">{h.guest.national_id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {leadGuestId && (
          <p className="text-xs font-semibold text-emerald-700">
            Lead guest locked in — ready to blast {roomCount} reservations.
          </p>
        )}
      </section>

      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            banner.kind === "ok" ? "bg-emerald-50 text-emerald-900 border border-emerald-100" : "bg-rose-50 text-rose-800 border border-rose-100"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={submitting || !canBookAll || !leadGuestId}
          onClick={() => void submitBlock()}
          className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-indigo-200 disabled:opacity-40"
        >
          {submitting ? "Creating block…" : `Create ${roomCount} reservations`}
        </button>
        <Link
          href={`${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(groupId)}&check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}${roomTypeId ? `&room_type_id=${encodeURIComponent(roomTypeId)}` : ""}&adults=${adultsPerRoom}`}
          className="inline-flex items-center rounded-2xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
        >
          Hand-build one room
        </Link>
      </div>

      {blockResult && blockResult.reservations?.length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <h3 className="font-black text-emerald-900">Block live</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {blockResult.reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
                <span className="font-mono text-xs">
                  {r.booking_reference ?? r.bookingReference ?? r.confirmationCode} · Room{" "}
                  {r.room?.roomNumber ?? r.room?.room_number ?? "—"}
                </span>
                <Link href={staffAppPath("reservations", r.id)} className="text-xs font-bold text-indigo-600">
                  Open folio →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
