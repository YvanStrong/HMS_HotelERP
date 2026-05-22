"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Building2, CalendarRange, Copy, CreditCard, Crown, Plus, Users } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { useHotelContext } from "@/lib/useHotelContext";
import { staffAppPath } from "@/lib/staffAppRoutes";

type CorporateRow = {
  id: string;
  companyName: string;
  billingEmail: string | null;
  creditLimit: number | null;
  paymentTerms: string | null;
  status: string;
  createdAt?: string;
};

/** Matches {@code ApiDtos.GroupBillingDashboardResponse} JSON (mixed camelCase + snake_case). */
type BillingDashboard = {
  groupId: string;
  groupName: string;
  groupCode: string | null;
  billing_preference: string | null;
  corporateAccount: {
    id: string;
    companyName: string;
    billingEmail: string | null;
    creditLimit: number;
    paymentTerms: string | null;
    status: string;
  } | null;
  masterFolio: {
    reservationId: string;
    confirmationCode: string;
    guest_name: string;
    balance_due: number | string;
    currency: string;
  } | null;
  members: Array<{
    reservationId: string;
    confirmationCode: string;
    guest_name: string;
    room_number: string;
    status: string;
    folio_balance_due: number | string;
    is_master: boolean;
  }>;
};

type GroupBookingDetail = {
  id: string;
  groupName: string;
  groupCode?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: string;
  expectedGuests?: number | null;
  roomsNeeded?: number | null;
  targetCheckIn?: string | string[] | null;
  targetCheckOut?: string | string[] | null;
  eventType?: string | null;
  roomMixSummary?: string | null;
  billingPreference?: string | null;
  preferredRoomTypeId?: string | null;
  notes?: string | null;
};

type RoomTypeOption = {
  id: string;
  name: string;
  code?: string;
  baseRate?: number;
};

type PickupDashboard = {
  groupId: string;
  groupName: string;
  contractedRooms: number;
  pickedUpRooms: number;
  remainingRooms: number;
  releasedRooms: number;
  washedRooms: number;
  pickupPercent: number;
  allotments: Array<{
    id: string;
    roomTypeId: string;
    roomTypeName: string;
    allotmentDate: string;
    contractedRooms: number;
    pickedUpRooms: number;
    releasedRooms: number;
    washedRooms: number;
    rateAmount: number | null;
    releaseDate: string | null;
    status: string;
  }>;
};

type RoomingEntry = {
  id: string;
  reservationId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  checkInDate: string;
  checkOutDate: string;
  roomTypeId?: string | null;
  roomTypeName?: string | null;
  roomNumber?: string | null;
  adults: number;
  children: number;
  paymentResponsibility?: string | null;
  sharingKey?: string | null;
  status: string;
};

