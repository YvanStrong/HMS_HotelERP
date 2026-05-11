"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Facility = { id: string; name: string; code?: string; type?: string };
type SlotItem = {
  id: string;
  start: string;
  end: string;
  status: string;
  maxBookings: number;
  currentBookings: number;
  availableSpots: number;
};
type BookingItem = {
  bookingId: string;
  bookingReference: string;
  status: string;
  guestName: string;
  guestCount: number;
  slotStart: string;
  slotEnd: string;
  accessCode: string;
};
type FacilityDashboard = {
  facilityId: string;
  facilityName: string;
  fromDate: string;
  toDate: string;
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  slots: SlotItem[];
  bookings: BookingItem[];
};
type BookingCreateResponse = {
  bookingId: string;
  bookingReference: string;
  status: string;
  access: { accessCode: string; qrCode?: string; instructions?: string };
};
type ReservationOption = {
  id: string;
  booking_reference?: string;
  guestName?: string;
  roomNumber?: string;
  status?: string;
};
type MaintenanceItem = {
  maintenanceId: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  cost?: number;
  createdAt: string;
  completedBy?: string;
  inspectorNotes?: string;
  complianceStatus?: string;
};
type WaterQualityItem = {
  id: string;
  loggedAt: string;
  loggedBy: string;
  phLevel?: number;
  freeChlorinePpm?: number;
  combinedChlorinePpm?: number;
  temperatureCelsius?: number;
  turbidityNtu?: number;
  totalDissolvedSolids?: number;
  alkalinityPpm?: number;
  calciumHardnessPpm?: number;
  notes?: string;
  passedInspection: boolean;
  inspectorName?: string;
  createdAt: string;
};
type LifeguardShiftItem = {
  id: string;
  staffName: string;
  staffEmail?: string;
  certificationName?: string;
  certificationExpiry?: string;
  shiftDate: string;
  shiftStart: string;
  shiftEnd: string;
  status: string;
  notes?: string;
  certificationExpiringSoon: boolean;
};
type IncidentItem = {
  id: string;
  occurredAt: string;
  title: string;
  description?: string;
  severity: string;
  reportedBy: string;
  witnessNames?: string;
  status: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
};
type RevenueSummary = {
  facilityId: string;
  facilityName: string;
  fromDate: string;
  toDate: string;
  totalBookings: number;
  checkedInCount: number;
  totalRevenue: number;
  roomChargedRevenue: number;
  directRevenue: number;
};

type Tab = "operations" | "water-quality" | "lifeguards" | "incidents" | "revenue" | "maintenance" | "settings";

const PAGE_SIZE = 10;
const BOOKING_PAGE_SIZE = 8;
const FACILITY_TYPES = ["POOL", "SPA", "GYM", "MEETING_ROOM", "RESTAURANT", "PARKING", "OTHER"] as const;

