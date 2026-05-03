"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Facility = { id: string; name: string; code?: string; type?: string };
type CreateFacilityRequest = {
  name: string;
  code: string;
  description?: string;
  type: string;
  maxCapacity?: number;
  basePrice?: number;
  requiresAdvanceBooking?: boolean;
  allowsWalkIn?: boolean;
};
type CreateSlotResponse = { slotId: string; start: string; end: string; maxBookings: number; status: string };
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
  access: { accessCode: string };
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
};

const PAGE_SIZE = 10;
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

export default function FacilitiesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<"operations" | "settings" | "maintenance">("operations");
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
  const BOOKING_PAGE_SIZE = 8;
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
    if (bookingListStatus !== "ALL") {
      list = list.filter((b) => b.status === bookingListStatus);
    }
    if (q) {
      list = list.filter(
        (b) =>
          b.bookingReference.toLowerCase().includes(q) ||
          b.guestName.toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q),
      );
    }
    return list.slice(0, bookingListLimit);
  }, [dashboard?.bookings, bookingListLimit, bookingListQuery, bookingListStatus]);
  const bookingPaging = useMemo(
    () => paginateSlice(visibleBookings, bookingPage, BOOKING_PAGE_SIZE),
    [visibleBookings, bookingPage],
  );

  useEffect(() => {
    const t = setTimeout(() => setReservationSearchDebounced(reservationSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [reservationSearch]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const json = await apiFetch<Facility[]>(`/api/v1/hotels/${hotelId}/facilities`);
      setRows(json);
      setPage(1);
      if (!selectedFacilityId && json.length > 0) {
        setSelectedFacilityId(json[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, [hotelId, selectedFacilityId]);

  const loadDashboard = useCallback(async () => {
    if (!selectedFacilityId) {
      setDashboard(null);
      return;
    }
    setDashboardLoading(true);
    try {
      const d = await apiFetch<FacilityDashboard>(
        `/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/dashboard?fromDate=${fromDate}&toDate=${toDate}`,
      );
      setDashboard(d);
    } catch (e) {
      setDashboard(null);
      setError(e instanceof Error ? e.message : "Failed to load slot calendar");
    } finally {
      setDashboardLoading(false);
    }
  }, [hotelId, selectedFacilityId, fromDate, toDate]);

  const loadMaintenance = useCallback(async () => {
    if (!selectedFacilityId) {
      setMaintenanceItems([]);
      return;
    }
    try {
      const data = await apiFetch<MaintenanceItem[]>(
        `/api/v1/hotels/${hotelId}/facilities/${selectedFacilityId}/maintenances`,
      );
      setMaintenanceItems(data ?? []);
    } catch {
      setMaintenanceItems([]);
    }
  }, [hotelId, selectedFacilityId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadMaintenance();
  }, [loadMaintenance]);

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
        const data = await apiFetch<ReservationOption[]>(
          `/api/v1/hotels/${hotelId}/reservations?${p.toString()}`,
        );
        if (!cancelled) setCheckedInReservations(data.filter((r) => r.id).slice(0, 20));
      } catch {
        if (!cancelled) setCheckedInReservations([]);
      } finally {
        if (!cancelled) setCheckedInLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, reservationSearchDebounced]);

  const { slice, total, totalPages } = useMemo(() => paginateSlice(rows ?? [], page, PAGE_SIZE), [rows, page]);
  const summary = useMemo(() => {
    const all = rows ?? [];
    const byType = all.reduce<Record<string, number>>((acc, r) => {
      const t = (r.type ?? "OTHER").toUpperCase();
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    return {
      total: all.length,
      pool: byType.POOL ?? 0,
      spa: byType.SPA ?? 0,
      gym: byType.GYM ?? 0,
      meeting: byType.MEETING_ROOM ?? 0,
    };
  }, [rows]);

  const getFacilityIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case "spa":
        return "💆";
      case "gym":
        return "💪";
      case "pool":
        return "🏊";
      case "restaurant":
        return "🍽️";
      case "meeting_room":
        return "🤝";
      case "parking":
        return "🅿️";
      default:
        return "🏢";
    }
  };

  async function createFacility(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!form.name.trim() || !form.code.trim()) {
      setError("Facility name and code are required.");
      return;
    }
    setSaving(true);
    try {
      const payload: CreateFacilityRequest = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        type: form.type,
        description: form.description.trim() || undefined,
        maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : undefined,
        basePrice: form.basePrice ? Number(form.basePrice) : undefined,
        requiresAdvanceBooking: form.requiresAdvanceBooking,
        allowsWalkIn: form.allowsWalkIn,
      };
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities`, { method: "POST", body: JSON.stringify(payload) });
      setMsg("Facility created.");
      setForm({
        name: "",
        code: "",
        type: "SPA",
        description: "",
        maxCapacity: "",
        basePrice: "",
        requiresAdvanceBooking: true,
        allowsWalkIn: false,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create facility failed");
    } finally {
      setSaving(false);
    }
  }

  async function createTomorrowSlot(facilityId: string) {
    setMsg(null);
    setError(null);
    setSlotSavingId(facilityId);
    try {
      const [hh, mm] = quickSlotTime.split(":");
      const duration = Number(quickSlotDurationMinutes || "60");
      if (!quickSlotDate || !hh || !mm || Number.isNaN(duration) || duration < 15) {
        throw new Error("Choose a valid quick slot date/time and a duration of at least 15 minutes.");
      }
      const start = new Date(`${quickSlotDate}T00:00:00`);
      start.setHours(Number(hh), Number(mm), 0, 0);
      const end = new Date(start.getTime() + duration * 60 * 1000);
      await apiFetch<CreateSlotResponse>(`/api/v1/hotels/${hotelId}/facilities/${facilityId}/slots`, {
        method: "POST",
        body: JSON.stringify({
          startTime: toLocalIsoDateTime(start),
          endTime: toLocalIsoDateTime(end),
          maxBookings: 20,
        }),
      });
      setMsg(`Slot created for ${quickSlotDate} ${quickSlotTime} (${duration} min).`);
      if (selectedFacilityId === facilityId) {
        await loadDashboard();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create slot failed");
    } finally {
      setSlotSavingId(null);
    }
  }

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId || !bookForm.slotId) {
      setError("Choose a facility and slot.");
      return;
    }
    if (bookForm.chargeToRoom && !bookForm.reservationId.trim()) {
      setError("Reservation ID is required when Charge to room folio is enabled.");
      return;
    }
    if (bookForm.reservationId.trim() && !isUuid(bookForm.reservationId.trim())) {
      setError("Reservation ID must be a UUID from the reservation URL, not a booking/reference number.");
      return;
    }
    setBookingLoading(true);
    setError(null);
    setMsg(null);
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
      setMsg(`Booking created: ${created.bookingReference} (Access: ${created.access.accessCode})`);
      setBookForm((f) => ({
        ...f,
        reservationId: "",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        chargeToRoom: false,
      }));
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBookingLoading(false);
    }
  }

  async function checkInBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!checkinForm.bookingId || !checkinForm.accessCode.trim()) {
      setError("Booking and access code are required.");
      return;
    }
    setCheckinLoading(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${checkinForm.bookingId}/check-in`, {
        method: "POST",
        body: JSON.stringify({
          accessCode: checkinForm.accessCode.trim(),
          actualGuestCount: checkinForm.actualGuestCount ? Number(checkinForm.actualGuestCount) : null,
          staffNotes: "",
        }),
      });
      setMsg("Booking checked in.");
      setCheckinForm({ bookingId: "", accessCode: "", actualGuestCount: "" });
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckinLoading(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    setBookingActionId(bookingId);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${bookingId}/cancel`, { method: "POST" });
      setMsg("Booking cancelled.");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBookingActionId(null);
    }
  }

  async function chargeBookingToRoom(bookingId: string) {
    setBookingActionId(bookingId);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${bookingId}/charge-to-room`, {
        method: "POST",
        body: JSON.stringify({ postedBy: "front-desk" }),
      });
      setMsg("Facility charge posted to room folio.");
      await loadDashboard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Charge to room failed");
    } finally {
      setBookingActionId(null);
    }
  }

  async function submitMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFacilityId) {
      setError("Choose a facility first.");
      return;
    }
    if (!maintenanceForm.title.trim() || !maintenanceForm.scheduledStart) {
      setError("Maintenance title and start time are required.");
      return;
    }
    setMaintenanceSaving(true);
    setError(null);
    setMsg(null);
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
      setMaintenanceForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        scheduledStart: "",
        estimatedDurationMinutes: "60",
        cost: "",
      });
      await loadDashboard();
      await loadMaintenance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Schedule maintenance failed");
    } finally {
      setMaintenanceSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Facilities</h1>
            <p className="text-muted-foreground mt-1">Slots, occupancy, booking, and check-in in one workspace</p>
          </div>
          {rows && <div className="text-sm text-muted-foreground"><strong className="text-foreground">{rows.length}</strong> facilities</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs uppercase text-muted-foreground">Total</p><p className="text-2xl font-bold">{summary.total}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs uppercase text-muted-foreground">Pool</p><p className="text-2xl font-bold">{summary.pool}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs uppercase text-muted-foreground">Spa</p><p className="text-2xl font-bold">{summary.spa}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs uppercase text-muted-foreground">Gym</p><p className="text-2xl font-bold">{summary.gym}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs uppercase text-muted-foreground">Meeting</p><p className="text-2xl font-bold">{summary.meeting}</p></div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tab === "operations" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("operations")}>Operations</button>
          <button type="button" className={tab === "settings" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("settings")}>Settings</button>
          <button type="button" className={tab === "maintenance" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("maintenance")}>Maintenance</button>
        </div>
      </div>

      {tab === "operations" && <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <h2 className="text-lg font-semibold mb-3">Slot calendar + live occupancy</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><label>Facility</label><select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)}><option value="">Choose facility</option>{(rows ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div><label>From</label><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
          <div><label>To</label><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
        </div>
        {dashboard && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2"><p className="text-xs uppercase text-muted-foreground">Capacity</p><p className="text-xl font-bold">{dashboard.totalCapacity}</p></div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2"><p className="text-xs uppercase text-muted-foreground">Occupied</p><p className="text-xl font-bold">{dashboard.occupiedCount}</p></div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2"><p className="text-xs uppercase text-muted-foreground">Available</p><p className="text-xl font-bold">{dashboard.availableCount}</p></div>
            </div>
            <div className="mt-3">
              <h3 className="font-semibold mb-2">Slot cards</h3>
              {dashboardLoading ? (
                <p className="text-sm text-muted-foreground">Loading slots...</p>
              ) : dashboard.slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slots in this range.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {dashboard.slots.map((s) => (
                    <button key={s.id} type="button" onClick={() => setBookForm((f) => ({ ...f, slotId: s.id }))} className={`text-left rounded-lg border px-3 py-2 ${s.status === "AVAILABLE" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                      <p className="font-medium">{new Date(s.start).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{s.currentBookings}/{s.maxBookings} booked · {s.availableSpots} spots left</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>}

      {tab === "operations" && <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Guest booking</h2>
          <form onSubmit={createBooking}>
            <label>Slot</label>
            <select value={bookForm.slotId} onChange={(e) => setBookForm((f) => ({ ...f, slotId: e.target.value }))}>
              <option value="">Choose slot</option>
              {(dashboard?.slots ?? []).map((s) => <option key={s.id} value={s.id}>{new Date(s.start).toLocaleString()} ({s.availableSpots} spots)</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div><label>Guest count</label><input type="number" value={bookForm.guestCount} onChange={(e) => setBookForm((f) => ({ ...f, guestCount: e.target.value }))} /></div>
              <div>
                <label>Charge to checked-in room (optional)</label>
                <input
                  placeholder="Search checked-in guest/ref/room..."
                  value={reservationSearch}
                  onChange={(e) => setReservationSearch(e.target.value)}
                  style={{ marginBottom: "0.4rem" }}
                />
                <select
                  value={bookForm.reservationId}
                  onChange={(e) => setBookForm((f) => ({ ...f, reservationId: e.target.value }))}
                >
                  <option value="">No room charge (walk-in payment)</option>
                  {checkedInReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {(r.booking_reference ?? "No ref")} · {(r.guestName ?? "Guest")} · Room {(r.roomNumber ?? "N/A")}
                    </option>
                  ))}
                </select>
                {checkedInLoading && <p className="text-xs text-muted-foreground mt-1">Loading checked-in reservations...</p>}
                {!checkedInLoading && checkedInReservations.length === 20 && (
                  <p className="text-xs text-muted-foreground mt-1">Showing top 20 matches. Refine search to narrow more.</p>
                )}
              </div>
            </div>
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer">Advanced: paste reservation UUID manually</summary>
              <input
                className="mt-2"
                value={bookForm.reservationId}
                placeholder="e.g. a2fcf6ed-c5d0-4007-a1c5-4d684b8a12f7"
                onChange={(e) => setBookForm((f) => ({ ...f, reservationId: e.target.value }))}
              />
            </details>
            {!bookForm.reservationId.trim() && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><label>First name</label><input value={bookForm.firstName} onChange={(e) => setBookForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
                <div><label>Last name</label><input value={bookForm.lastName} onChange={(e) => setBookForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
                <div><label>Email</label><input value={bookForm.email} onChange={(e) => setBookForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label>Phone</label><input value={bookForm.phone} onChange={(e) => setBookForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
            )}
            <label className="inline-flex items-center gap-2 mt-3">
              <input
                type="checkbox"
                checked={bookForm.chargeToRoom}
                disabled={!bookForm.reservationId.trim()}
                onChange={(e) => setBookForm((f) => ({ ...f, chargeToRoom: e.target.checked }))}
              />
              Charge to room folio
            </label>
            {!bookForm.reservationId.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                Enter a checked-in reservation ID to enable charge-to-room.
              </p>
            )}
            <div className="mt-4"><button type="submit" className="hms-btn-solid" disabled={bookingLoading}>{bookingLoading ? "Booking..." : "Create booking"}</button></div>
          </form>
        </div>

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
            <p className="text-xs text-muted-foreground mt-1">
              Only CONFIRMED bookings are check-in eligible.
            </p>
            <label style={{ marginTop: "0.75rem" }}>Access code</label>
            <input value={checkinForm.accessCode} onChange={(e) => setCheckinForm((f) => ({ ...f, accessCode: e.target.value }))} />
            <label style={{ marginTop: "0.75rem" }}>Actual guest count (optional)</label>
            <input type="number" value={checkinForm.actualGuestCount} onChange={(e) => setCheckinForm((f) => ({ ...f, actualGuestCount: e.target.value }))} />
            <div style={{ marginTop: "1rem" }}><button type="submit" className="hms-btn-solid" disabled={checkinLoading}>{checkinLoading ? "Checking in..." : "Check in booking"}</button></div>
          </form>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Facility bookings in selected range</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <input
                placeholder="Search booking/guest/status"
                value={bookingListQuery}
                onChange={(e) => {
                  setBookingListQuery(e.target.value);
                  setBookingListLimit(50);
                }}
              />
              <select
                value={bookingListStatus}
                onChange={(e) => {
                  setBookingListStatus(e.target.value as "ALL" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED");
                  setBookingListLimit(50);
                }}
              >
                <option value="ALL">All statuses</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="CHECKED_IN">CHECKED_IN</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
              <button type="button" className="hms-btn-outline text-sm" onClick={() => setBookingPage(1)}>
                Reset page
              </button>
            </div>
            {(dashboard?.bookings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No facility bookings yet for this window.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {bookingPaging.slice.map((b) => (
                  <div key={b.bookingId} className="rounded border border-border/60 px-2 py-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{b.bookingReference}</span> · {b.guestName} ·{" "}
                        <span className="text-muted-foreground">{b.status}</span>
                      </div>
                      <div className="flex gap-2">
                        {(b.status === "CONFIRMED" || b.status === "CHECKED_IN") && (
                          <button
                            type="button"
                            className="hms-btn-outline text-xs"
                            disabled={bookingActionId === b.bookingId}
                            onClick={() => void cancelBooking(b.bookingId)}
                          >
                            {bookingActionId === b.bookingId ? "..." : "Cancel"}
                          </button>
                        )}
                        {b.status === "CONFIRMED" && (
                          <button
                            type="button"
                            className="hms-btn-outline text-xs"
                            disabled={bookingActionId === b.bookingId}
                            onClick={() => void chargeBookingToRoom(b.bookingId)}
                          >
                            {bookingActionId === b.bookingId ? "..." : "Charge room"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <PaginationBar
                  page={bookingPage}
                  totalPages={bookingPaging.totalPages}
                  totalItems={bookingPaging.total}
                  pageSize={BOOKING_PAGE_SIZE}
                  noun="bookings"
                  onPageChange={setBookingPage}
                />
              </div>
            )}
          </div>
        </div>
      </div>}

      {tab === "settings" && <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
        <h2 className="text-lg font-semibold mb-4">Create facility</h2>
        <form onSubmit={createFacility}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div><label>Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label>Code</label><input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
            <div><label>Type</label><select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{FACILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label>Max capacity</label><input type="number" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} /></div>
            <div><label>Base price</label><input type="number" value={form.basePrice} onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))} /></div>
            <div className="md:col-span-2 lg:col-span-3"><label>Description</label><input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.requiresAdvanceBooking} onChange={(e) => setForm((f) => ({ ...f, requiresAdvanceBooking: e.target.checked }))} /> Advance booking</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.allowsWalkIn} onChange={(e) => setForm((f) => ({ ...f, allowsWalkIn: e.target.checked }))} /> Walk-in allowed</label>
          </div>
          <div className="mt-4"><button type="submit" className="hms-btn-solid" disabled={saving}>{saving ? "Creating..." : "Create facility"}</button></div>
        </form>
      </div>}

      {tab === "maintenance" && (
        <div className="space-y-4">
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Schedule maintenance window</h2>
          <form onSubmit={submitMaintenance} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label>Facility</label>
              <select value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)}>
                <option value="">Choose facility</option>
                {(rows ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div><label>Title</label><input value={maintenanceForm.title} onChange={(e) => setMaintenanceForm((m) => ({ ...m, title: e.target.value }))} /></div>
            <div><label>Priority</label><select value={maintenanceForm.priority} onChange={(e) => setMaintenanceForm((m) => ({ ...m, priority: e.target.value }))}><option value="LOW">LOW</option><option value="MEDIUM">MEDIUM</option><option value="HIGH">HIGH</option><option value="CRITICAL">CRITICAL</option></select></div>
            <div><label>Start time</label><input type="datetime-local" value={maintenanceForm.scheduledStart} onChange={(e) => setMaintenanceForm((m) => ({ ...m, scheduledStart: e.target.value }))} /></div>
            <div><label>Duration (min)</label><input type="number" min={15} step={15} value={maintenanceForm.estimatedDurationMinutes} onChange={(e) => setMaintenanceForm((m) => ({ ...m, estimatedDurationMinutes: e.target.value }))} /></div>
            <div><label>Cost (optional)</label><input type="number" value={maintenanceForm.cost} onChange={(e) => setMaintenanceForm((m) => ({ ...m, cost: e.target.value }))} /></div>
            <div className="md:col-span-2"><label>Description</label><input value={maintenanceForm.description} onChange={(e) => setMaintenanceForm((m) => ({ ...m, description: e.target.value }))} /></div>
            <div className="md:col-span-2">
              <button type="submit" className="hms-btn-solid" disabled={maintenanceSaving}>
                {maintenanceSaving ? "Scheduling..." : "Schedule maintenance"}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h3 className="text-base font-semibold mb-3">Scheduled maintenance</h3>
          {maintenanceItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance entries yet for this facility.</p>
          ) : (
            <div className="space-y-2">
              {maintenanceItems.map((m) => (
                <div key={m.maintenanceId} className="rounded border border-border/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">{m.status} · {m.priority}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.scheduledStart ? new Date(m.scheduledStart).toLocaleString() : "No start time"}
                    {m.scheduledEnd ? ` → ${new Date(m.scheduledEnd).toLocaleString()}` : ""}
                  </p>
                  {m.description && <p className="mt-1">{m.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}

      {tab === "settings" && <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Facility list</h2>
          <p className="text-muted-foreground mt-1">Manage bookable assets and seed slots for reservations</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Quick slot date</label>
            <input type="date" value={quickSlotDate} onChange={(e) => setQuickSlotDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Start time</label>
            <input type="time" value={quickSlotTime} onChange={(e) => setQuickSlotTime(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Duration (min)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={quickSlotDurationMinutes}
              onChange={(e) => setQuickSlotDurationMinutes(e.target.value)}
            />
          </div>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>Refresh</button>
        </div>
      </div>}

      {error && <div className="error">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      {tab === "settings" && rows && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {slice.map((r) => (
              <div key={r.id} className="bg-card rounded-xl border border-border/60 p-5 shadow-soft hover:shadow-float transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">{getFacilityIcon(r.type)}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{r.name}</h3>
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
              No facilities yet. Create your first facility above to start scheduling and booking.
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} noun="facilities" onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