function toMoney(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function formatYmd(v: string | string[] | null | undefined): string {
  if (v == null) return "—";
  if (Array.isArray(v) && v.length >= 3) {
    const [y, m, d] = v;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  return "—";
}

export default function GroupBillingDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const { hotel } = useHotelContext(hotelId);
  const hotelCurrency = hotel?.currency ?? "";

  const [dash, setDash] = useState<BillingDashboard | null>(null);
  const [group, setGroup] = useState<GroupBookingDetail | null>(null);
  const [corporate, setCorporate] = useState<CorporateRow[]>([]);
  const [pickup, setPickup] = useState<PickupDashboard | null>(null);
  const [roomingEntries, setRoomingEntries] = useState<RoomingEntry[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterId, setMasterId] = useState("");
  const [corpId, setCorpId] = useState("");
  const [pref, setPref] = useState("MASTER_PAYS_ALL");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [showNewCorp, setShowNewCorp] = useState(false);
  const [newCorpCompany, setNewCorpCompany] = useState("");
  const [newCorpEmail, setNewCorpEmail] = useState("");
  const [newCorpLimit, setNewCorpLimit] = useState("");
  const [newCorpTerms, setNewCorpTerms] = useState("");
  const [newCorpStatus, setNewCorpStatus] = useState("ACTIVE");
  const [creatingCorp, setCreatingCorp] = useState(false);
  const [allotmentRoomTypeId, setAllotmentRoomTypeId] = useState("");
  const [allotmentFrom, setAllotmentFrom] = useState("");
  const [allotmentTo, setAllotmentTo] = useState("");
  const [allotmentRooms, setAllotmentRooms] = useState("");
  const [allotmentRate, setAllotmentRate] = useState("");
  const [allotmentRelease, setAllotmentRelease] = useState("");
  const [roomingGuestName, setRoomingGuestName] = useState("");
  const [roomingGuestEmail, setRoomingGuestEmail] = useState("");

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [d, g, c, p, r, types] = await Promise.all([
        apiFetch<BillingDashboard>(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing-dashboard`),
        apiFetch<GroupBookingDetail>(`/api/v1/hotels/${hotelId}/groups/${groupId}`),
        apiFetch<CorporateRow[]>(`/api/v1/hotels/${hotelId}/corporate-accounts`).catch(() => [] as CorporateRow[]),
        apiFetch<PickupDashboard>(`/api/v1/hotels/${hotelId}/groups/${groupId}/pickup-dashboard`).catch(() => null),
        apiFetch<RoomingEntry[]>(`/api/v1/hotels/${hotelId}/groups/${groupId}/rooming-list-entries`).catch(
          () => [] as RoomingEntry[],
        ),
        apiFetch<RoomTypeOption[]>(`/api/v1/hotels/${hotelId}/room-types`).catch(() => [] as RoomTypeOption[]),
      ]);
      setDash(d);
      setGroup(g);
      setCorporate(Array.isArray(c) ? c : []);
      setPickup(p);
      setRoomingEntries(Array.isArray(r) ? r : []);
      setRoomTypes(Array.isArray(types) ? types : []);
      setAllotmentRoomTypeId((prev) => prev || g.preferredRoomTypeId || types?.[0]?.id || "");
      setAllotmentFrom((prev) => prev || formatYmd(g.targetCheckIn));
      setAllotmentTo((prev) => prev || formatYmd(g.targetCheckOut));
      setAllotmentRooms((prev) => prev || (g.roomsNeeded != null ? String(g.roomsNeeded) : ""));
      const billing =
        d.billing_preference?.trim() ||
        (typeof g.billingPreference === "string" ? g.billingPreference.trim() : "") ||
        "MASTER_PAYS_ALL";
      setPref(billing || "MASTER_PAYS_ALL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load group");
      setDash(null);
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBilling() {
    setSaving(true);
    setBanner(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        billing_preference: pref || null,
      };
      if (masterId.trim()) {
        body.master_reservation_id = masterId.trim();
      }
      if (corpId === "__clear__") {
        body.clear_corporate_account = true;
      } else if (corpId) {
        body.corporate_account_id = corpId;
      }
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMasterId("");
      setCorpId("");
      setBanner("Billing settings saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearMasterLink() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify({ clear_master_reservation: true }),
      });
      setBanner("Master link cleared.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear master");
    } finally {
      setSaving(false);
    }
  }

  async function linkMasterReservation(reservationId: string) {
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify({ master_reservation_id: reservationId }),
      });
      setMasterId("");
      setBanner("Master folio linked to this group.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set master reservation");
    } finally {
      setSaving(false);
    }
  }

  async function createCorporateAndLink() {
    const name = newCorpCompany.trim();
    if (!name) {
      setError("Company name is required to create a corporate account.");
      return;
    }
    setCreatingCorp(true);
    setError(null);
    setBanner(null);
    try {
      const limitRaw = newCorpLimit.trim();
      const creditLimitParsed =
        limitRaw === "" ? null : Number.parseFloat(limitRaw.replace(",", "."));
      const creditLimit =
        creditLimitParsed != null && Number.isFinite(creditLimitParsed) ? creditLimitParsed : null;

      const created = await apiFetch<CorporateRow>(`/api/v1/hotels/${hotelId}/corporate-accounts`, {
        method: "POST",
        body: JSON.stringify({
          companyName: name,
          billingEmail: newCorpEmail.trim() || null,
          creditLimit,
          paymentTerms: newCorpTerms.trim() || null,
          status: newCorpStatus.trim() || "ACTIVE",
        }),
      });

      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify({ corporate_account_id: created.id }),
      });

      setNewCorpCompany("");
      setNewCorpEmail("");
      setNewCorpLimit("");
      setNewCorpTerms("");
      setNewCorpStatus("ACTIVE");
      setShowNewCorp(false);
      setCorpId("");
      setBanner("Corporate account created and linked to this group.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create corporate account");
    } finally {
      setCreatingCorp(false);
    }
  }

  async function createCorporateOnly() {
    const name = newCorpCompany.trim();
    if (!name) {
      setError("Company name is required to create a corporate account.");
      return;
    }
    setCreatingCorp(true);
    setError(null);
    setBanner(null);
    try {
      const limitRaw = newCorpLimit.trim();
      const creditLimitParsed =
        limitRaw === "" ? null : Number.parseFloat(limitRaw.replace(",", "."));
      const creditLimit =
        creditLimitParsed != null && Number.isFinite(creditLimitParsed) ? creditLimitParsed : null;

      await apiFetch<CorporateRow>(`/api/v1/hotels/${hotelId}/corporate-accounts`, {
        method: "POST",
        body: JSON.stringify({
          companyName: name,
          billingEmail: newCorpEmail.trim() || null,
          creditLimit,
          paymentTerms: newCorpTerms.trim() || null,
          status: newCorpStatus.trim() || "ACTIVE",
        }),
      });

      setNewCorpCompany("");
      setNewCorpEmail("");
      setNewCorpLimit("");
      setNewCorpTerms("");
      setNewCorpStatus("ACTIVE");
      setShowNewCorp(false);
      setBanner("Corporate account created. Link it below if needed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create corporate account");
    } finally {
      setCreatingCorp(false);
    }
  }

  async function saveAllotment() {
    if (!allotmentRoomTypeId || !allotmentFrom || !allotmentTo || !allotmentRooms) {
      setError("Room type, date range, and contracted rooms are required for an allotment.");
      return;
    }
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const rate = allotmentRate.trim() ? Number(allotmentRate) : null;
      const updated = await apiFetch<PickupDashboard>(`/api/v1/hotels/${hotelId}/groups/${groupId}/allotments`, {
        method: "POST",
        body: JSON.stringify({
          roomTypeId: allotmentRoomTypeId,
          fromDate: allotmentFrom,
          toDate: allotmentTo,
          contractedRooms: Number(allotmentRooms) || 0,
          rateAmount: Number.isFinite(rate) ? rate : null,
          releaseDate: allotmentRelease || null,
        }),
      });
      setPickup(updated);
      setBanner("Group allotment saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save allotment");
    } finally {
      setSaving(false);
    }
  }

  async function addRoomingEntry() {
    if (!roomingGuestName.trim()) {
      setError("Guest name is required for rooming list.");
      return;
    }
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const rows = await apiFetch<RoomingEntry[]>(`/api/v1/hotels/${hotelId}/groups/${groupId}/rooming-list-entries`, {
        method: "POST",
        body: JSON.stringify({
          guestName: roomingGuestName.trim(),
          guestEmail: roomingGuestEmail.trim() || null,
          checkInDate: allotmentFrom || formatYmd(group?.targetCheckIn),
          checkOutDate: allotmentTo || formatYmd(group?.targetCheckOut),
          roomTypeId: allotmentRoomTypeId || null,
          adults: 1,
          children: 0,
          paymentResponsibility: "GUEST",
          status: "DRAFT",
        }),
      });
      setRoomingEntries(rows);
      setRoomingGuestName("");
      setRoomingGuestEmail("");
      setBanner("Rooming list entry added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add rooming list entry");
    } finally {
      setSaving(false);
    }
  }

  const displayPref =
    dash?.billing_preference?.trim() ||
    group?.billingPreference?.trim() ||
    null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/80 via-background to-muted/20 pb-16">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">
              <Link href={staffAppPath("groups")} className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
                ← Groups
              </Link>
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Group billing & routing</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Master folio receives routed charges per preference. Members cannot check out while the master folio still
              owes (unless a manager overrides checkout on the reservation).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={staffAppPath("groups", groupId, "reserve")}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Book / extend block
            </Link>
            <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-sm">
            {error}
          </div>
        )}
        {banner && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-sm">
            {banner}
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && group && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-md ring-1 ring-slate-200/50">
            <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
                    <Users className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-700">Group overview</p>
                    <h2 className="truncate text-2xl font-bold text-slate-900">{group.groupName}</h2>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{group.groupCode || "—"}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-700 ring-1 ring-slate-200">
                  {group.status.replaceAll("_", " ")}
                </span>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3 sm:p-6">
              <div className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <div className="text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Target stay</p>
                  <p className="font-semibold text-slate-900">
                    {formatYmd(group.targetCheckIn)} → {formatYmd(group.targetCheckOut)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {group.expectedGuests != null ? `${group.expectedGuests} guests expected` : "Guests TBD"} ·{" "}
                    {group.roomsNeeded != null ? `${group.roomsNeeded} rooms targeted` : "Rooms TBD"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <div className="text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Event & mix</p>
                  <p className="font-semibold text-slate-900">
                    {group.eventType ? group.eventType.replaceAll("_", " ") : "—"}
                  </p>
                  {group.roomMixSummary ? (
                    <p className="mt-1 text-xs text-muted-foreground">{group.roomMixSummary}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No room mix notes</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:col-span-2 lg:col-span-1">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Contact</p>
                  <p className="truncate font-semibold text-slate-900">{group.contactPerson || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{group.contactEmail || "—"}</p>
                  <p className="text-xs text-muted-foreground">{group.contactPhone || "—"}</p>
                </div>
              </div>
            </div>
            {group.notes ? (
              <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-700 sm:px-6">
                <span className="font-semibold text-slate-500">Notes: </span>
                {group.notes}
              </div>
            ) : null}
          </div>
        )}

        {!loading && group && (
          <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
            <section className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black text-slate-900">Allotment pickup</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Contract rooms by date and room type, then track picked-up, remaining, released, and washed rooms.
                  </p>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase text-indigo-700">Pickup</p>
                  <p className="text-xl font-black text-indigo-950">{Number(pickup?.pickupPercent ?? 0).toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                {[
                  ["Contracted", pickup?.contractedRooms ?? 0],
                  ["Picked up", pickup?.pickedUpRooms ?? 0],
                  ["Remaining", pickup?.remainingRooms ?? 0],
                  ["Released", pickup?.releasedRooms ?? 0],
                  ["Washed", pickup?.washedRooms ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-bold uppercase text-slate-500">{label}</p>
                    <p className="text-xl font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Room type
                  <select className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={allotmentRoomTypeId} onChange={(e) => setAllotmentRoomTypeId(e.target.value)}>
                    <option value="">Select type</option>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>{rt.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  From
                  <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" type="date" value={allotmentFrom === "—" ? "" : allotmentFrom} onChange={(e) => setAllotmentFrom(e.target.value)} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  To
                  <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" type="date" value={allotmentTo === "—" ? "" : allotmentTo} onChange={(e) => setAllotmentTo(e.target.value)} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Contracted rooms
                  <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" type="number" min={0} value={allotmentRooms} onChange={(e) => setAllotmentRooms(e.target.value)} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Group rate
                  <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" type="number" min={0} value={allotmentRate} onChange={(e) => setAllotmentRate(e.target.value)} />
                </label>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Release date
                  <input className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" type="date" value={allotmentRelease} onChange={(e) => setAllotmentRelease(e.target.value)} />
                </label>
              </div>
              <button type="button" className="mt-4 hms-btn-solid text-sm" disabled={saving} onClick={() => void saveAllotment()}>
                Save allotment
              </button>
              {pickup?.allotments?.length ? (
                <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-100">
                  {pickup.allotments.slice(0, 12).map((a) => (
                    <div key={a.id} className="grid gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-0 sm:grid-cols-4">
                      <strong>{a.allotmentDate}</strong>
                      <span>{a.roomTypeName}</span>
                      <span>{a.pickedUpRooms}/{a.contractedRooms} picked</span>
                      <span className="text-slate-500">Release {a.releaseDate ?? "—"}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-black text-slate-900">Rooming list</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Draft attendee rows before turning them into individual reservations.
              </p>
              <div className="mt-4 grid gap-3">
                <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={roomingGuestName} onChange={(e) => setRoomingGuestName(e.target.value)} placeholder="Guest name" />
                <input className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={roomingGuestEmail} onChange={(e) => setRoomingGuestEmail(e.target.value)} placeholder="Guest email" />
                <button type="button" className="hms-btn-outline text-sm" disabled={saving} onClick={() => void addRoomingEntry()}>
                  Add draft rooming entry
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {roomingEntries.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-slate-900">{entry.guestName}</strong>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">{entry.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {entry.checkInDate} → {entry.checkOutDate} · {entry.roomTypeName ?? "Room type TBD"}
                    </p>
                    {entry.reservationId ? (
                      <Link className="mt-2 inline-flex text-xs font-bold text-indigo-600 underline" href={staffAppPath("reservations", entry.reservationId)}>
                        Open reservation
                      </Link>
                    ) : null}
                  </div>
                ))}
                {!roomingEntries.length ? (
                  <p className="text-sm text-muted-foreground">No rooming list rows yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        )}

        {!loading && dash && (
          <>
            <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Billing snapshot</h3>
              <p className="mt-2 text-sm text-slate-700">
                Active preference:{" "}
                <span className="font-bold text-slate-900">
                  {displayPref ? displayPref.replaceAll("_", " ") : "Not set"}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This is stored on the group and drives how room charges route to the master folio (when linked).
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
                <h3 className="mb-2 text-sm font-bold text-slate-900">Master folio</h3>
                {dash.masterFolio ? (
                  <>
                    <p className="text-sm text-slate-800">
                      {dash.masterFolio.guest_name} ·{" "}
                      <span className="font-mono text-xs">{dash.masterFolio.confirmationCode}</span>
                    </p>
                    <p className="mt-3 text-2xl font-black text-rose-600 tabular-nums">
                      {toMoney(dash.masterFolio.balance_due).toFixed(2)} {dash.masterFolio.currency}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Balance due on consolidated bill</p>
                    <Link
                      href={staffAppPath("reservations", dash.masterFolio.reservationId)}
                      className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm hover:bg-slate-50"
                    >
                      Open master reservation
                    </Link>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No master reservation linked yet. Use a member below, quick picks, or paste a reservation UUID
                      that already belongs to this group.
                    </p>
                    {dash.members.length > 0 ? (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick set master</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {dash.members.slice(0, 8).map((m) => (
                            <button
                              key={m.reservationId}
                              type="button"
                              disabled={saving || m.is_master}
                              onClick={() => void linkMasterReservation(m.reservationId)}
                              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/80 px-2.5 py-1.5 text-left text-xs font-semibold text-indigo-900 shadow-sm hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title={m.reservationId}
                            >
                              <Crown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">
                                {m.guest_name?.trim() || "Guest"} · {m.room_number?.trim() || "—"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800">
                        No member reservations yet. Use <strong>Book / extend block</strong> above, then return here.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
                <h3 className="mb-2 text-sm font-bold text-slate-900">Corporate account</h3>
                {dash.corporateAccount ? (
                  <>
                    <p className="font-semibold text-slate-900">{dash.corporateAccount.companyName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Invoicing / AR contact for this group. <strong>Billing email</strong> is where statements go.
                    </p>
                    <p className="mt-1 text-xs text-slate-700">{dash.corporateAccount.billingEmail || "—"}</p>
                    <p className="mt-2 text-xs text-slate-600">
                      <strong>Credit limit</strong>: max open balance the hotel allows on account ({toMoney(dash.corporateAccount.creditLimit).toFixed(2)}).{" "}
                      <strong>Terms</strong>: {dash.corporateAccount.paymentTerms || "—"} (payment window label, e.g.{" "}
                      <span className="whitespace-nowrap">&quot;30&quot;</span> = net 30 days).
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      None linked. Create a company profile here, or pick an existing account in{" "}
                      <strong>Configure routing</strong> below.
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-slate-50"
                      onClick={() => {
                        setNewCorpCompany(group?.companyName?.trim() ?? "");
                        setNewCorpEmail(group?.contactEmail?.trim() ?? "");
                        setShowNewCorp(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      New corporate account
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">Corporate accounts</h3>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 shadow-sm hover:bg-slate-50"
                  onClick={() => {
                    setNewCorpCompany(group?.companyName?.trim() ?? "");
                    setNewCorpEmail(group?.contactEmail?.trim() ?? "");
                    setShowNewCorp((v) => !v);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {showNewCorp ? "Hide form" : "Create account"}
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Creates a hotel-level company billing profile. You can link it to this group only, or create &amp; link
                in one step.
              </p>
              {showNewCorp ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
                    Company name <span className="text-rose-600">*</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                      value={newCorpCompany}
                      onChange={(e) => setNewCorpCompany(e.target.value)}
                      placeholder="e.g. Acme Events Ltd"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Billing email
                    <input
                      type="email"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                      value={newCorpEmail}
                      onChange={(e) => setNewCorpEmail(e.target.value)}
                      placeholder="ap@company.com"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Credit limit ({hotelCurrency || "amount"})
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                      value={newCorpLimit}
                      onChange={(e) => setNewCorpLimit(e.target.value)}
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600 sm:col-span-2">
                    Payment terms
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                      value={newCorpTerms}
                      onChange={(e) => setNewCorpTerms(e.target.value)}
                      placeholder="e.g. Net 30"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-600">
                    Status
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner"
                      value={newCorpStatus}
                      onChange={(e) => setNewCorpStatus(e.target.value)}
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
                    <button
                      type="button"
                      className="hms-btn-solid text-sm"
                      disabled={creatingCorp}
                      onClick={() => void createCorporateAndLink()}
                    >
                      {creatingCorp ? "Working…" : "Create & link to this group"}
                    </button>
                    <button
                      type="button"
                      className="hms-btn-outline text-sm"
                      disabled={creatingCorp}
                      onClick={() => void createCorporateOnly()}
                    >
                      Create only
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
              <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3 sm:px-6">
                <h3 className="text-sm font-bold text-slate-900">Member reservations</h3>
                <p className="text-xs text-muted-foreground">
                  {dash.members.length} reservation{dash.members.length === 1 ? "" : "s"} linked to this group
                </p>
              </div>
              <div className="overflow-x-auto p-2 sm:p-0">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Guest</th>
                      <th className="px-4 py-3">Confirmation</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Folio due</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dash.members.map((m) => {
                      const due = toMoney(m.folio_balance_due);
                      const cur = dash.masterFolio?.currency || hotelCurrency;
                      return (
                        <tr key={m.reservationId} className="border-t border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 font-mono text-slate-900">{m.room_number?.trim() || "—"}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-900">
                            {m.guest_name?.trim() || "—"}
                            {m.is_master ? (
                              <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-indigo-800">
                                Master
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{m.confirmationCode}</td>
                          <td className="px-4 py-2.5 text-slate-700">{m.status.replaceAll("_", " ")}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                            {due.toFixed(2)}
                            {cur ? ` ${cur}` : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50"
                                title="Copy reservation ID"
                                onClick={() => void navigator.clipboard.writeText(m.reservationId)}
                              >
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                              </button>
                              {!m.is_master ? (
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void linkMasterReservation(m.reservationId)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-900 hover:bg-indigo-100 disabled:opacity-50"
                                >
                                  <Crown className="h-3 w-3" aria-hidden />
                                  Set master
                                </button>
                              ) : null}
                              <Link
                                href={staffAppPath("reservations", m.reservationId)}
                                className="inline-flex rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-slate-50"
                              >
                                Folio
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Configure routing</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Link a master reservation that is already in this group. Post room nights and routed charges to the
                master folio; incidentals stay on members when the preference says so.
              </p>
              <label className="block text-xs font-semibold text-muted-foreground">
                Master reservation ID
                <input
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs shadow-inner"
                  placeholder="UUID (reservation must belong to this group)"
                  value={masterId}
                  onChange={(e) => setMasterId(e.target.value)}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Tip: use <strong>Set master</strong> on a member row or the quick picks above — no need to paste the
                UUID unless you prefer.
              </p>
              <label className="block text-xs font-semibold text-muted-foreground">
                Corporate account
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner"
                  value={corpId}
                  onChange={(e) => setCorpId(e.target.value)}
                >
                  <option value="">— keep / no change —</option>
                  <option value="__clear__">Clear link</option>
                  {corporate.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.companyName}
                      {" · "}
                      {a.id.slice(0, 8)}…
                      {a.billingEmail ? ` · ${a.billingEmail}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                Billing preference
                <select
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-inner"
                  value={pref}
                  onChange={(e) => setPref(e.target.value)}
                >
                  <option value="MASTER_PAYS_ALL">MASTER_PAYS_ALL</option>
                  <option value="SPLIT_BILLING">SPLIT_BILLING</option>
                  <option value="GUEST_PAYS_INCIDENTALS">GUEST_PAYS_INCIDENTALS</option>
                </select>
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="hms-btn-solid text-sm"
                  disabled={saving}
                  onClick={() => void saveBilling()}
                >
                  {saving ? "Saving…" : "Save billing"}
                </button>
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  disabled={saving}
                  onClick={() => void clearMasterLink()}
                >
                  Clear master link
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
