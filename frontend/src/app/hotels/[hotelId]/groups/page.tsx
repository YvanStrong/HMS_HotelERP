"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { useHotelContext } from "@/lib/useHotelContext";
import {
  Users,
  Plus,
  Search,
  Building,
  ChevronRight,
  LayoutGrid,
  Briefcase,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Check,
  Trash2,
} from "lucide-react";

type AvailMatch = {
  room_type_id: string;
  name: string;
  available_count: number;
  base_price_per_night: number;
  total_price: number;
  currency: string;
  nights: number;
  maxOccupancy?: number;
  score: number;
  recommended: boolean;
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

type RoomTypeOption = {
  id: string;
  name: string;
  code?: string;
  baseRate?: number;
  maxOccupancy?: number;
};

interface GroupBooking {
  id: string;
  groupName: string;
  groupCode: string;
  companyName: string;
  contactPerson: string;
  status: string;
  createdAt: string;
  expectedGuests?: number | null;
  roomsNeeded?: number | null;
  eventType?: string | null;
  preferredRoomTypeId?: string | null;
}

export default function GroupsPage() {
  const { hotelId } = useParams();
  const router = useRouter();
  const { hotel } = useHotelContext(String(hotelId));
  const currency = hotel.currency || "RWF";
  const [groups, setGroups] = useState<GroupBooking[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const [newGroup, setNewGroup] = useState({
    groupName: "",
    groupCode: "",
    companyName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    status: "TENTATIVE",
    expectedGuests: "" as string | number,
    roomsNeeded: "" as string | number,
    targetCheckIn: "",
    targetCheckOut: "",
    eventType: "CONFERENCE",
    preferredRoomTypeId: "",
    roomMixSummary: "",
    billingPreference: "MASTER_PAYS_ALL",
    notes: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availRaw, setAvailRaw] = useState<AvailMatch[]>([]);

  const guestsNum = useMemo(() => {
    const n = Number(newGroup.expectedGuests);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [newGroup.expectedGuests]);

  const roomsNum = useMemo(() => {
    const n = Number(newGroup.roomsNeeded);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [newGroup.roomsNeeded]);

  const adultsPerRoom = useMemo(() => {
    if (guestsNum > 0 && roomsNum > 0) return Math.max(1, Math.ceil(guestsNum / roomsNum));
    return 2;
  }, [guestsNum, roomsNum]);

  const datesValid =
    !!newGroup.targetCheckIn &&
    !!newGroup.targetCheckOut &&
    newGroup.targetCheckOut > newGroup.targetCheckIn;

  const canAnalyze = showAddModal && datesValid && guestsNum > 0 && roomsNum > 0;

  const smartMatches = useMemo(() => {
    if (!canAnalyze) return [];
    const catalogById = new Map(roomTypes.map((rt) => [rt.id, rt]));
    const ranked = availRaw
      .filter((a) => a.available_count >= roomsNum)
      .map((a) => {
        const cat = catalogById.get(a.room_type_id);
        const maxOcc = cat?.maxOccupancy ?? 99;
        let score = a.available_count >= roomsNum ? 100 : 0;
        if (maxOcc >= adultsPerRoom) score += 40;
        if (maxOcc >= adultsPerRoom && maxOcc <= adultsPerRoom + 1) score += 25;
        score += Math.min(20, a.available_count - roomsNum);
        score -= Number(a.total_price) / 100_000;
        return {
          ...a,
          maxOccupancy: maxOcc,
          score,
          recommended: false,
        };
      })
      .sort((x, y) => y.score - x.score);
    if (ranked.length > 0) ranked[0] = { ...ranked[0], recommended: true };
    return ranked;
  }, [availRaw, canAnalyze, roomTypes, roomsNum, adultsPerRoom]);

  const matchInsight = useMemo(() => {
    if (!showAddModal) return null;
    if (!datesValid) return "Set check-in and check-out to scan live inventory.";
    if (guestsNum < 1 || roomsNum < 1) return "Enter expected guests and rooms needed — we'll match sellable room types.";
    if (availLoading) return `Analyzing inventory for ${guestsNum} guests in ${roomsNum} rooms (~${adultsPerRoom} per room)…`;
    if (smartMatches.length === 0) {
      return `No room type has ${roomsNum}+ vacant rooms for ~${adultsPerRoom} guest(s) per room on these dates. Try different dates or fewer rooms.`;
    }
    return `For ${guestsNum} guests across ${roomsNum} rooms (~${adultsPerRoom}/room), ${smartMatches.length} room type${smartMatches.length === 1 ? "" : "s"} can cover your block.`;
  }, [showAddModal, datesValid, guestsNum, roomsNum, adultsPerRoom, availLoading, smartMatches.length]);

  const loadDemandAvailability = useCallback(async () => {
    if (!canAnalyze) {
      setAvailRaw([]);
      return;
    }
    setAvailLoading(true);
    try {
      const p = new URLSearchParams({
        check_in: newGroup.targetCheckIn,
        check_out: newGroup.targetCheckOut,
        adults: String(adultsPerRoom),
      });
      const data = await apiFetch<{ available_room_types: AvailMatch[] }>(
        `/api/v1/hotels/${hotelId}/rooms/availability?${p}`,
      );
      setAvailRaw(
        (data.available_room_types ?? []).map((t) => ({
          ...t,
          score: 0,
          recommended: false,
        })),
      );
    } catch {
      setAvailRaw([]);
    } finally {
      setAvailLoading(false);
    }
  }, [canAnalyze, hotelId, newGroup.targetCheckIn, newGroup.targetCheckOut, adultsPerRoom]);

  useEffect(() => {
    if (!showAddModal) return;
    const t = window.setTimeout(() => void loadDemandAvailability(), 350);
    return () => window.clearTimeout(t);
  }, [showAddModal, loadDemandAvailability]);

  useEffect(() => {
    if (!showAddModal || smartMatches.length === 0) return;
    setNewGroup((prev) => {
      const stillValid = smartMatches.some((m) => m.room_type_id === prev.preferredRoomTypeId);
      if (stillValid) return prev;
      const pick = smartMatches.find((m) => m.recommended) ?? smartMatches[0];
      return { ...prev, preferredRoomTypeId: pick.room_type_id };
    });
  }, [smartMatches, showAddModal]);

  function openCreateModal() {
    const today = localYmd();
    setCreateErr(null);
    setAvailRaw([]);
    setNewGroup((prev) => ({
      ...prev,
      targetCheckIn: prev.targetCheckIn || today,
      targetCheckOut: prev.targetCheckOut || addDays(today, 2),
    }));
    setShowAddModal(true);
  }

  useEffect(() => {
    void loadGroups();
    void loadRoomTypes();
  }, [hotelId]);

  async function loadRoomTypes() {
    try {
      const data = await apiFetch<RoomTypeOption[]>(`/api/v1/hotels/${hotelId}/room-types`);
      setRoomTypes(data ?? []);
    } catch {
      setRoomTypes([]);
    }
  }

  function roomTypeLabel(id: string | null | undefined) {
    if (!id) return null;
    const rt = roomTypes.find((t) => t.id === id);
    return rt ? (rt.code ? `${rt.name} (${rt.code})` : rt.name) : null;
  }

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showAddModal) {
        setShowAddModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showAddModal]);

  async function loadGroups() {
    try {
      setLoading(true);
      const data = await apiFetch<GroupBooking[]>(`/api/v1/hotels/${hotelId}/groups`);
      setGroups(data || []);
    } catch (err) {
      console.error("Failed to load groups", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteGroup(group: GroupBooking) {
    if (!getToken()) return;
    const ok = window.confirm(
      `Delete group "${group.groupName}"?\n\nYou can only remove a group that has no reservations linked to it. If you used "Book block" for this group, cancel or unlink those stays first.`,
    );
    if (!ok) return;
    setDeletingId(group.id);
    setDeleteErr(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${group.id}`, { method: "DELETE" });
      await loadGroups();
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : "Could not delete group");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreateGroup() {
    if (!newGroup.groupName) {
      setCreateErr("Group name is required.");
      return;
    }
    if (!datesValid) {
      setCreateErr("Set target check-in and check-out dates.");
      return;
    }
    if (guestsNum < 1 || roomsNum < 1) {
      setCreateErr("Enter expected guests and rooms needed.");
      return;
    }
    if (!newGroup.preferredRoomTypeId) {
      setCreateErr("Pick a room type from the inventory matches below.");
      return;
    }
    if (smartMatches.length > 0 && !smartMatches.some((m) => m.room_type_id === newGroup.preferredRoomTypeId)) {
      setCreateErr("Selected room type is not available for this demand — pick a matched type.");
      return;
    }
    try {
      setIsCreating(true);
      setCreateErr(null);
      const selectedRoomTypeId = newGroup.preferredRoomTypeId;
      const payload = {
        groupName: newGroup.groupName.trim(),
        groupCode: newGroup.groupCode.trim() || null,
        companyName: newGroup.companyName.trim() || null,
        contactPerson: newGroup.contactPerson.trim() || null,
        contactEmail: newGroup.contactEmail.trim() || null,
        contactPhone: newGroup.contactPhone.trim() || null,
        status: newGroup.status,
        expectedGuests: newGroup.expectedGuests === "" ? null : Number(newGroup.expectedGuests),
        roomsNeeded: newGroup.roomsNeeded === "" ? null : Number(newGroup.roomsNeeded),
        targetCheckIn: newGroup.targetCheckIn || null,
        targetCheckOut: newGroup.targetCheckOut || null,
        eventType: newGroup.eventType || null,
        preferredRoomTypeId: newGroup.preferredRoomTypeId || null,
        roomMixSummary: newGroup.roomMixSummary.trim() || null,
        billingPreference: newGroup.billingPreference || null,
        notes: newGroup.notes.trim() || null,
      };
      const created = await apiFetch<GroupBooking>(`/api/v1/hotels/${hotelId}/groups`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowAddModal(false);
      setNewGroup({
        groupName: "",
        groupCode: "",
        companyName: "",
        contactPerson: "",
        contactEmail: "",
        contactPhone: "",
        status: "TENTATIVE",
        expectedGuests: "",
        roomsNeeded: "",
        targetCheckIn: "",
        targetCheckOut: "",
        eventType: "CONFERENCE",
        preferredRoomTypeId: "",
        roomMixSummary: "",
        billingPreference: "MASTER_PAYS_ALL",
        notes: "",
      });
      void loadGroups();
      if (created?.id) {
        const params = new URLSearchParams();
        params.set("from_create", "1");
        if (selectedRoomTypeId !== "") {
          params.set("room_type_id", selectedRoomTypeId);
        }
        router.push(`${staffAppPath("groups", created.id, "reserve")}?${params.toString()}`);
      }
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  }

  const filteredGroups = groups.filter(g => 
    g.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.groupCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function statusBadgeClass(status: string) {
    if (status === "CONFIRMED") return "bg-emerald-100 text-emerald-700";
    if (status === "CANCELLED") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900 sm:text-3xl">
            <Users className="h-7 w-7 shrink-0 text-indigo-600 sm:h-8 sm:w-8" />
            <span className="min-w-0 leading-tight">Group & Event Management</span>
          </h1>
          <p className="mt-1 font-medium text-slate-500">Manage corporate bookings, tour groups, and event blocks</p>
        </div>
        <button 
          onClick={openCreateModal}
          className="flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-[0.98] sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          Create Group
        </button>
      </div>

      {deleteErr && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
          {deleteErr}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div className="flex min-h-[52px] items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-5 sm:py-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name, code or company…"
            className="min-h-11 flex-1 bg-transparent font-medium text-slate-700 outline-none placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Mobile / narrow: stacked cards — no horizontal table scroll */}
        <div className="md:hidden">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-slate-400">
              <Briefcase className="h-8 w-8 opacity-20" />
              <p className="text-sm font-medium">No groups match this search.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 p-3 sm:p-4">
              {filteredGroups.map((group) => (
                <li key={group.id} className="list-none py-4 first:pt-0 last:pb-0">
                  <article className="rounded-2xl border border-slate-200/90 bg-slate-50/40 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-lg font-black text-indigo-600 shadow-sm">
                        {group.groupName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-slate-900">{group.groupName}</p>
                            <p className="font-mono text-[10px] uppercase tracking-tighter text-slate-500">
                              {group.groupCode || "NO-CODE"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(group.status)}`}
                          >
                            {group.status}
                          </span>
                        </div>
                        {(group.expectedGuests != null ||
                          group.roomsNeeded != null ||
                          group.preferredRoomTypeId) && (
                          <p className="mt-2 text-[11px] font-semibold leading-snug text-indigo-600">
                            {group.expectedGuests != null ? `${group.expectedGuests} guests` : ""}
                            {group.expectedGuests != null && group.roomsNeeded != null ? " · " : ""}
                            {group.roomsNeeded != null ? `${group.roomsNeeded} rooms` : ""}
                            {roomTypeLabel(group.preferredRoomTypeId) ? (
                              <>
                                {group.expectedGuests != null || group.roomsNeeded != null ? " · " : ""}
                                <span className="break-words">{roomTypeLabel(group.preferredRoomTypeId)}</span>
                              </>
                            ) : null}
                          </p>
                        )}
                        <dl className="mt-3 space-y-1.5 text-sm">
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 text-slate-500">Company</dt>
                            <dd className="min-w-0 font-medium text-slate-800">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                <span className="break-words">{group.companyName || "—"}</span>
                              </span>
                            </dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="w-20 shrink-0 text-slate-500">Contact</dt>
                            <dd className="font-medium text-slate-900">{group.contactPerson || "—"}</dd>
                          </div>
                        </dl>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Link
                            href={staffAppPath("groups", group.id)}
                            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black uppercase tracking-wide text-slate-700 shadow-sm transition hover:bg-slate-50"
                          >
                            Billing
                          </Link>
                          <Link
                            href={`${staffAppPath("groups", group.id, "reserve")}`}
                            className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-black uppercase tracking-wide text-indigo-700 transition hover:bg-indigo-100"
                          >
                            <LayoutGrid className="h-4 w-4 shrink-0" />
                            Block
                          </Link>
                          <Link
                            href={`${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(group.id)}`}
                            className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-700"
                          >
                            <ChevronRight className="h-4 w-4 shrink-0" />
                            One room
                          </Link>
                          <button
                            type="button"
                            className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-rose-100 bg-rose-50/90 px-3 text-xs font-black uppercase tracking-wide text-rose-800 transition hover:bg-rose-100 disabled:opacity-40"
                            disabled={deletingId === group.id}
                            onClick={() => void handleDeleteGroup(group)}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                            {deletingId === group.id ? "…" : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* md+: table */}
        <div className="hidden md:block md:overflow-x-auto md:overscroll-x-contain">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-white">
                <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:px-6 lg:py-4">Group Details</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:px-6">Company</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:px-6">Contact</th>
                <th className="px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-400 lg:px-6">Status</th>
                <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest text-slate-400 lg:px-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="h-16 bg-slate-50/50 px-6 py-8" />
                  </tr>
                ))
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="bg-slate-50/30 px-6 py-16 text-center italic text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase className="h-8 w-8 opacity-20" />
                      <p className="text-sm not-italic">No groups found matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => (
                  <tr key={group.id} className="group transition-colors hover:bg-slate-50">
                    <td className="px-4 py-4 lg:px-6 lg:py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-lg font-black text-indigo-600 shadow-sm">
                          {group.groupName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 transition-colors group-hover:text-indigo-600">
                            {group.groupName}
                          </p>
                          <p className="font-mono text-[10px] uppercase tracking-tighter text-slate-500">
                            {group.groupCode || "NO-CODE"}
                          </p>
                          {(group.expectedGuests != null || group.roomsNeeded != null || group.preferredRoomTypeId) && (
                            <p className="mt-1 max-w-md text-[11px] font-semibold leading-snug text-indigo-600">
                              {group.expectedGuests != null ? `${group.expectedGuests} guests` : ""}
                              {group.expectedGuests != null && group.roomsNeeded != null ? " · " : ""}
                              {group.roomsNeeded != null ? `${group.roomsNeeded} rooms` : ""}
                              {roomTypeLabel(group.preferredRoomTypeId) ? (
                                <>
                                  {group.expectedGuests != null || group.roomsNeeded != null ? " · " : ""}
                                  {roomTypeLabel(group.preferredRoomTypeId)}
                                </>
                              ) : null}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-4 align-top lg:px-6 lg:py-5">
                      <div className="flex items-start gap-2 font-medium text-slate-600">
                        <Building className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="min-w-0 break-words leading-snug">{group.companyName || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top lg:px-6 lg:py-5">
                      <p className="font-medium text-slate-900">{group.contactPerson || "—"}</p>
                    </td>
                    <td className="px-4 py-4 align-top whitespace-nowrap lg:px-6 lg:py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${statusBadgeClass(group.status)}`}
                      >
                        {group.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right align-top lg:px-6 lg:py-5">
                      <div className="ml-auto flex max-w-[320px] flex-wrap items-center justify-end gap-2">
                        <Link
                          href={staffAppPath("groups", group.id)}
                          className="inline-flex min-h-10 min-w-[4.5rem] items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                          title="Billing routing & master folio"
                        >
                          Billing
                        </Link>
                        <Link
                          href={`${staffAppPath("groups", group.id, "reserve")}`}
                          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-indigo-700 transition hover:bg-indigo-100"
                          title="Plan multi-room block with inventory radar"
                        >
                          <LayoutGrid className="h-4 w-4 shrink-0" />
                          Block
                        </Link>
                        <Link
                          href={`${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(group.id)}`}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-xl border border-transparent px-2 text-slate-400 transition-all hover:border-slate-100 hover:bg-white hover:text-indigo-600 hover:shadow-md"
                          title="Single-room staff reservation linked to this group"
                        >
                          <span className="sr-only">One room</span>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-rose-100 bg-rose-50/80 px-3 py-2 text-xs font-black uppercase tracking-wide text-rose-800 transition hover:bg-rose-100 disabled:opacity-40"
                          title="Remove group (only if no linked reservations)"
                          disabled={deletingId === group.id}
                          onClick={() => void handleDeleteGroup(group)}
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          {deletingId === group.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE GROUP MODAL */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white rounded-2xl sm:rounded-[28px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200/80 flex flex-col max-h-[min(92vh,900px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-5 sm:px-8 sm:py-6 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between bg-white sticky top-0 z-10 shrink-0">
              <div className="space-y-1 min-w-0 pr-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">Create Group Block</h2>
                <p className="text-sm font-medium text-slate-500 leading-relaxed">
                  Set dates and headcount, then pick a matched room type. Use <strong>Block</strong> to book.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddModal(false)} 
                className="self-end sm:self-start shrink-0 p-2.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-slate-900"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-4 sm:p-8 space-y-5 sm:space-y-6 bg-white overflow-y-auto flex-1 overscroll-contain">
              {createErr && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold shadow-sm animate-in shake duration-500">
                  {createErr}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Group Name *</label>
                  <input 
                    value={newGroup.groupName} 
                    onChange={e => setNewGroup({...newGroup, groupName: e.target.value})} 
                    placeholder="e.g. Google Developers Conference" 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Group Code</label>
                    <input 
                      value={newGroup.groupCode} 
                      onChange={e => setNewGroup({...newGroup, groupCode: e.target.value})} 
                      placeholder="e.g. GDEV24" 
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Status</label>
                    <select 
                      value={newGroup.status} 
                      onChange={e => setNewGroup({...newGroup, status: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      <option value="TENTATIVE">Tentative</option>
                      <option value="CONFIRMED">Confirmed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Company/Entity</label>
                  <input 
                    value={newGroup.companyName} 
                    onChange={e => setNewGroup({...newGroup, companyName: e.target.value})} 
                    placeholder="e.g. Alphabet Inc." 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Contact Person</label>
                  <input 
                    value={newGroup.contactPerson} 
                    onChange={e => setNewGroup({...newGroup, contactPerson: e.target.value})} 
                    placeholder="Primary coordinator name" 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Coordinator email</label>
                    <input
                      type="email"
                      value={newGroup.contactEmail}
                      onChange={(e) => setNewGroup({ ...newGroup, contactEmail: e.target.value })}
                      placeholder="events@client.com"
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">War room phone</label>
                    <input
                      value={newGroup.contactPhone}
                      onChange={(e) => setNewGroup({ ...newGroup, contactPhone: e.target.value })}
                      placeholder="+250 … on-site GSM"
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-3 sm:p-4 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-black uppercase tracking-wider text-indigo-800">Demand sketch</p>
                    <span className="inline-flex w-fit items-center gap-1 rounded-full bg-indigo-600/10 px-2.5 py-1 text-[10px] font-bold text-indigo-700">
                      <Sparkles className="h-3 w-3 shrink-0" />
                      Smart match
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <label className="text-[10px] font-bold text-slate-600">Target check-in *</label>
                      <input
                        type="date"
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-white bg-white px-3 py-2.5 text-sm"
                        value={newGroup.targetCheckIn}
                        onChange={(e) => setNewGroup({ ...newGroup, targetCheckIn: e.target.value })}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-bold text-slate-600">Target check-out *</label>
                      <input
                        type="date"
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-white bg-white px-3 py-2.5 text-sm"
                        value={newGroup.targetCheckOut}
                        onChange={(e) => setNewGroup({ ...newGroup, targetCheckOut: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="min-w-0">
                      <label className="text-[10px] font-bold text-slate-600" title="Total people in the group (for rooming and planning).">
                        Expected guests *
                      </label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-white bg-white px-3 py-2.5 text-sm"
                        value={newGroup.expectedGuests}
                        onChange={(e) => setNewGroup({ ...newGroup, expectedGuests: e.target.value })}
                        placeholder="3"
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="text-[10px] font-bold text-slate-600">Rooms needed *</label>
                      <input
                        type="number"
                        min={1}
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-white bg-white px-3 py-2.5 text-sm"
                        value={newGroup.roomsNeeded}
                        onChange={(e) => setNewGroup({ ...newGroup, roomsNeeded: e.target.value })}
                        placeholder="2"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-600">Event archetype</label>
                      <select
                        className="mt-1 w-full min-h-[44px] rounded-xl border border-white bg-white px-3 py-2.5 text-xs font-semibold"
                        value={newGroup.eventType}
                        onChange={(e) => setNewGroup({ ...newGroup, eventType: e.target.value })}
                      >
                        <option value="CONFERENCE">Conference / summit</option>
                        <option value="WEDDING">Wedding weekend</option>
                        <option value="TOUR">Tour series</option>
                        <option value="SPORTS_TEAM">Sports / crew</option>
                        <option value="RETREAT">Executive retreat</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-200/80 bg-white p-3 sm:p-4 space-y-4">
                    <p className="text-xs font-semibold text-indigo-900 flex items-start gap-2.5 leading-relaxed">
                      {availLoading ? (
                        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 animate-pulse text-indigo-500" />
                      ) : smartMatches.length > 0 ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                      ) : canAnalyze ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      ) : (
                        <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" />
                      )}
                      <span className="min-w-0 break-words">{matchInsight}</span>
                    </p>
                    {smartMatches.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                          <label
                            id="preferred-room-type-label"
                            className="text-[10px] font-bold uppercase tracking-wide text-slate-600"
                          >
                            Choose room type (click one) *
                          </label>
                          <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                            {smartMatches.length} option{smartMatches.length === 1 ? "" : "s"} — scroll if many
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-snug">
                          Selected type is saved on the group and opens <strong>Book group block</strong> next so you can confirm rooms and lead guest.
                        </p>
                        <div
                          className="max-h-[min(52vh,480px)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-slate-50/90 p-2 sm:p-3 space-y-2 shadow-inner"
                          role="radiogroup"
                          aria-labelledby="preferred-room-type-label"
                        >
                          {smartMatches.map((m) => {
                            const selected = newGroup.preferredRoomTypeId === m.room_type_id;
                            const blockTotal = Number(m.total_price) * roomsNum;
                            return (
                              <button
                                key={m.room_type_id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() =>
                                  setNewGroup({ ...newGroup, preferredRoomTypeId: m.room_type_id })
                                }
                                className={`relative flex w-full max-w-full gap-3 rounded-xl border-2 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition shadow-sm ${
                                  selected
                                    ? "border-indigo-500 bg-indigo-50/95 ring-2 ring-indigo-200/80"
                                    : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-white active:scale-[0.99]"
                                }`}
                              >
                                <span
                                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                    selected
                                      ? "border-indigo-600 bg-indigo-600"
                                      : "border-slate-300 bg-white"
                                  }`}
                                  aria-hidden
                                >
                                  {selected ? (
                                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                                  ) : null}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="w-full text-left text-[15px] sm:text-base font-bold leading-snug text-slate-900"
                                    style={{ wordBreak: "normal", overflowWrap: "break-word" }}
                                  >
                                    {m.name}
                                  </p>
                                  {m.recommended ? (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span className="inline-flex items-center rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                                        Best fit
                                      </span>
                                    </div>
                                  ) : null}
                                  <dl className="mt-3 grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-2 border-t border-slate-200/80 pt-3 text-sm sm:grid-cols-[minmax(6rem,1fr)_auto] sm:items-baseline">
                                  <dt className="text-slate-500 sm:col-span-1">Available</dt>
                                  <dd className="min-w-0 font-semibold text-emerald-700 tabular-nums sm:text-right">
                                    {m.available_count} room{m.available_count === 1 ? "" : "s"}
                                  </dd>
                                  {m.maxOccupancy != null ? (
                                    <>
                                      <dt className="text-slate-500 sm:col-span-1">Capacity</dt>
                                      <dd className="min-w-0 font-medium text-slate-800 sm:text-right">
                                        Up to {m.maxOccupancy} guests / room
                                      </dd>
                                    </>
                                  ) : null}
                                  <dt className="text-slate-500 sm:col-span-1">Per night</dt>
                                  <dd className="min-w-0 font-semibold text-indigo-900 tabular-nums sm:text-right">
                                    {formatMoney(m.base_price_per_night, m.currency)}
                                  </dd>
                                  <dt className="text-slate-500 sm:col-span-1 shrink-0">
                                    Per room ({m.nights} nights)
                                  </dt>
                                  <dd className="min-w-0 font-semibold text-indigo-900 tabular-nums sm:text-right">
                                    {formatMoney(m.total_price, m.currency)}
                                  </dd>
                                  <dt className="text-slate-600 font-medium sm:col-span-1">
                                    Block ({roomsNum} room{roomsNum === 1 ? "" : "s"})
                                  </dt>
                                  <dd className="min-w-0 text-base font-black text-slate-900 tabular-nums sm:text-right">
                                    {formatMoney(blockTotal, m.currency)}
                                  </dd>
                                </dl>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : roomTypes.length === 0 ? (
                      <p className="text-xs text-amber-700">
                        No room types configured.{" "}
                        <Link href={staffAppPath("room-types")} className="font-semibold underline">
                          Add room types
                        </Link>
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Extra room mix notes (optional)</label>
                    <textarea
                      rows={2}
                      value={newGroup.roomMixSummary}
                      onChange={(e) => setNewGroup({ ...newGroup, roomMixSummary: e.target.value })}
                      placeholder="e.g. overflow kings on floor 3, VIP row near elevator"
                      className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Billing choreography</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-xs font-semibold"
                      value={newGroup.billingPreference}
                      onChange={(e) => setNewGroup({ ...newGroup, billingPreference: e.target.value })}
                    >
                      <option value="MASTER_PAYS_ALL">Master pays all (folio routing)</option>
                      <option value="SPLIT_BILLING">Split: room → master, extras → guest</option>
                      <option value="GUEST_PAYS_INCIDENTALS">Company room, guest incidentals</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Ops notes / drama log</label>
                  <textarea
                    rows={3}
                    value={newGroup.notes}
                    onChange={(e) => setNewGroup({ ...newGroup, notes: e.target.value })}
                    placeholder="Dietaries, arrival waves, security, competitor hotels sniffing around…"
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-4 py-4 sm:px-8 sm:py-6 bg-slate-50 border-t border-slate-100 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center shrink-0">
              <button 
                type="button" 
                className="hms-btn-outline w-full sm:w-auto px-6 py-3 rounded-2xl font-bold" 
                onClick={() => setShowAddModal(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="hms-btn-solid w-full sm:w-auto min-w-0 sm:min-w-[160px] px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-200 bg-indigo-600 text-white" 
                onClick={() => void handleCreateGroup()}
                disabled={isCreating}
              >
                {isCreating ? "Creating…" : "Create group & book block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
