"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { useHotelContext } from "@/lib/useHotelContext";
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
  ChevronDown,
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
  preferredRoomTypeId?: string | null;
};

type CatalogRoomType = {
  id: string;
  name: string;
  code?: string;
  baseRate?: number;
  maxOccupancy?: number;
};

type AvailType = {
  room_type_id: string;
  name: string;
  base_price_per_night: number;
  total_price: number;
  currency: string;
  nights: number;
  available_count: number;
  availability_hint?: string | null;
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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const { hotel } = useHotelContext(hotelId);
  const defaultCurrency = hotel.currency || "RWF";

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [catalogTypes, setCatalogTypes] = useState<CatalogRoomType[]>([]);
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
  const [showAllRoomTypes, setShowAllRoomTypes] = useState(false);

  const compactReserve = useMemo(() => {
    if (searchParams.get("advanced") === "1") return false;
    return searchParams.get("from_create") === "1" || !!searchParams.get("room_type_id");
  }, [searchParams]);

  const fullTypePicker = !compactReserve || showAllRoomTypes;

  const selectedCatalog = useMemo(
    () => catalogTypes.find((t) => t.id === roomTypeId),
    [catalogTypes, roomTypeId],
  );

  useEffect(() => {
    if (!compactReserve) setShowAllRoomTypes(true);
  }, [compactReserve]);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!getToken()) {
        setLoadErr("Not signed in.");
        return;
      }
      try {
        const [g, types] = await Promise.all([
          apiFetch<GroupDetail>(`/api/v1/hotels/${hotelId}/groups/${groupId}`),
          apiFetch<CatalogRoomType[]>(`/api/v1/hotels/${hotelId}/room-types`).catch(() => [] as CatalogRoomType[]),
        ]);
        if (!c) {
          setGroup(g);
          setCatalogTypes(Array.isArray(types) ? types : []);
          const fromUrl = searchParams.get("room_type_id");
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
          if (fromUrl) setRoomTypeId(fromUrl);
          else if (g.preferredRoomTypeId) setRoomTypeId(g.preferredRoomTypeId);
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
  }, [hotelId, groupId, searchParams.toString()]);

  const loadAvailability = useCallback(async () => {
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
      const urlPref = searchParams.get("room_type_id");
      const preferred = group?.preferredRoomTypeId;
      const sellable = data.available_room_types.filter((t) => t.available_count > 0);
      const pool = sellable.length > 0 ? sellable : data.available_room_types;
      if (pool.length) {
        const pick =
          (urlPref && pool.some((t) => t.room_type_id === urlPref)
            ? urlPref
            : preferred && pool.some((t) => t.room_type_id === preferred)
              ? preferred
              : roomTypeId && pool.some((t) => t.room_type_id === roomTypeId)
                ? roomTypeId
                : pool[0].room_type_id) ?? "";
        if (pick) setRoomTypeId(pick);
      }
    } catch {
      setAvail({ available_room_types: [] });
    } finally {
      setAvailLoading(false);
    }
  }, [hotelId, checkIn, checkOut, adultsPerRoom, roomTypeId, group?.preferredRoomTypeId, searchParams.toString()]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const availByTypeId = useMemo(() => {
    const m = new Map<string, AvailType>();
    for (const t of avail?.available_room_types ?? []) {
      m.set(t.room_type_id, t);
    }
    return m;
  }, [avail]);

  const selectedType = useMemo(
    () => avail?.available_room_types.find((t) => t.room_type_id === roomTypeId),
    [avail, roomTypeId],
  );

  const plannedTypeName = useMemo(() => {
    const id = group?.preferredRoomTypeId;
    if (!id) return null;
    return catalogTypes.find((t) => t.id === id)?.name ?? null;
  }, [group?.preferredRoomTypeId, catalogTypes]);

  const plannedAvail = useMemo(() => {
    const id = group?.preferredRoomTypeId;
    if (!id || !avail) return null;
    return avail.available_room_types.find((t) => t.room_type_id === id) ?? null;
  }, [group?.preferredRoomTypeId, avail]);

  const selectedAvailHint = useMemo(() => {
    if (!roomTypeId || !avail) return null;
    return avail.available_room_types.find((t) => t.room_type_id === roomTypeId)?.availability_hint ?? null;
  }, [roomTypeId, avail]);

  /** Room types that have at least one sellable room for the current date range + party size. */
  const availableCatalogTypes = useMemo(
    () =>
      catalogTypes.filter((rt) => {
        const a = availByTypeId.get(rt.id);
        return !!(a && a.nights > 0 && a.available_count > 0);
      }),
    [catalogTypes, availByTypeId],
  );

  const capacity = selectedType?.available_count ?? 0;
  const shortfall = Math.max(0, roomCount - capacity);
  const canBookAll = capacity >= roomCount && roomCount > 0 && !!roomTypeId;

  const quoteCurrency = selectedType?.currency ?? defaultCurrency;
  const perRoomTotal = selectedType?.total_price ?? 0;
  const perRoomPerNight = selectedType?.base_price_per_night ?? 0;
  const blockStayTotal = perRoomTotal * roomCount;
  const nights = selectedType?.nights ?? 0;
  const hasPositiveRoomRate = perRoomPerNight > 0 && perRoomTotal > 0;

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
    if (!roomTypeId) {
      setBanner({ kind: "err", text: "Pick a room type." });
      return;
    }
    if (!selectedType || capacity < 1) {
      setBanner({ kind: "err", text: "No availability for this room type on the selected dates." });
      return;
    }
    if (roomCount < 1) {
      setBanner({ kind: "err", text: "Room count must be at least 1." });
      return;
    }
    if (!hasPositiveRoomRate) {
      setBanner({
        kind: "err",
        text: "This group block has no positive room rate. Configure the room type/rate plan before booking.",
      });
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
          ...(leadGuestId ? { leadGuestId } : {}),
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
          ? `${raw} — Refresh availability and try fewer rooms or different dates.`
          : raw,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const newReservationHref = `${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(groupId)}&check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}${roomTypeId ? `&room_type_id=${encodeURIComponent(roomTypeId)}` : ""}&adults=${adultsPerRoom}`;

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

  const reserveFinished =
    !!compactReserve && !!blockResult?.reservations?.length;

  if (reserveFinished) {
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-8 pb-20 sm:px-6">
        <Link
          href={staffAppPath("groups")}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="h-8 w-8 shrink-0" />
            <div>
              <h1 className="text-2xl font-black tracking-tight text-emerald-950">Rooms are booked</h1>
              <p className="mt-1 text-sm font-medium text-emerald-900/90">
                {blockResult.message ?? "Your group block is on the books."}
              </p>
            </div>
          </div>
          <ul className="mt-5 space-y-2 border-t border-emerald-100/80 pt-4">
            {blockResult.reservations!.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/90 px-3 py-2.5 text-sm shadow-sm ring-1 ring-emerald-100"
              >
                <span className="font-mono text-xs text-slate-700">
                  {r.booking_reference ?? r.bookingReference ?? r.confirmationCode} · Room{" "}
                  {r.room?.roomNumber ?? r.room?.room_number ?? "—"}
                </span>
                <Link href={staffAppPath("reservations", r.id)} className="text-xs font-bold text-indigo-600">
                  Open folio →
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={staffAppPath("groups")}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800"
            >
              Back to groups
            </Link>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-md"
              onClick={() => {
                setBlockResult(null);
                setBanner(null);
                setLeadGuestId(null);
                router.replace(pathname);
              }}
            >
              Book another block
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto space-y-5 px-4 py-6 pb-28 sm:px-6 sm:pb-16 ${compactReserve ? "max-w-xl" : "max-w-4xl"}`}
    >
      <div>
        <Link
          href={staffAppPath("groups")}
          className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Groups
        </Link>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
          {compactReserve ? "Confirm group stay" : "Book group block"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">
          {compactReserve ? (
            <>
              <span className="font-semibold text-slate-800">{group.groupName}</span> — dates and room type are
              already set. Search the lead guest, then book.{" "}
              <Link href={`${pathname}?advanced=1`} className="font-semibold text-indigo-600 underline">
                Full editor
              </Link>{" "}
              if you need every option.
            </>
          ) : (
            <>
              Reserve rooms for <span className="font-semibold text-indigo-700">{group.groupName}</span>
              {plannedTypeName ? (
                <>
                  {" "}
                  · planned: <span className="font-semibold text-indigo-700">{plannedTypeName}</span>
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      {!compactReserve &&
        (group.roomMixSummary || group.eventType || group.billingPreference || plannedTypeName) && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-indigo-950 space-y-1">
          <div className="flex items-center gap-2 font-bold text-indigo-900">
            <Building2 className="h-4 w-4" />
            Group plan
          </div>
          {plannedTypeName ? <p>Primary room type: {plannedTypeName}</p> : null}
          {group.roomsNeeded != null ? <p>Target rooms: {group.roomsNeeded}</p> : null}
          {group.eventType ? <p>Event: {group.eventType.replaceAll("_", " ")}</p> : null}
          {group.roomMixSummary ? <p>Notes: {group.roomMixSummary}</p> : null}
          {group.billingPreference ? (
            <p>Billing: {group.billingPreference.replaceAll("_", " ").toLowerCase()}</p>
          ) : null}
        </div>
      )}

      {compactReserve ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Your stay</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-bold uppercase text-slate-500">
                Check-in
                <input
                  type="date"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </label>
              <label className="text-xs font-bold uppercase text-slate-500">
                Check-out
                <input
                  type="date"
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </label>
              <label className="text-xs font-bold uppercase text-slate-500">
                Adults / room
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adultsPerRoom}
                  onChange={(e) => setAdultsPerRoom(Number(e.target.value) || 1)}
                />
              </label>
            </div>
            {availLoading && <p className="text-xs text-slate-500">Checking availability…</p>}

            {!fullTypePicker && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-indigo-800">Selected room type</p>
                <p className="mt-1 text-lg font-bold leading-snug text-slate-900 break-words">
                  {selectedCatalog?.name ?? selectedType?.name ?? "Room type"}
                </p>
                {selectedCatalog?.code ? (
                  <p className="text-xs font-mono text-slate-500">{selectedCatalog.code}</p>
                ) : null}
                {selectedType && selectedType.nights > 0 ? (
                  <p className="mt-2 text-sm text-slate-700">
                    <strong className={capacity > 0 ? "text-emerald-700" : "text-amber-700"}>{capacity}</strong>{" "}
                    available · {formatMoney(selectedType.base_price_per_night, selectedType.currency)}/ night ·{" "}
                    {formatMoney(selectedType.total_price, selectedType.currency)} per room (
                    {selectedType.nights} nights)
                  </p>
                ) : roomTypeId ? (
                  <div className="mt-2 text-sm text-amber-800 space-y-1">
                    <p>No sellable rooms for these dates — change dates or open all room types below.</p>
                    {selectedAvailHint ? <p className="text-xs">{selectedAvailHint}</p> : null}
                  </div>
                ) : null}
                <label className="mt-3 block text-xs font-bold uppercase text-slate-500">
                  Rooms to book
                  <input
                    type="number"
                    min={1}
                    max={40}
                    className="mt-1 w-full max-w-[12rem] min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono"
                    value={roomCount}
                    onChange={(e) => setRoomCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
                  />
                </label>
                {selectedType && nights > 0 ? (
                  <div className="mt-3 rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-sm">
                    <span className="font-semibold text-indigo-900">Total </span>
                    <span className="font-black text-slate-900">{formatMoney(blockStayTotal, quoteCurrency)}</span>
                    <span className="text-slate-500"> for {roomCount} room{roomCount === 1 ? "" : "s"}</span>
                  </div>
                ) : null}
                {selectedType ? (
                  <div
                    className={`mt-3 rounded-xl p-3 text-sm ${
                      canBookAll
                        ? "bg-emerald-50 text-emerald-900 border border-emerald-100"
                        : "bg-amber-50 text-amber-950 border border-amber-100"
                    }`}
                  >
                    {canBookAll && hasPositiveRoomRate ? (
                      <p className="font-semibold">Inventory OK for {roomCount} room(s).</p>
                    ) : canBookAll ? (
                      <p>Room rate is missing. Configure a positive rate before booking this block.</p>
                    ) : capacity > 0 ? (
                      <p>
                        Short by {shortfall}. Max now: <strong>{capacity}</strong>.
                      </p>
                    ) : (
                      <p>No rooms free for this type on these dates.</p>
                    )}
                    {!canBookAll && capacity > 0 && (
                      <button
                        type="button"
                        className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white"
                        onClick={() => setRoomCount(capacity)}
                      >
                        Set to {capacity} rooms
                      </button>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={() => setShowAllRoomTypes(true)}
                >
                  <ChevronDown className="h-4 w-4" />
                  Compare all room types
                </button>
              </div>
            )}

            {fullTypePicker && (
              <div className="border-t border-slate-100 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-600">Available room types</h3>
                  <div className="flex items-center gap-2">
                    {compactReserve && (
                      <button
                        type="button"
                        className="text-xs font-bold text-indigo-600 underline"
                        onClick={() => setShowAllRoomTypes(false)}
                      >
                        Collapse list
                      </button>
                    )}
                    <Link href={staffAppPath("room-types")} className="text-xs font-semibold text-indigo-600 underline">
                      Manage types
                    </Link>
                  </div>
                </div>
                {catalogTypes.length === 0 ? (
                  <p className="text-sm text-amber-800">
                    No room types configured.{" "}
                    <Link href={staffAppPath("room-types")} className="font-semibold underline">
                      Add room types
                    </Link>
                  </p>
                ) : availableCatalogTypes.length === 0 ? (
                  <div className="text-sm text-amber-800 space-y-2">
                    <p>
                      No room types with availability for these dates and party size. Change dates, adults per room, or
                      check room types.
                    </p>
                    {plannedAvail?.availability_hint ? (
                      <p className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-xs">
                        <strong>{plannedTypeName ?? "Planned type"}:</strong> {plannedAvail.availability_hint}
                      </p>
                    ) : null}
                    <p className="text-xs text-slate-600">
                      Rooms may exist but show as unavailable if they are out of order, already booked on these dates, not
                      ready for same-day check-in, or adults exceed max occupancy.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1">
                    {availableCatalogTypes.map((rt) => {
                      const a = availByTypeId.get(rt.id);
                      const selected = roomTypeId === rt.id;
                      const ready = a?.available_count ?? 0;
                      const isPlanned = group.preferredRoomTypeId === rt.id;
                      return (
                        <button
                          key={rt.id}
                          type="button"
                          onClick={() => setRoomTypeId(rt.id)}
                          className={`w-full rounded-xl border p-3 text-left transition sm:p-4 ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                              : "border-slate-200 bg-slate-50/80 hover:border-indigo-200 hover:bg-white"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900">{rt.name}</p>
                              {rt.code ? <p className="text-xs text-slate-500">{rt.code}</p> : null}
                            </div>
                            {isPlanned ? (
                              <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-black uppercase text-white">
                                Planned
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {a && a.nights > 0 ? (
                              <p>
                                {formatMoney(a.base_price_per_night, a.currency)}/night ·{" "}
                                {formatMoney(a.total_price, a.currency)} / room ({a.nights} nights)
                              </p>
                            ) : rt.baseRate != null ? (
                              <p>From {formatMoney(rt.baseRate, defaultCurrency)}/night (base)</p>
                            ) : null}
                            <p className="mt-1">
                              {a ? (
                                <strong className={ready > 0 ? "text-emerald-700" : "text-amber-700"}>{ready}</strong>
                              ) : (
                                <span className="text-slate-400">No availability</span>
                              )}{" "}
                              available
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                1
              </span>
              <CalendarRange className="h-5 w-5 text-indigo-600" />
              Dates & occupancy
            </div>
            <div className="grid gap-4 md:grid-cols-3">
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
              <label className="text-xs font-bold uppercase text-slate-500">
                Adults per room
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  value={adultsPerRoom}
                  onChange={(e) => setAdultsPerRoom(Number(e.target.value) || 1)}
                />
              </label>
            </div>
            {availLoading && <p className="text-xs text-slate-500">Checking availability…</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                  2
                </span>
                Room type
              </div>
              <Link href={staffAppPath("room-types")} className="text-xs font-semibold text-indigo-600 underline">
                Manage room types
              </Link>
            </div>
            <p className="text-xs text-slate-500">Only types with at least one available room for these dates are listed.</p>
            {catalogTypes.length === 0 ? (
              <p className="text-sm text-amber-800">
                No room types configured.{" "}
                <Link href={staffAppPath("room-types")} className="font-semibold underline">
                  Add room types
                </Link>{" "}
                first.
              </p>
            ) : availableCatalogTypes.length === 0 ? (
              <div className="text-sm text-amber-800 space-y-2">
                <p>
                  No room types with availability for these dates and party size. Adjust dates or adults per room, then
                  try again.
                </p>
                {plannedAvail?.availability_hint ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs">
                    <strong>{plannedTypeName ?? "Planned type"}:</strong> {plannedAvail.availability_hint}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {availableCatalogTypes.map((rt) => {
                  const a = availByTypeId.get(rt.id);
                  const selected = roomTypeId === rt.id;
                  const ready = a?.available_count ?? 0;
                  const isPlanned = group.preferredRoomTypeId === rt.id;
                  return (
                    <button
                      key={rt.id}
                      type="button"
                      onClick={() => setRoomTypeId(rt.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        selected
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                          : "border-slate-200 bg-slate-50/50 hover:border-indigo-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-slate-900">{rt.name}</p>
                          {rt.code ? <p className="text-xs text-slate-500">{rt.code}</p> : null}
                        </div>
                        {isPlanned ? (
                          <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black uppercase text-white">
                            Planned
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 space-y-1 text-sm">
                        {a && a.nights > 0 ? (
                          <p className="font-semibold text-slate-900">
                            {formatMoney(a.base_price_per_night, a.currency)}/night ·{" "}
                            {formatMoney(a.total_price, a.currency)} per room ({a.nights} nights)
                          </p>
                        ) : rt.baseRate != null ? (
                          <p className="text-slate-600">
                            From {formatMoney(rt.baseRate, defaultCurrency)}/night (base rate)
                          </p>
                        ) : null}
                        <p className="text-slate-600">
                          {a ? (
                            <>
                              <strong className={ready > 0 ? "text-emerald-700" : "text-amber-700"}>{ready}</strong>{" "}
                              available
                            </>
                          ) : (
                            <span className="text-slate-400">No availability for these dates</span>
                          )}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                3
              </span>
              <Layers className="h-5 w-5 text-indigo-600" />
              How many rooms?
            </div>
            <label className="text-xs font-bold uppercase text-slate-500">
              Rooms to book
              <input
                type="number"
                min={1}
                max={40}
                className="mt-1 w-full max-w-xs rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono"
                value={roomCount}
                onChange={(e) => setRoomCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))}
              />
            </label>
            {selectedType && nights > 0 ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 p-4 text-sm text-indigo-950">
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Price estimate</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-600">Per room / night</p>
                    <p className="text-lg font-black">{formatMoney(perRoomPerNight, quoteCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Per room (stay)</p>
                    <p className="text-lg font-black">{formatMoney(perRoomTotal, quoteCurrency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Block total ({roomCount} rooms)</p>
                    <p className="text-lg font-black text-indigo-800">{formatMoney(blockStayTotal, quoteCurrency)}</p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-600">
                  {nights} night{nights === 1 ? "" : "s"} · taxes/fees may apply at folio
                </p>
              </div>
            ) : null}
            {selectedType ? (
              <div
                className={`rounded-xl p-4 text-sm ${
                  canBookAll && hasPositiveRoomRate
                    ? "bg-emerald-50 text-emerald-900 border border-emerald-100"
                    : "bg-amber-50 text-amber-950 border border-amber-100"
                }`}
              >
                <div className="flex items-start gap-2">
                  {canBookAll && hasPositiveRoomRate ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                  )}
                  <div>
                    <p className="font-bold">
                      {capacity} {selectedType.name} room{capacity === 1 ? "" : "s"} available.
                    </p>
                    <p className="mt-1">
                      Booking <strong>{roomCount}</strong>.{" "}
                      {canBookAll && hasPositiveRoomRate
                        ? nights > 0
                          ? `Ready to book · ${formatMoney(blockStayTotal, quoteCurrency)} estimated stay total.`
                          : "Ready to book."
                        : canBookAll
                          ? "Room rate is missing. Configure a positive room type or nightly rate before booking."
                        : capacity > 0
                          ? `Short by ${shortfall}. Book ${capacity} now or change dates/type.`
                          : "Pick different dates or another room type."}
                    </p>
                  </div>
                </div>
                {!canBookAll && capacity > 0 && (
                  <button
                    type="button"
                    className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow hover:bg-amber-700"
                    onClick={() => setRoomCount(capacity)}
                  >
                    Book {capacity} rooms (max available)
                  </button>
                )}
              </div>
            ) : roomTypeId ? (
              <p className="text-xs text-amber-700">This room type has no availability for the selected dates.</p>
            ) : (
              <p className="text-xs text-slate-500">Select a room type above.</p>
            )}
          </section>
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          {!compactReserve && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
              4
            </span>
          )}
          <Users className="h-5 w-5 text-indigo-600" />
          Lead guest
        </div>
        <p className="text-xs text-slate-500">
          Optional — search a coordinator to attach to every folio. If you skip this, the system creates a placeholder
          guest from the group&apos;s contact / name for billing.
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
            {guestSearchLoading ? "Searching…" : "Search"}
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
        {leadGuestId ? (
          <p className="text-xs font-semibold text-emerald-700">Lead guest selected — used for every room in this block.</p>
        ) : (
          <p className="text-xs text-slate-500">No lead guest selected — booking will use the group placeholder profile.</p>
        )}
      </section>

      {!compactReserve && (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-700">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <Zap className="h-4 w-4 text-amber-500" />
          Need a different mix?
        </div>
        <p className="mt-2">
          Book what fits now, then run another pass for a second room type. Or{" "}
          <Link href={newReservationHref} className="font-semibold text-indigo-600 underline">
            book one room at a time
          </Link>{" "}
          with individual guest profiles.
        </p>
      </section>
      )}

      {banner && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            banner.kind === "ok"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-100"
              : "bg-rose-50 text-rose-800 border border-rose-100"
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={submitting || !canBookAll || !hasPositiveRoomRate}
          onClick={() => void submitBlock()}
          className="rounded-2xl bg-indigo-600 px-8 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-indigo-200 disabled:opacity-40"
        >
          {submitting
            ? "Booking…"
            : selectedType && nights > 0
              ? `Book ${roomCount} room${roomCount === 1 ? "" : "s"} · ${formatMoney(blockStayTotal, quoteCurrency)}`
              : `Book ${roomCount} room${roomCount === 1 ? "" : "s"}`}
        </button>
        <Link
          href={newReservationHref}
          className="inline-flex items-center rounded-2xl border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
        >
          Book one room
        </Link>
      </div>

      {blockResult && blockResult.reservations?.length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <h3 className="font-black text-emerald-900">Block booked</h3>
          {blockResult.message ? (
            <p className="mt-2 text-sm text-emerald-900/90">{blockResult.message}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={staffAppPath("groups", groupId)}
              className="inline-flex rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
            >
              Group → Rooms tab (check in all)
            </Link>
            <Link
              href={staffAppPath("groups", groupId)}
              className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-slate-50"
            >
              Group → Billing
            </Link>
          </div>
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
