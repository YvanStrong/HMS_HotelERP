"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Building2, CalendarRange, Copy, CreditCard, Crown, Plus, Users } from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { GroupEventPackagesTab } from "@/components/groups/GroupEventPackagesTab";
import { type EventBillingSummary, type EventListItem, money } from "@/lib/eventApi";
import { useHotelContext } from "@/lib/useHotelContext";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  BEO_COPY,
  BILLING_COPY,
  GROUP_TABS,
  beoStatusHint,
  formatBeoStatus,
  formatQuoteStatus,
  quoteStatusHint,
} from "@/lib/groupEventsCopy";

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

type GroupTab = "overview" | "rooms" | "events" | "packages" | "beo" | "billing";

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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace("T", " ").slice(0, 16);
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function eventStatusClass(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "CANCELLED":
      return "bg-rose-100 text-rose-800 ring-rose-200";
    default:
      return "bg-amber-100 text-amber-800 ring-amber-200";
  }
}

export default function GroupBillingDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const { hotel } = useHotelContext(hotelId);
  const hotelCurrency = hotel?.currency ?? "";

  const [dash, setDash] = useState<BillingDashboard | null>(null);
  const [group, setGroup] = useState<GroupBookingDetail | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [eventBilling, setEventBilling] = useState<EventBillingSummary | null>(null);
  const [corporate, setCorporate] = useState<CorporateRow[]>([]);
  const [activeTab, setActiveTab] = useState<GroupTab>("overview");
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

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [d, g, c, ev, eb] = await Promise.all([
        apiFetch<BillingDashboard>(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing-dashboard`),
        apiFetch<GroupBookingDetail>(`/api/v1/hotels/${hotelId}/groups/${groupId}`),
        apiFetch<CorporateRow[]>(`/api/v1/hotels/${hotelId}/corporate-accounts`).catch(() => [] as CorporateRow[]),
        apiFetch<EventListItem[]>(`/api/v1/hotels/${hotelId}/groups/${groupId}/events`).catch(() => [] as EventListItem[]),
        apiFetch<EventBillingSummary>(`/api/v1/hotels/${hotelId}/groups/${groupId}/event-billing-summary`, { quiet: true }).catch(() => null),
      ]);
      setDash(d);
      setGroup(g);
      setCorporate(Array.isArray(c) ? c : []);
      setEvents(Array.isArray(ev) ? ev : []);
      setEventBilling(eb);
      const billing =
        d.billing_preference?.trim() ||
        (typeof g.billingPreference === "string" ? g.billingPreference.trim() : "") ||
        "MASTER_PAYS_ALL";
      setPref(billing || "MASTER_PAYS_ALL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load group");
      setDash(null);
      setGroup(null);
      setEvents([]);
      setEventBilling(null);
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

  async function postEventCharges(eventId: string) {
    if (!dash?.masterFolio) {
      setError(BILLING_COPY.postRequiresMaster);
      return;
    }
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(
        `/api/v1/hotels/${hotelId}/groups/${groupId}/events/${eventId}/quote/post-charges`,
        { method: "POST" },
      );
      setBanner("Function charges posted to the master guest bill.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post charges");
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
      setBanner("Master guest bill linked to this group.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set master reservation");
    } finally {
      setSaving(false);
    }
  }

  async function checkInMember(reservationId: string) {
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ guest_id_verified: true }),
      });
      setBanner("Guest checked in.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setSaving(false);
    }
  }

  async function checkInAllConfirmed() {
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      const res = await apiFetch<{
        attempted: number;
        checked_in?: number;
        checkedIn?: number;
        failures?: Array<{ confirmationCode?: string; message?: string }>;
      }>(`/api/v1/hotels/${hotelId}/groups/${groupId}/check-in-all`, { method: "POST" });
      const checkedIn = res.checked_in ?? res.checkedIn ?? 0;
      const failures = res.failures ?? [];
      if (failures.length > 0) {
        const detail = failures
          .map((f) => `${f.confirmationCode ?? "—"}: ${f.message ?? "failed"}`)
          .join("; ");
        setError(`${failures.length} room(s) could not check in — ${detail}`);
      }
      setBanner(`Checked in ${checkedIn} of ${res.attempted} confirmed room(s).`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk check-in failed");
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
              The master guest bill receives routed charges per preference. Members cannot check out while the master bill
              still has a balance (unless a manager overrides checkout on the reservation).
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
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {(
              [
                ["overview", GROUP_TABS.overview],
                ["rooms", GROUP_TABS.rooms],
                ["events", GROUP_TABS.events],
                ["packages", GROUP_TABS.packages],
                ["beo", GROUP_TABS.beo],
                ["billing", GROUP_TABS.billing],
              ] as const
            ).map(([key, tab]) => (
              <button
                key={key}
                type="button"
                title={tab.hint}
                onClick={() => setActiveTab(key as GroupTab)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeTab === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {!loading && group && activeTab === "overview" && (
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

        {!loading && dash && activeTab === "rooms" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-4 sm:px-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Rooming list</h3>
                <p className="text-xs text-muted-foreground">
                  {dash.members.length} reservation{dash.members.length === 1 ? "" : "s"} linked to this group
                  {dash.masterFolio
                    ? ` · Master bill: room ${dash.members.find((x) => x.is_master)?.room_number?.trim() || dash.masterFolio.confirmationCode}`
                    : " · No master guest bill yet"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {dash.members.some((m) => m.status === "CONFIRMED") ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void checkInAllConfirmed()}
                    className="inline-flex rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
                    title="Check in every confirmed room on this list (ID verified as a group action)."
                  >
                    {BILLING_COPY.roomsCheckInAll} (
                    {dash.members.filter((m) => m.status === "CONFIRMED").length})
                  </button>
                ) : null}
                {!dash.masterFolio && dash.members.length > 0 ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void linkMasterReservation(dash.members[0].reservationId)}
                    className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-900 shadow-sm hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Crown className="h-3.5 w-3.5" aria-hidden />
                    {BILLING_COPY.roomsSetMaster}
                  </button>
                ) : null}
                <Link
                  href={staffAppPath("groups", groupId, "reserve")}
                  className="inline-flex rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-indigo-700 shadow-sm hover:bg-slate-50"
                >
                  Book / extend block
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto p-2 sm:p-0">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Room</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Confirmation</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.members.map((m) => (
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
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {m.status === "CONFIRMED" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void checkInMember(m.reservationId)}
                              className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              {BILLING_COPY.roomsCheckInOne}
                            </button>
                          ) : null}
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
                            Open guest bill
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {dash.members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                        No rooms are linked yet. Start with Book / extend block.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && group && activeTab === "events" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h3 className="text-lg font-black text-slate-900">Functions schedule</h3>
                <p className="text-sm text-muted-foreground">
                  Track conferences, weddings, galas, meetings, and other functions attached to this group.
                </p>
              </div>
              <Link href={staffAppPath("groups", groupId, "events/new")} className="hms-btn-solid text-sm">
                New function
              </Link>
            </div>
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                <p className="font-semibold text-slate-900">No events added yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first banquet/event function and select a facility venue if applicable.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {events.map((row) => {
                  const event = row.event;
                  const venue = event.venueName || "Venue TBD";
                  const canGenBeo =
                    !row.beoStatus &&
                    (row.quoteStatus === "SENT" ||
                      row.quoteStatus === "ACCEPTED" ||
                      row.quoteStatus === "CONTRACTED");
                  return (
                    <div
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <Link
                        href={staffAppPath("groups", groupId, "events", event.id)}
                        className="block transition hover:opacity-90"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                              {event.eventType.replaceAll("_", " ")}
                            </p>
                            <h4 className="mt-1 text-lg font-black text-slate-900">{event.eventName}</h4>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ring-1 ${eventStatusClass(event.status)}`}>
                            {event.status.replaceAll("_", " ")}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-2 text-sm text-slate-700">
                          <p>
                            <strong>Date/time:</strong> {formatDateTime(event.startDatetime)} → {formatDateTime(event.endDatetime)}
                          </p>
                          <p><strong>Venue:</strong> {venue}</p>
                          <p>
                            <strong>Guests:</strong>{" "}
                            {event.guaranteedPax != null
                              ? `${event.guaranteedPax} guaranteed`
                              : event.expectedPax != null
                                ? `${event.expectedPax} expected`
                                : "TBD"}
                          </p>
                        </div>
                      </Link>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                        {row.quoteStatus ? (
                          <span
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                            title={quoteStatusHint(row.quoteStatus)}
                          >
                            Quote: {formatQuoteStatus(row.quoteStatus)}
                          </span>
                        ) : null}
                        {row.beoStatus ? (
                          <Link
                            href={staffAppPath("groups", groupId, "events", event.id, "beo")}
                            className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800"
                            title={beoStatusHint(row.beoStatus)}
                          >
                            Banquet order: {formatBeoStatus(row.beoStatus)}
                          </Link>
                        ) : canGenBeo ? (
                          <button
                            type="button"
                            className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-900"
                            title={BEO_COPY.intro}
                            onClick={() =>
                              void apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/events/${event.id}/beo`, {
                                method: "POST",
                              }).then(() => void load())
                            }
                          >
                            {BEO_COPY.generate}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === "packages" && (
          <GroupEventPackagesTab
            hotelId={hotelId}
            groupId={groupId}
            events={events.map((e) => ({
              id: e.event.id,
              eventName: e.event.eventName,
              quoteId: e.quoteId,
              quoteStatus: e.quoteStatus,
              guaranteedPax: e.event.guaranteedPax,
              expectedPax: e.event.expectedPax,
            }))}
          />
        )}

        {!loading && activeTab === "beo" && (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">{BEO_COPY.title}</h3>
            <p className="text-sm text-muted-foreground">{BEO_COPY.intro}</p>
            <p className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">{BEO_COPY.deliveryNote}</p>
            <ul className="space-y-2">
              {events.map((row) => {
                const canGen =
                  !row.beoStatus &&
                  (row.quoteStatus === "SENT" ||
                    row.quoteStatus === "ACCEPTED" ||
                    row.quoteStatus === "CONTRACTED");
                return (
                  <li key={row.event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <div>
                      <span className="font-semibold">{row.event.eventName}</span>
                      <p className="text-xs text-slate-500">
                        Quote: {row.quoteStatus ? formatQuoteStatus(row.quoteStatus) : "none"}
                        {row.beoStatus ? ` · Banquet order: ${formatBeoStatus(row.beoStatus)}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {row.beoStatus ? (
                        <Link href={staffAppPath("groups", groupId, "events", row.event.id, "beo")} className="font-bold text-indigo-700 hover:underline">
                          {BEO_COPY.viewPrint}
                        </Link>
                      ) : canGen ? (
                        <button
                          type="button"
                          className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-900"
                          onClick={() =>
                            void apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/events/${row.event.id}/beo`, {
                              method: "POST",
                            }).then(() => void load())
                          }
                        >
                          {BEO_COPY.generate}
                        </button>
                      ) : (
                        <span className="text-xs text-amber-800">{BEO_COPY.needQuote}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!loading && dash && activeTab === "billing" && (
          <>
            {!dash.masterFolio ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
                <p className="font-bold">Link a master room before posting function charges</p>
                <p className="mt-1">{BILLING_COPY.masterRequiredAlert}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {dash.members.length > 0 ? (
                    <button
                      type="button"
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-950 hover:bg-indigo-100 disabled:opacity-50"
                      onClick={() => void linkMasterReservation(dash.members[0].reservationId)}
                    >
                      <Crown className="h-3.5 w-3.5" aria-hidden />
                      Use first room as master
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-100"
                    onClick={() => setActiveTab("rooms")}
                  >
                    Go to Rooms tab
                  </button>
                </div>
              </div>
            ) : null}
            {eventBilling ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500" title={BILLING_COPY.eventChargesHint}>
                  {BILLING_COPY.eventCharges}
                </h3>
                <p className="text-sm" title={BILLING_COPY.eventChargesHint}>
                  {BILLING_COPY.quoted} {money(eventBilling.totalQuoted).toFixed(2)} · {BILLING_COPY.accepted}{" "}
                  {money(eventBilling.totalAccepted).toFixed(2)} · {BILLING_COPY.posted}{" "}
                  {money(eventBilling.totalPosted).toFixed(2)} · {BILLING_COPY.balance}{" "}
                  {money(eventBilling.outstandingBalance).toFixed(2)}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="py-2">Function</th>
                      <th className="py-2">Quote</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right" title={BILLING_COPY.masterFolioHint}>
                        Guest bill
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventBilling.events.map((row) => (
                      <tr key={row.eventId} className="border-b border-slate-50">
                        <td className="py-2">{row.eventName}</td>
                        <td className="py-2" title={quoteStatusHint(row.quoteStatus)}>
                          {formatQuoteStatus(row.quoteStatus)}
                        </td>
                        <td className="py-2 text-right">{money(row.totalAmount).toFixed(2)}</td>
                        <td className="py-2 text-right">
                          {row.chargesPosted ? (
                            <span title="Charges are on the master guest bill.">On guest bill</span>
                          ) : !dash.masterFolio ? (
                            <span className="text-xs font-medium text-amber-800" title={BILLING_COPY.postRequiresMaster}>
                              {BILLING_COPY.needsMaster}
                            </span>
                          ) : row.quoteStatus === "ACCEPTED" ? (
                            <span className="text-xs text-slate-500" title={BILLING_COPY.postRequiresContract}>
                              {BILLING_COPY.contractFirst}
                            </span>
                          ) : row.quoteStatus === "CONTRACTED" ? (
                            <button
                              type="button"
                              className="text-xs font-bold text-indigo-700 disabled:opacity-50"
                              disabled={saving}
                              title="Use if Contract did not post automatically (master room must be linked)."
                              onClick={() => void postEventCharges(row.eventId)}
                            >
                              {BILLING_COPY.postChargesRetry}
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
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
                <h3 className="mb-2 text-sm font-bold text-slate-900" title={BILLING_COPY.masterFolioHint}>
                  {BILLING_COPY.masterFolio}
                </h3>
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
                      <th className="px-4 py-3 text-right" title="Outstanding balance on this room's guest bill.">
                        Bill due
                      </th>
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
                                Guest bill
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