function ymd(daysFromNow = 0): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function toLocalIsoDateTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function fmt(n?: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function getFacilityIcon(type?: string) {
  switch (type?.toLowerCase()) {
    case "spa": return "💆";
    case "gym": return "💪";
    case "pool": return "🏊";
    case "restaurant": return "🍽️";
    case "meeting_room": return "🤝";
    case "parking": return "🅿️";
    default: return "🏢";
  }
}
function severityColor(s: string) {
  switch (s?.toUpperCase()) {
    case "CRITICAL": return "text-red-700 bg-red-50 border-red-200";
    case "HIGH": return "text-orange-700 bg-orange-50 border-orange-200";
    case "MEDIUM": return "text-amber-700 bg-amber-50 border-amber-200";
    default: return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
}

export default function FacilitiesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [tab, setTab] = useState<Tab>("operations");
  const [rows, setRows] = useState<Facility[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [slotSavingId, setSlotSavingId] = useState<string | null>(null);
  const [quickSlotDate, setQuickSlotDate] = useState(ymd(1));
  const [quickSlotTime, setQuickSlotTime] = useState("09:00");
  const [quickSlotDurationMinutes, setQuickSlotDurationMinutes] = useState("60");
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [fromDate, setFromDate] = useState(ymd(0));
  const [toDate, setToDate] = useState(ymd(7));
  const [dashboard, setDashboard] = useState<FacilityDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [checkedInReservations, setCheckedInReservations] = useState<ReservationOption[]>([]);
  const [checkedInLoading, setCheckedInLoading] = useState(false);
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationSearchDebounced, setReservationSearchDebounced] = useState("");
  const [bookingListQuery, setBookingListQuery] = useState("");
  const [bookingListStatus, setBookingListStatus] = useState<"ALL" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED">("ALL");
  const [bookingListLimit, setBookingListLimit] = useState(50);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [bookingActionId, setBookingActionId] = useState<string | null>(null);
  const [bookingPage, setBookingPage] = useState(1);

  // QR code access pass modal
  const [qrModal, setQrModal] = useState<{
    ref: string;
    accessCode: string;
    qrCode?: string;
    instructions?: string;
  } | null>(null);

  // Maintenance
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceItems, setMaintenanceItems] = useState<MaintenanceItem[]>([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    scheduledStart: "",
    estimatedDurationMinutes: "60",
    cost: "",
  });
  const [completeMaintenanceId, setCompleteMaintenanceId] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState({ completedBy: "", inspectorNotes: "", complianceStatus: "PASSED" });
  const [completeSaving, setCompleteSaving] = useState(false);

  // Water quality
  const [waterLogs, setWaterLogs] = useState<WaterQualityItem[]>([]);
  const [waterLoading, setWaterLoading] = useState(false);
  const [wqSaving, setWqSaving] = useState(false);
  const [wqForm, setWqForm] = useState({
    phLevel: "",
    freeChlorinePpm: "",
    combinedChlorinePpm: "",
    temperatureCelsius: "",
    turbidityNtu: "",
    totalDissolvedSolids: "",
    alkalinityPpm: "",
    calciumHardnessPpm: "",
    notes: "",
    passedInspection: true,
    inspectorName: "",
  });

  // Lifeguard roster
  const [lifeguards, setLifeguards] = useState<LifeguardShiftItem[]>([]);
  const [lifeguardLoading, setLifeguardLoading] = useState(false);
  const [lgSaving, setLgSaving] = useState(false);
  const [lgShiftFilter, setLgShiftFilter] = useState("");
  const [lgForm, setLgForm] = useState({
    staffName: "",
    staffEmail: "",
    certificationName: "",
    certificationExpiry: "",
    shiftDate: ymd(1),
    shiftStart: "08:00",
    shiftEnd: "16:00",
    notes: "",
  });

  // Incidents
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);
  const [incSaving, setIncSaving] = useState(false);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveSaving, setResolveSaving] = useState(false);
  const [resolveForm, setResolveForm] = useState({ resolution: "", resolvedBy: "" });
  const [incForm, setIncForm] = useState({
    title: "",
    description: "",
    severity: "LOW",
    witnessNames: "",
  });

  // Revenue
  const [revenueSummary, setRevenueSummary] = useState<RevenueSummary | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revFrom, setRevFrom] = useState(ymd(-30));
  const [revTo, setRevTo] = useState(ymd(0));

  // Create facility form
  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "SPA",
    description: "",
    maxCapacity: "",
    basePrice: "",
    requiresAdvanceBooking: true,
    allowsWalkIn: false,
  });
  const [bookForm, setBookForm] = useState({
    slotId: "",
    guestCount: "1",
    reservationId: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    chargeToRoom: false,
  });
  const [checkinForm, setCheckinForm] = useState({
    bookingId: "",
    accessCode: "",
    actualGuestCount: "",
  });

  const checkinCandidates = useMemo(
    () => (dashboard?.bookings ?? []).filter((b) => b.status === "CONFIRMED"),
    [dashboard?.bookings],
  );
  const visibleBookings = useMemo(() => {
    const q = bookingListQuery.trim().toLowerCase();
    let list = dashboard?.bookings ?? [];
    if (bookingListStatus !== "ALL") list = list.filter((b) => b.status === bookingListStatus);
    if (q) list = list.filter((b) => b.bookingReference.toLowerCase().includes(q) || b.guestName.toLowerCase().includes(q) || b.status.toLowerCase().includes(q));
    return list.slice(0, bookingListLimit);
  }, [dashboard?.bookings, bookingListLimit, bookingListQuery, bookingListStatus]);
  const bookingPaging = useMemo(() => paginateSlice(visibleBookings, bookingPage, BOOKING_PAGE_SIZE), [visibleBookings, bookingPage]);

  useEffect(() => {
    const t = setTimeout(() => setReservationSearchDebounced(reservationSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [reservationSearch]);

  const load = useCallback(async () => {
    if (!getToken()) { setError("Not signed in."); return; }
    try {
      const json = await apiFetch<Facility[]>(`/api/v1/hotels/${hotelId}/facilities`);
      setRows(json);
      setPage(1);
      if (!selectedFacilityId && json.length > 0) setSelectedFacilityId(json[0].id);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }, [hotelId, selectedFacilityId]);

  const loadDashboard = useCallback(async () => {
    if (!selectedFacilityId) { setDashboard(null); return; }
    setDashboardLoading(true);
    try {
      const d = await apiFetch<FacilityDashboard>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/dashboard?fromDate=${fromDate}&toDate=${toDate}`);
      setDashboard(d);
    } catch (e) { setDashboard(null); setError(e instanceof Error ? e.message : "Failed to load dashboard"); }
    finally { setDashboardLoading(false); }
  }, [hotelId, selectedFacilityId, fromDate, toDate]);

  const loadMaintenance = useCallback(async () => {
    if (!selectedFacilityId) { setMaintenanceItems([]); return; }
    try {
      const data = await apiFetch<MaintenanceItem[]>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/maintenances`);
      setMaintenanceItems(data ?? []);
    } catch { setMaintenanceItems([]); }
  }, [hotelId, selectedFacilityId]);

  const loadWaterQuality = useCallback(async () => {
    if (!selectedFacilityId) { setWaterLogs([]); return; }
    setWaterLoading(true);
    try {
      const data = await apiFetch<WaterQualityItem[]>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/water-quality`);
      setWaterLogs(data ?? []);
    } catch { setWaterLogs([]); }
    finally { setWaterLoading(false); }
  }, [hotelId, selectedFacilityId]);

  const loadLifeguards = useCallback(async () => {
    if (!selectedFacilityId) { setLifeguards([]); return; }
    setLifeguardLoading(true);
    try {
      const qs = lgShiftFilter ? `?shiftDate=${lgShiftFilter}` : "";
      const data = await apiFetch<LifeguardShiftItem[]>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/lifeguards${qs}`);
      setLifeguards(data ?? []);
    } catch { setLifeguards([]); }
    finally { setLifeguardLoading(false); }
  }, [hotelId, selectedFacilityId, lgShiftFilter]);

  const loadIncidents = useCallback(async () => {
    if (!selectedFacilityId) { setIncidents([]); return; }
    setIncidentsLoading(true);
    try {
      const data = await apiFetch<IncidentItem[]>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/incidents`);
      setIncidents(data ?? []);
    } catch { setIncidents([]); }
    finally { setIncidentsLoading(false); }
  }, [hotelId, selectedFacilityId]);

  const loadRevenue = useCallback(async () => {
    if (!selectedFacilityId) { setRevenueSummary(null); return; }
    setRevenueLoading(true);
    try {
      const data = await apiFetch<RevenueSummary>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/revenue?fromDate=${revFrom}&toDate=${revTo}`);
      setRevenueSummary(data);
    } catch { setRevenueSummary(null); }
    finally { setRevenueLoading(false); }
  }, [hotelId, selectedFacilityId, revFrom, revTo]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => { void loadMaintenance(); }, [loadMaintenance]);
  useEffect(() => { if (tab === "water-quality") void loadWaterQuality(); }, [tab, loadWaterQuality]);
  useEffect(() => { if (tab === "lifeguards") void loadLifeguards(); }, [tab, loadLifeguards]);
  useEffect(() => { if (tab === "incidents") void loadIncidents(); }, [tab, loadIncidents]);
  useEffect(() => { if (tab === "revenue") void loadRevenue(); }, [tab, loadRevenue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) return;
      if (reservationSearchDebounced.length > 0 && reservationSearchDebounced.length < 2) {
        if (!cancelled) setCheckedInReservations([]);
        return;
      }
      setCheckedInLoading(true);
      try {
        const p = new URLSearchParams();
        p.set("status", "CHECKED_IN");
        p.set("checkInFrom", ymd(-30));
        p.set("checkInTo", ymd(1));
        if (reservationSearchDebounced) p.set("q", reservationSearchDebounced);
        const data = await apiFetch<ReservationOption[]>(`/api/v1/hotels/${hotelId}/reservations?${p.toString()}`);
        if (!cancelled) setCheckedInReservations(data.filter((r) => r.id).slice(0, 20));
      } catch { if (!cancelled) setCheckedInReservations([]); }
      finally { if (!cancelled) setCheckedInLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [hotelId, reservationSearchDebounced]);

  const { slice, total, totalPages } = useMemo(() => paginateSlice(rows ?? [], page, PAGE_SIZE), [rows, page]);
  const summary = useMemo(() => {
    const all = rows ?? [];
    const byType = all.reduce<Record<string, number>>((acc, r) => {
      const t = (r.type ?? "OTHER").toUpperCase();
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    return { total: all.length, pool: byType.POOL ?? 0, spa: byType.SPA ?? 0, gym: byType.GYM ?? 0, meeting: byType.MEETING_ROOM ?? 0 };
  }, [rows]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function createFacility(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setError(null);
    if (!form.name.trim() || !form.code.trim()) { setError("Facility name and code are required."); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          type: form.type,
          description: form.description.trim() || undefined,
          maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : undefined,
          basePrice: form.basePrice ? Number(form.basePrice) : undefined,
          requiresAdvanceBooking: form.requiresAdvanceBooking,
          allowsWalkIn: form.allowsWalkIn,
        }),
      });
      setMsg("Facility created.");
      setForm({ name: "", code: "", type: "SPA", description: "", maxCapacity: "", basePrice: "", requiresAdvanceBooking: true, allowsWalkIn: false });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Create facility failed"); }
    finally { setSaving(false); }
  }

  async function createTomorrowSlot(facilityId: string) {
    setMsg(null); setError(null);
    setSlotSavingId(facilityId);
    try {
      const [hh, mm] = quickSlotTime.split(":");
      const duration = Number(quickSlotDurationMinutes || "60");
      if (!quickSlotDate || !hh || !mm || Number.isNaN(duration) || duration < 15) throw new Error("Choose a valid date/time and duration ≥15 min.");
      const start = new Date(`${quickSlotDate}T00:00:00`);
      start.setHours(Number(hh), Number(mm), 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/${facilityId}/slots`, {
        method: "POST",
        body: JSON.stringify({ startTime: toLocalIsoDateTime(start), endTime: toLocalIsoDateTime(end), maxBookings: 20 }),
      });
      setMsg(`Slot created for ${quickSlotDate} ${quickSlotTime} (${duration} min).`);
      if (selectedFacilityId === facilityId) await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Create slot failed"); }
    finally { setSlotSavingId(null); }
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId || !bookForm.slotId) { setError("Choose a facility and slot."); return; }
    if (bookForm.chargeToRoom && !bookForm.reservationId.trim()) { setError("Reservation ID is required when Charge to room folio is enabled."); return; }
    if (bookForm.reservationId.trim() && !isUuid(bookForm.reservationId.trim())) { setError("Reservation ID must be a UUID from the reservation URL."); return; }
    setBookingLoading(true); setError(null); setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        slotId: bookForm.slotId,
        guestCount: Number(bookForm.guestCount || "1"),
        reservationId: bookForm.reservationId.trim() || null,
        specialRequests: "",
        chargeToRoom: bookForm.chargeToRoom,
        payment: null,
      };
      if (!bookForm.reservationId.trim()) {
        payload.guest = {
          firstName: bookForm.firstName.trim() || "Walkin",
          lastName: bookForm.lastName.trim() || "Guest",
          email: bookForm.email.trim(),
          phone: bookForm.phone.trim() || null,
        };
      }
      const created = await apiFetch<BookingCreateResponse>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/bookings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setQrModal({
        ref: created.bookingReference,
        accessCode: created.access.accessCode,
        qrCode: created.access.qrCode,
        instructions: created.access.instructions,
      });
      setBookForm((f) => ({ ...f, reservationId: "", firstName: "", lastName: "", email: "", phone: "", chargeToRoom: false }));
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Booking failed"); }
    finally { setBookingLoading(false); }
  }

  async function checkInBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!checkinForm.bookingId || !checkinForm.accessCode.trim()) { setError("Booking and access code are required."); return; }
    setCheckinLoading(true); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${checkinForm.bookingId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ accessCode: checkinForm.accessCode.trim(), actualGuestCount: checkinForm.actualGuestCount ? Number(checkinForm.actualGuestCount) : null, staffNotes: "" }),
      });
      setMsg("Booking checked in.");
      setCheckinForm({ bookingId: "", accessCode: "", actualGuestCount: "" });
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Check-in failed"); }
    finally { setCheckinLoading(false); }
  }

  async function cancelBooking(bookingId: string) {
    setBookingActionId(bookingId); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${bookingId}/cancel`, { method: "POST" });
      setMsg("Booking cancelled.");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Cancel failed"); }
    finally { setBookingActionId(null); }
  }

  async function chargeBookingToRoom(bookingId: string) {
    setBookingActionId(bookingId); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${bookingId}/charge-to-room`, {
        method: "POST",
        body: JSON.stringify({ postedBy: "front-desk" }),
      });
      setMsg("Facility charge posted to room folio.");
      await loadDashboard();
    } catch (e) { setError(e instanceof Error ? e.message : "Charge to room failed"); }
    finally { setBookingActionId(null); }
  }

  async function submitMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId) { setError("Choose a facility first."); return; }
    if (!maintenanceForm.title.trim() || !maintenanceForm.scheduledStart) { setError("Maintenance title and start time are required."); return; }
    setMaintenanceSaving(true); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/maintenance`, {
        method: "PATCH",
        body: JSON.stringify({
          title: maintenanceForm.title.trim(),
          description: maintenanceForm.description.trim() || null,
          priority: maintenanceForm.priority,
          scheduledStart: new Date(maintenanceForm.scheduledStart).toISOString(),
          estimatedDurationMinutes: Number(maintenanceForm.estimatedDurationMinutes || "60"),
          cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : null,
          affectedSlots: [],
        }),
      });
      setMsg("Maintenance scheduled.");
      setMaintenanceForm({ title: "", description: "", priority: "MEDIUM", scheduledStart: "", estimatedDurationMinutes: "60", cost: "" });
      await loadMaintenance();
    } catch (e) { setError(e instanceof Error ? e.message : "Schedule maintenance failed"); }
    finally { setMaintenanceSaving(false); }
  }

  async function completeMaintenance() {
    if (!completeMaintenanceId) return;
    setCompleteSaving(true); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/maintenances/${completeMaintenanceId}/complete`, {
        method: "PUT",
        body: JSON.stringify({
          completedBy: completeForm.completedBy.trim() || null,
          inspectorNotes: completeForm.inspectorNotes.trim() || null,
          complianceStatus: completeForm.complianceStatus,
        }),
      });
      setMsg("Maintenance marked as completed.");
      setCompleteMaintenanceId(null);
      setCompleteForm({ completedBy: "", inspectorNotes: "", complianceStatus: "PASSED" });
      await loadMaintenance();
    } catch (e) { setError(e instanceof Error ? e.message : "Complete maintenance failed"); }
    finally { setCompleteSaving(false); }
  }

  async function submitWaterQuality(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId) { setError("Choose a facility."); return; }
    setWqSaving(true); setError(null); setMsg(null);
    try {
      const n = (v: string) => v.trim() ? Number(v) : null;
      await apiFetch<WaterQualityItem>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/water-quality`, {
        method: "POST",
        body: JSON.stringify({
          phLevel: n(wqForm.phLevel),
          freeChlorinePpm: n(wqForm.freeChlorinePpm),
          combinedChlorinePpm: n(wqForm.combinedChlorinePpm),
          temperatureCelsius: n(wqForm.temperatureCelsius),
          turbidityNtu: n(wqForm.turbidityNtu),
          totalDissolvedSolids: wqForm.totalDissolvedSolids.trim() ? Number(wqForm.totalDissolvedSolids) : null,
          alkalinityPpm: n(wqForm.alkalinityPpm),
          calciumHardnessPpm: n(wqForm.calciumHardnessPpm),
          notes: wqForm.notes.trim() || null,
          passedInspection: wqForm.passedInspection,
          inspectorName: wqForm.inspectorName.trim() || null,
        }),
      });
      setMsg("Water quality log saved.");
      setWqForm({ phLevel: "", freeChlorinePpm: "", combinedChlorinePpm: "", temperatureCelsius: "", turbidityNtu: "", totalDissolvedSolids: "", alkalinityPpm: "", calciumHardnessPpm: "", notes: "", passedInspection: true, inspectorName: "" });
      await loadWaterQuality();
    } catch (e) { setError(e instanceof Error ? e.message : "Log failed"); }
    finally { setWqSaving(false); }
  }

  async function submitLifeguardShift(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId) { setError("Choose a facility."); return; }
    if (!lgForm.staffName.trim() || !lgForm.shiftDate || !lgForm.shiftStart || !lgForm.shiftEnd) {
      setError("Staff name, shift date, start, and end are required."); return;
    }
    setLgSaving(true); setError(null); setMsg(null);
    try {
      await apiFetch<LifeguardShiftItem>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/lifeguards`, {
        method: "POST",
        body: JSON.stringify({
          staffName: lgForm.staffName.trim(),
          staffEmail: lgForm.staffEmail.trim() || null,
          certificationName: lgForm.certificationName.trim() || null,
          certificationExpiry: lgForm.certificationExpiry || null,
          shiftDate: lgForm.shiftDate,
          shiftStart: lgForm.shiftStart,
          shiftEnd: lgForm.shiftEnd,
          notes: lgForm.notes.trim() || null,
        }),
      });
      setMsg("Shift added.");
      setLgForm({ staffName: "", staffEmail: "", certificationName: "", certificationExpiry: "", shiftDate: ymd(1), shiftStart: "08:00", shiftEnd: "16:00", notes: "" });
      await loadLifeguards();
    } catch (e) { setError(e instanceof Error ? e.message : "Add shift failed"); }
    finally { setLgSaving(false); }
  }

  async function submitIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId) { setError("Choose a facility."); return; }
    if (!incForm.title.trim()) { setError("Incident title is required."); return; }
    setIncSaving(true); setError(null); setMsg(null);
    try {
      await apiFetch<IncidentItem>(`/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/incidents`, {
        method: "POST",
        body: JSON.stringify({
          occurredAt: new Date().toISOString(),
          title: incForm.title.trim(),
          description: incForm.description.trim() || null,
          severity: incForm.severity,
          witnessNames: incForm.witnessNames.trim() || null,
        }),
      });
      setMsg("Incident reported.");
      setIncForm({ title: "", description: "", severity: "LOW", witnessNames: "" });
      await loadIncidents();
    } catch (e) { setError(e instanceof Error ? e.message : "Report incident failed"); }
    finally { setIncSaving(false); }
  }

  async function resolveIncident() {
    if (!resolveId) return;
    if (!resolveForm.resolvedBy.trim()) { setError("Resolved by is required."); return; }
    setResolveSaving(true); setError(null); setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/incidents/${resolveId}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ resolution: resolveForm.resolution.trim() || null, resolvedBy: resolveForm.resolvedBy.trim() }),
      });
      setMsg("Incident resolved.");
      setResolveId(null);
      setResolveForm({ resolution: "", resolvedBy: "" });
      await loadIncidents();
    } catch (e) { setError(e instanceof Error ? e.message : "Resolve failed"); }
    finally { setResolveSaving(false); }
  }

  const occupancyPct = dashboard && dashboard.totalCapacity > 0
    ? Math.round((dashboard.occupiedCount / dashboard.totalCapacity) * 100)
    : 0;
  const capacityAlert = occupancyPct >= 90 ? "bg-red-500" : occupancyPct >= 75 ? "bg-amber-400" : "bg-emerald-500";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facilities</h1>
            <p className="text-muted-foreground mt-1">Pool, spa, gym, and recreational facility management</p>
          </div>
          {rows && <div className="text-sm text-muted-foreground"><strong className="text-foreground">{rows.length}</strong> facilities</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary.total },
          { label: "Pool", value: summary.pool },
          { label: "Spa", value: summary.spa },
          { label: "Gym", value: summary.gym },
          { label: "Meeting", value: summary.meeting },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs uppercase text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Facility selector (shared) */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
        <label className="text-sm font-medium text-muted-foreground">Active facility</label>
        <select
          className="mt-1 w-full md:w-72"
          value={selectedFacilityId}
          onChange={(e) => setSelectedFacilityId(e.target.value)}
        >
          <option value="">Choose facility</option>
          {(rows ?? []).map((f) => (
            <option key={f.id} value={f.id}>{getFacilityIcon(f.type)} {f.name}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(["operations", "water-quality", "lifeguards", "incidents", "revenue", "maintenance", "settings"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={tab === t ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
              onClick={() => setTab(t)}
            >
              {t === "operations" && "Operations"}
              {t === "water-quality" && "Water Quality"}
              {t === "lifeguards" && "Lifeguards"}
              {t === "incidents" && "Incidents"}
              {t === "revenue" && "Revenue"}
              {t === "maintenance" && "Maintenance"}
              {t === "settings" && "Settings"}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      {/* ── OPERATIONS TAB ─────────────────────────────────────────────────── */}
      {tab === "operations" && (
        <div className="space-y-4">
          {/* Slot calendar */}
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Slot calendar &amp; live occupancy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label>From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
              <div><label>To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
            </div>

            {dashboard && (
              <>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">Capacity</p>
                    <p className="text-xl font-bold">{dashboard.totalCapacity}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">Occupied</p>
                    <p className="text-xl font-bold">{dashboard.occupiedCount}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <p className="text-xs uppercase text-muted-foreground">Available</p>
                    <p className="text-xl font-bold">{dashboard.availableCount}</p>
                  </div>
                </div>
                {/* Capacity progress bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Occupancy</span>
                    <span className={`text-xs font-semibold ${occupancyPct >= 90 ? "text-red-600" : occupancyPct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
                      {occupancyPct}%
                      {occupancyPct >= 90 && " — Near capacity!"}
                      {occupancyPct >= 75 && occupancyPct < 90 && " — Filling up"}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full transition-all ${capacityAlert}`} style={{ width: `${occupancyPct}%` }} />
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Slot cards</h3>
                  {dashboardLoading ? (
                    <p className="text-sm text-muted-foreground">Loading slots...</p>
                  ) : dashboard.slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No slots in this range.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {dashboard.slots.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setBookForm((f) => ({ ...f, slotId: s.id }))}
                          className={`text-left rounded-lg border px-3 py-2 ${s.id === bookForm.slotId ? "border-primary ring-1 ring-primary" : s.status === "AVAILABLE" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
                        >
                          <p className="font-medium text-sm">{new Date(s.start).toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">{s.currentBookings}/{s.maxBookings} booked · {s.availableSpots} spots left</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Booking form */}
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Guest booking</h2>
              <form onSubmit={createBooking}>
                <label>Slot</label>
                <select value={bookForm.slotId} onChange={(e) => setBookForm((f) => ({ ...f, slotId: e.target.value }))}>
                  <option value="">Choose slot</option>
                  {(dashboard?.slots ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{new Date(s.start).toLocaleString()} ({s.availableSpots} spots)</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label>Guest count</label>
                    <input type="number" min={1} value={bookForm.guestCount} onChange={(e) => setBookForm((f) => ({ ...f, guestCount: e.target.value }))} />
                  </div>
                  <div>
                    <label>Charge to checked-in room (optional)</label>
                    <input
                      placeholder="Search guest/ref/room..."
                      value={reservationSearch}
                      onChange={(e) => setReservationSearch(e.target.value)}
                      style={{ marginBottom: "0.4rem" }}
                    />
                    <select
                      value={bookForm.reservationId}
                      onChange={(e) => setBookForm((f) => ({ ...f, reservationId: e.target.value }))}
                    >
                      <option value="">No room charge (walk-in)</option>
                      {checkedInReservations.map((r) => (
                        <option key={r.id} value={r.id}>{(r.booking_reference ?? "No ref")} · {(r.guestName ?? "Guest")} · Room {(r.roomNumber ?? "N/A")}</option>
                      ))}
                    </select>
                    {checkedInLoading && <p className="text-xs text-muted-foreground mt-1">Loading...</p>}
                  </div>
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Advanced: paste reservation UUID manually</summary>
                  <input className="mt-2" value={bookForm.reservationId} placeholder="e.g. a2fcf6ed-..." onChange={(e) => setBookForm((f) => ({ ...f, reservationId: e.target.value }))} />
                </details>
                {!bookForm.reservationId.trim() && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><label>First name</label><input value={bookForm.firstName} onChange={(e) => setBookForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
                    <div><label>Last name</label><input value={bookForm.lastName} onChange={(e) => setBookForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
                    <div><label>Email</label><input type="email" value={bookForm.email} onChange={(e) => setBookForm((f) => ({ ...f, email: e.target.value }))} /></div>
                    <div><label>Phone</label><input value={bookForm.phone} onChange={(e) => setBookForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                  </div>
                )}
                <label className="inline-flex items-center gap-2 mt-3">
                  <input type="checkbox" checked={bookForm.chargeToRoom} disabled={!bookForm.reservationId.trim()} onChange={(e) => setBookForm((f) => ({ ...f, chargeToRoom: e.target.checked }))} />
                  Charge to room folio
                </label>
                <div className="mt-4">
                  <button type="submit" className="hms-btn-solid" disabled={bookingLoading}>{bookingLoading ? "Booking..." : "Create booking"}</button>
                </div>
              </form>
            </div>

            {/* Check-in form + bookings list */}
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Booking check-in</h2>
              <form onSubmit={checkInBooking}>
                <label>Booking</label>
                <select value={checkinForm.bookingId} onChange={(e) => {
                  const id = e.target.value;
                  const hit = checkinCandidates.find((b) => b.bookingId === id);
                  setCheckinForm((f) => ({ ...f, bookingId: id, accessCode: hit?.accessCode ?? f.accessCode }));
                }}>
                  <option value="">Choose booking</option>
                  {checkinCandidates.map((b) => <option key={b.bookingId} value={b.bookingId}>{b.bookingReference} · {b.guestName}</option>)}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Only CONFIRMED bookings are eligible.</p>
                <label style={{ marginTop: "0.75rem" }}>Access code</label>
                <input value={checkinForm.accessCode} onChange={(e) => setCheckinForm((f) => ({ ...f, accessCode: e.target.value }))} />
                <label style={{ marginTop: "0.75rem" }}>Actual guest count (optional)</label>
                <input type="number" value={checkinForm.actualGuestCount} onChange={(e) => setCheckinForm((f) => ({ ...f, actualGuestCount: e.target.value }))} />
                <div style={{ marginTop: "1rem" }}>
                  <button type="submit" className="hms-btn-solid" disabled={checkinLoading}>{checkinLoading ? "Checking in..." : "Check in"}</button>
                </div>
              </form>

              <div className="mt-4">
                <h3 className="font-semibold mb-2">Bookings in range</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <input placeholder="Search booking/guest/status" value={bookingListQuery} onChange={(e) => { setBookingListQuery(e.target.value); setBookingListLimit(50); }} />
                  <select value={bookingListStatus} onChange={(e) => { setBookingListStatus(e.target.value as typeof bookingListStatus); setBookingListLimit(50); }}>
                    <option value="ALL">All statuses</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="CHECKED_IN">CHECKED_IN</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                {(dashboard?.bookings ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bookings yet.</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    {bookingPaging.slice.map((b) => (
                      <div key={b.bookingId} className="rounded border border-border/60 px-2 py-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-medium">{b.bookingReference}</span>
                            {" · "}{b.guestName}
                            {" · "}<span className="text-muted-foreground text-xs">{b.status}</span>
                          </div>
                          <div className="flex gap-1">
                            {(b.status === "CONFIRMED" || b.status === "CHECKED_IN") && (
                              <button type="button" className="hms-btn-outline text-xs" disabled={bookingActionId === b.bookingId} onClick={() => void cancelBooking(b.bookingId)}>
                                {bookingActionId === b.bookingId ? "..." : "Cancel"}
                              </button>
                            )}
                            {b.status === "CONFIRMED" && (
                              <button type="button" className="hms-btn-outline text-xs" disabled={bookingActionId === b.bookingId} onClick={() => void chargeBookingToRoom(b.bookingId)}>
                                {bookingActionId === b.bookingId ? "..." : "Charge room"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <PaginationBar page={bookingPage} totalPages={bookingPaging.totalPages} totalItems={bookingPaging.total} pageSize={BOOKING_PAGE_SIZE} noun="bookings" onPageChange={setBookingPage} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WATER QUALITY TAB ──────────────────────────────────────────────── */}
      {tab === "water-quality" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-4">Log water quality reading</h2>
            <form onSubmit={submitWaterQuality} className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label>pH level</label><input type="number" step="0.01" placeholder="7.20" value={wqForm.phLevel} onChange={(e) => setWqForm((f) => ({ ...f, phLevel: e.target.value }))} /></div>
              <div><label>Free Cl₂ (ppm)</label><input type="number" step="0.01" placeholder="1.50" value={wqForm.freeChlorinePpm} onChange={(e) => setWqForm((f) => ({ ...f, freeChlorinePpm: e.target.value }))} /></div>
              <div><label>Combined Cl₂ (ppm)</label><input type="number" step="0.01" value={wqForm.combinedChlorinePpm} onChange={(e) => setWqForm((f) => ({ ...f, combinedChlorinePpm: e.target.value }))} /></div>
              <div><label>Temp (°C)</label><input type="number" step="0.1" value={wqForm.temperatureCelsius} onChange={(e) => setWqForm((f) => ({ ...f, temperatureCelsius: e.target.value }))} /></div>
              <div><label>Turbidity (NTU)</label><input type="number" step="0.001" value={wqForm.turbidityNtu} onChange={(e) => setWqForm((f) => ({ ...f, turbidityNtu: e.target.value }))} /></div>
              <div><label>TDS (ppm)</label><input type="number" value={wqForm.totalDissolvedSolids} onChange={(e) => setWqForm((f) => ({ ...f, totalDissolvedSolids: e.target.value }))} /></div>
              <div><label>Alkalinity (ppm)</label><input type="number" step="0.01" value={wqForm.alkalinityPpm} onChange={(e) => setWqForm((f) => ({ ...f, alkalinityPpm: e.target.value }))} /></div>
              <div><label>Ca hardness (ppm)</label><input type="number" step="0.01" value={wqForm.calciumHardnessPpm} onChange={(e) => setWqForm((f) => ({ ...f, calciumHardnessPpm: e.target.value }))} /></div>
              <div><label>Inspector name</label><input value={wqForm.inspectorName} onChange={(e) => setWqForm((f) => ({ ...f, inspectorName: e.target.value }))} /></div>
              <div className="md:col-span-3"><label>Notes</label><input value={wqForm.notes} onChange={(e) => setWqForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="col-span-2 md:col-span-4 flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={wqForm.passedInspection} onChange={(e) => setWqForm((f) => ({ ...f, passedInspection: e.target.checked }))} />
                  Passed inspection
                </label>
                <button type="submit" className="hms-btn-solid" disabled={wqSaving}>{wqSaving ? "Saving..." : "Save reading"}</button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Water quality history</h3>
              <button type="button" className="hms-btn-outline text-xs" onClick={() => void loadWaterQuality()}>Refresh</button>
            </div>
            {waterLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : waterLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No water quality logs yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-muted-foreground">
                      <th className="py-1.5 pr-3">Logged at</th>
                      <th className="pr-3">By</th>
                      <th className="pr-3">pH</th>
                      <th className="pr-3">Cl₂ free</th>
                      <th className="pr-3">Temp °C</th>
                      <th className="pr-3">Turbidity</th>
                      <th className="pr-3">Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waterLogs.map((w) => (
                      <tr key={w.id} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="py-1 pr-3 whitespace-nowrap">{new Date(w.loggedAt).toLocaleString()}</td>
                        <td className="pr-3 whitespace-nowrap">{w.loggedBy}</td>
                        <td className="pr-3">{w.phLevel ?? "—"}</td>
                        <td className="pr-3">{w.freeChlorinePpm ?? "—"}</td>
                        <td className="pr-3">{w.temperatureCelsius ?? "—"}</td>
                        <td className="pr-3">{w.turbidityNtu ?? "—"}</td>
                        <td className="pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${w.passedInspection ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                            {w.passedInspection ? "PASS" : "FAIL"}
                          </span>
                        </td>
                        <td className="text-muted-foreground max-w-[12rem] truncate">{w.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIFEGUARDS TAB ─────────────────────────────────────────────────── */}
      {tab === "lifeguards" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-4">Add lifeguard / staff shift</h2>
            <form onSubmit={submitLifeguardShift} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div><label>Staff name *</label><input value={lgForm.staffName} onChange={(e) => setLgForm((f) => ({ ...f, staffName: e.target.value }))} /></div>
              <div><label>Email</label><input type="email" value={lgForm.staffEmail} onChange={(e) => setLgForm((f) => ({ ...f, staffEmail: e.target.value }))} /></div>
              <div><label>Certification name</label><input value={lgForm.certificationName} onChange={(e) => setLgForm((f) => ({ ...f, certificationName: e.target.value }))} /></div>
              <div><label>Cert expiry</label><input type="date" value={lgForm.certificationExpiry} onChange={(e) => setLgForm((f) => ({ ...f, certificationExpiry: e.target.value }))} /></div>
              <div><label>Shift date *</label><input type="date" value={lgForm.shiftDate} onChange={(e) => setLgForm((f) => ({ ...f, shiftDate: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><label>Start *</label><input type="time" value={lgForm.shiftStart} onChange={(e) => setLgForm((f) => ({ ...f, shiftStart: e.target.value }))} /></div>
                <div><label>End *</label><input type="time" value={lgForm.shiftEnd} onChange={(e) => setLgForm((f) => ({ ...f, shiftEnd: e.target.value }))} /></div>
              </div>
              <div className="lg:col-span-3"><label>Notes</label><input value={lgForm.notes} onChange={(e) => setLgForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="lg:col-span-3">
                <button type="submit" className="hms-btn-solid" disabled={lgSaving}>{lgSaving ? "Saving..." : "Add shift"}</button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold">Staff roster</h3>
              <div className="flex items-center gap-2">
                <input type="date" className="text-xs" value={lgShiftFilter} onChange={(e) => setLgShiftFilter(e.target.value)} />
                {lgShiftFilter && <button type="button" className="hms-btn-outline text-xs" onClick={() => setLgShiftFilter("")}>Clear</button>}
                <button type="button" className="hms-btn-outline text-xs" onClick={() => void loadLifeguards()}>Refresh</button>
              </div>
            </div>
            {lifeguardLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : lifeguards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No shifts scheduled.</p>
            ) : (
              <div className="space-y-2">
                {lifeguards.map((lg) => (
                  <div key={lg.id} className="rounded border border-border/60 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{lg.staffName}</span>
                        {lg.staffEmail && <span className="text-muted-foreground ml-2 text-xs">{lg.staffEmail}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {lg.certificationExpiringSoon && (
                          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Cert expiring soon</span>
                        )}
                        <span className="text-xs text-muted-foreground">{lg.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lg.shiftDate} · {lg.shiftStart} – {lg.shiftEnd}
                      {lg.certificationName && <> · Cert: {lg.certificationName}{lg.certificationExpiry && ` (exp. ${lg.certificationExpiry})`}</>}
                    </p>
                    {lg.notes && <p className="text-xs text-muted-foreground mt-0.5">{lg.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── INCIDENTS TAB ──────────────────────────────────────────────────── */}
      {tab === "incidents" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-4">Report incident</h2>
            <form onSubmit={submitIncident} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label>Title *</label><input value={incForm.title} onChange={(e) => setIncForm((f) => ({ ...f, title: e.target.value }))} /></div>
              <div>
                <label>Severity</label>
                <select value={incForm.severity} onChange={(e) => setIncForm((f) => ({ ...f, severity: e.target.value }))}>
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div><label>Witness names</label><input placeholder="Comma-separated names" value={incForm.witnessNames} onChange={(e) => setIncForm((f) => ({ ...f, witnessNames: e.target.value }))} /></div>
              <div className="md:col-span-2"><label>Description</label><input value={incForm.description} onChange={(e) => setIncForm((f) => ({ ...f, description: e.target.value }))} /></div>
              <div className="md:col-span-2">
                <button type="submit" className="hms-btn-solid" disabled={incSaving}>{incSaving ? "Reporting..." : "Report incident"}</button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Incident log</h3>
              <button type="button" className="hms-btn-outline text-xs" onClick={() => void loadIncidents()}>Refresh</button>
            </div>
            {incidentsLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : incidents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents recorded.</p>
            ) : (
              <div className="space-y-3">
                {incidents.map((inc) => (
                  <div key={inc.id} className={`rounded border p-3 text-sm ${severityColor(inc.severity)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{inc.title}</p>
                        <p className="text-xs mt-0.5">
                          {new Date(inc.occurredAt).toLocaleString()} · Reported by {inc.reportedBy}
                          {inc.witnessNames && <> · Witnesses: {inc.witnessNames}</>}
                        </p>
                        {inc.description && <p className="mt-1 text-xs">{inc.description}</p>}
                        {inc.status === "RESOLVED" && inc.resolution && (
                          <p className="mt-1 text-xs opacity-80">Resolution: {inc.resolution} (by {inc.resolvedBy}, {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : ""})</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{inc.status}</span>
                        {inc.status === "OPEN" && (
                          <button type="button" className="hms-btn-outline text-xs bg-white" onClick={() => { setResolveId(inc.id); setResolveForm({ resolution: "", resolvedBy: "" }); }}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resolve modal */}
          {resolveId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl">
                <h3 className="text-lg font-semibold mb-4">Resolve incident</h3>
                <div className="space-y-3">
                  <div><label>Resolution details</label><input value={resolveForm.resolution} onChange={(e) => setResolveForm((f) => ({ ...f, resolution: e.target.value }))} /></div>
                  <div><label>Resolved by *</label><input value={resolveForm.resolvedBy} onChange={(e) => setResolveForm((f) => ({ ...f, resolvedBy: e.target.value }))} /></div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button type="button" className="hms-btn-solid" disabled={resolveSaving} onClick={() => void resolveIncident()}>{resolveSaving ? "Saving..." : "Mark resolved"}</button>
                  <button type="button" className="hms-btn-outline" onClick={() => setResolveId(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REVENUE TAB ────────────────────────────────────────────────────── */}
      {tab === "revenue" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div><label>From</label><input type="date" value={revFrom} onChange={(e) => setRevFrom(e.target.value)} /></div>
              <div><label>To</label><input type="date" value={revTo} onChange={(e) => setRevTo(e.target.value)} /></div>
              <button type="button" className="hms-btn-solid" onClick={() => void loadRevenue()} disabled={revenueLoading}>
                {revenueLoading ? "Loading..." : "Load revenue"}
              </button>
            </div>

            {revenueSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {[
                    { label: "Total bookings", value: revenueSummary.totalBookings.toString() },
                    { label: "Currently checked in", value: revenueSummary.checkedInCount.toString() },
                    { label: "Total revenue", value: `$${fmt(revenueSummary.totalRevenue)}` },
                    { label: "Room charged", value: `$${fmt(revenueSummary.roomChargedRevenue)}` },
                    { label: "Direct payment", value: `$${fmt(revenueSummary.directRevenue)}` },
                  ].map((c) => (
                    <div key={c.label} className="rounded-lg border border-border/60 bg-background px-3 py-3">
                      <p className="text-xs uppercase text-muted-foreground">{c.label}</p>
                      <p className="text-xl font-bold mt-0.5">{c.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Period: {revenueSummary.fromDate} → {revenueSummary.toDate} · Facility: {revenueSummary.facilityName}</p>
                {/* Revenue breakdown bar */}
                {revenueSummary.totalRevenue > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Revenue breakdown</p>
                    <div className="h-4 w-full rounded-full overflow-hidden flex bg-muted">
                      <div
                        className="bg-primary h-4 transition-all"
                        style={{ width: `${(revenueSummary.roomChargedRevenue / revenueSummary.totalRevenue) * 100}%` }}
                        title={`Room charged: $${fmt(revenueSummary.roomChargedRevenue)}`}
                      />
                      <div
                        className="bg-emerald-500 h-4 transition-all"
                        style={{ width: `${(revenueSummary.directRevenue / revenueSummary.totalRevenue) * 100}%` }}
                        title={`Direct: $${fmt(revenueSummary.directRevenue)}`}
                      />
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-primary" /> Room charged</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> Direct</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a facility and click Load revenue.</p>
            )}
          </div>
        </div>
      )}

      {/* ── MAINTENANCE TAB ────────────────────────────────────────────────── */}
      {tab === "maintenance" && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-4">Schedule maintenance window</h2>
            <form onSubmit={submitMaintenance} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label>Title</label><input value={maintenanceForm.title} onChange={(e) => setMaintenanceForm((m) => ({ ...m, title: e.target.value }))} /></div>
              <div>
                <label>Priority</label>
                <select value={maintenanceForm.priority} onChange={(e) => setMaintenanceForm((m) => ({ ...m, priority: e.target.value }))}>
                  <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
                </select>
              </div>
              <div><label>Start time</label><input type="datetime-local" value={maintenanceForm.scheduledStart} onChange={(e) => setMaintenanceForm((m) => ({ ...m, scheduledStart: e.target.value }))} /></div>
              <div><label>Duration (min)</label><input type="number" min={15} step={15} value={maintenanceForm.estimatedDurationMinutes} onChange={(e) => setMaintenanceForm((m) => ({ ...m, estimatedDurationMinutes: e.target.value }))} /></div>
              <div><label>Cost (optional)</label><input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm((m) => ({ ...m, cost: e.target.value }))} /></div>
              <div><label>Description</label><input value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((m) => ({ ...m, description: e.target.value }))} /></div>
              <div className="md:col-span-2">
                <button type="submit" className="hms-btn-solid" disabled={maintenanceSaving}>{maintenanceSaving ? "Scheduling..." : "Schedule maintenance"}</button>
              </div>
            </form>
          </div>

          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h3 className="font-semibold mb-3">Scheduled maintenance</h3>
            {maintenanceItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance entries yet.</p>
            ) : (
              <div className="space-y-2">
                {maintenanceItems.map((m) => (
                  <div key={m.maintenanceId} className="rounded border border-border/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.status} · {m.priority}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.status === "COMPLETED" && m.complianceStatus && (
                          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${m.complianceStatus === "PASSED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                            {m.complianceStatus}
                          </span>
                        )}
                        {m.status !== "COMPLETED" && (
                          <button type="button" className="hms-btn-outline text-xs" onClick={() => { setCompleteMaintenanceId(m.maintenanceId); setCompleteForm({ completedBy: "", inspectorNotes: "", complianceStatus: "PASSED" }); }}>
                            Mark complete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {m.scheduledStart ? new Date(m.scheduledStart).toLocaleString() : "No start"}
                      {m.scheduledEnd ? ` → ${new Date(m.scheduledEnd).toLocaleString()}` : ""}
                    </p>
                    {m.description && <p className="mt-1 text-xs">{m.description}</p>}
                    {m.completedBy && <p className="mt-0.5 text-xs text-muted-foreground">Completed by: {m.completedBy}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Maintenance complete modal */}
      {completeMaintenanceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Complete maintenance</h3>
            <div className="space-y-3">
              <div><label>Completed by</label><input value={completeForm.completedBy} placeholder="Name (defaults to current user)" onChange={(e) => setCompleteForm((f) => ({ ...f, completedBy: e.target.value }))} /></div>
              <div><label>Inspector notes</label><input value={completeForm.inspectorNotes} onChange={(e) => setCompleteForm((f) => ({ ...f, inspectorNotes: e.target.value }))} /></div>
              <div>
                <label>Compliance status</label>
                <select value={completeForm.complianceStatus} onChange={(e) => setCompleteForm((f) => ({ ...f, complianceStatus: e.target.value }))}>
                  <option value="PASSED">PASSED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="PENDING">PENDING</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" className="hms-btn-solid" disabled={completeSaving} onClick={() => void completeMaintenance()}>{completeSaving ? "Saving..." : "Mark complete"}</button>
              <button type="button" className="hms-btn-outline" onClick={() => setCompleteMaintenanceId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ───────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
            <h2 className="text-lg font-semibold mb-4">Create facility</h2>
            <form onSubmit={createFacility}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
                <div><label>Code</label><input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
                <div><label>Type</label><select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
                <div><label>Max capacity</label><input type="number" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} /></div>
                <div><label>Base price</label><input type="number" step="0.01" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} /></div>
                <div className="md:col-span-2 lg:col-span-3"><label>Description</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.requiresAdvanceBooking} onChange={(e) => setForm((f) => ({ ...f, requiresAdvanceBooking: e.target.checked }))} /> Advance booking</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.allowsWalkIn} onChange={(e) => setForm((f) => ({ ...f, allowsWalkIn: e.target.checked }))} /> Walk-in allowed</label>
              </div>
              <div className="mt-4"><button type="submit" className="hms-btn-solid" disabled={saving}>{saving ? "Creating..." : "Create facility"}</button></div>
            </form>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Facility list</h2>
              <p className="text-muted-foreground mt-1 text-sm">Manage bookable assets and create slots</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div><label className="text-xs text-muted-foreground">Quick slot date</label><input type="date" value={quickSlotDate} onChange={(e) => setQuickSlotDate(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Start time</label><input type="time" value={quickSlotTime} onChange={(e) => setQuickSlotTime(e.target.value)} /></div>
              <div><label className="text-xs text-muted-foreground">Duration (min)</label><input type="number" min={15} step={15} value={quickSlotDurationMinutes} onChange={(e) => setQuickSlotDurationMinutes(e.target.value)} /></div>
              <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>Refresh</button>
            </div>
          </div>

          {rows && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slice.map((r) => (
                  <div key={r.id} className="bg-card rounded-xl border border-border/60 p-5 shadow-soft hover:shadow-float transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">{getFacilityIcon(r.type)}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{r.name}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          {r.code && <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{r.code}</code>}
                          {r.type && <span className="capitalize">{r.type.replace(/_/g, " ")}</span>}
                        </div>
                        <div className="mt-3">
                          <button type="button" className="hms-btn-outline text-xs" onClick={() => void createTomorrowSlot(r.id)} disabled={slotSavingId === r.id}>
                            {slotSavingId === r.id ? "Creating slot..." : "Create quick slot"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {rows.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-muted-foreground">
                  No facilities yet. Create your first facility above.
                </div>
              )}
              <PaginationBar page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} noun="facilities" onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* ── QR Code Access Pass Modal ───────────────────────────────────────── */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-xl text-center">
            <h3 className="text-lg font-semibold mb-1">Booking confirmed</h3>
            <p className="text-sm text-muted-foreground mb-4">{qrModal.ref}</p>
            {qrModal.qrCode ? (
              <div className="flex justify-center mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrModal.qrCode} alt="Facility access QR code" className="w-48 h-48 rounded-xl border border-border/60" />
              </div>
            ) : (
              <div className="w-48 h-48 mx-auto mb-4 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
                QR not available
              </div>
            )}
            <div className="bg-muted rounded-lg px-3 py-2 mb-3">
              <p className="text-xs text-muted-foreground mb-0.5">Access code</p>
              <p className="font-mono font-semibold tracking-widest">{qrModal.accessCode}</p>
            </div>
            {qrModal.instructions && (
              <p className="text-xs text-muted-foreground mb-4">{qrModal.instructions}</p>
            )}
            <button type="button" className="hms-btn-solid w-full" onClick={() => setQrModal(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
