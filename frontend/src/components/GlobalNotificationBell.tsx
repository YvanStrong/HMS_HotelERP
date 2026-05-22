"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BedDouble,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  PackageSearch,
  RefreshCw,
  Sparkles,
  Utensils,
  Wrench,
} from "lucide-react";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type Tone = "critical" | "warning" | "info" | "success";
type Category =
  | "Reservations"
  | "Housekeeping"
  | "Service"
  | "Orders"
  | "Inventory"
  | "Rooms"
  | "Accounting"
  | "System";

type SmartNotification = {
  id: string;
  title: string;
  detail: string;
  category: Category;
  tone: Tone;
  href?: string;
  count?: number;
  relatedItems?: { id: string; label: string; detail: string; href?: string }[];
};

type ReservationRow = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  roomNumber?: string | null;
  confirmationCode?: string | null;
  booking_reference?: string | null;
};

type ExecutiveDashboard = {
  todaysArrivals?: unknown[];
  todaysDepartures?: { balanceDue?: number | string | null }[];
  operationsAlerts?: { title?: string; value?: number; valueDisplay?: string; subtext?: string; actionPath?: string | null }[];
};

type HousekeepingTask = {
  id: string;
  roomNumber?: string;
  status: string;
  priority: string;
  taskType?: string;
  createdAt?: string;
};

type HousekeepingBoard = {
  pending?: HousekeepingTask[];
  inProgress?: HousekeepingTask[];
  completed?: HousekeepingTask[];
  inspected?: HousekeepingTask[];
};

type ServiceRequest = {
  id: string;
  requestType: string;
  status: string;
  priority: string;
  roomNumber?: string;
  createdAt: string;
};

type SelfOrderRow = {
  orderId: string;
  displayCode?: string;
  status: string;
  depotName?: string;
  createdAt?: string;
};

type InventoryDashboard = {
  lowStockCount?: number;
  outOfStockCount?: number;
  lowStockItems?: { id: string; name: string; sku?: string }[];
};

type RoomDashboard = {
  bucketCounts?: Record<string, number>;
  staleDndRooms?: { roomId: string; roomNumber: string; dndSetAt: string }[];
};

type SalesAnalytics = {
  pendingPettyCashCount?: number;
};

type ReservationQueueItem = {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info" | string;
  title: string;
  detail: string;
  reservationId?: string | null;
  groupId?: string | null;
  waitlistEntryId?: string | null;
  dueDate?: string | null;
  href?: string | null;
};

type NotificationPayload = {
  reservations: ReservationRow[];
  reservationQueue: ReservationQueueItem[];
  executive: ExecutiveDashboard | null;
  housekeeping: HousekeepingBoard | null;
  serviceRequests: ServiceRequest[];
  selfOrders: SelfOrderRow[];
  inventory: InventoryDashboard | null;
  rooms: RoomDashboard | null;
  accounting: SalesAnalytics | null;
};

const toneClasses: Record<Tone, { dot: string; badge: string; icon: string; border: string }> = {
  critical: {
    dot: "bg-rose-500",
    badge: "bg-white text-rose-700 border-rose-200",
    icon: "bg-white text-rose-600 ring-1 ring-rose-200",
    border: "border-l-rose-400",
  },
  warning: {
    dot: "bg-amber-500",
    badge: "bg-white text-amber-700 border-amber-200",
    icon: "bg-white text-amber-600 ring-1 ring-amber-200",
    border: "border-l-amber-400",
  },
  info: {
    dot: "bg-blue-500",
    badge: "bg-white text-slate-600 border-slate-200",
    icon: "bg-white text-slate-600 ring-1 ring-slate-200",
    border: "border-l-slate-300",
  },
  success: {
    dot: "bg-emerald-500",
    badge: "bg-white text-emerald-700 border-emerald-200",
    icon: "bg-white text-emerald-600 ring-1 ring-emerald-200",
    border: "border-l-emerald-400",
  },
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysFromToday(dateValue: string): number | null {
  if (!dateValue) return null;
  const d = new Date(`${dateValue.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - startOfToday().getTime()) / 86_400_000);
}

function minutesSince(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 60_000);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function categoryIcon(category: Category) {
  switch (category) {
    case "Reservations":
      return CalendarClock;
    case "Housekeeping":
      return ClipboardList;
    case "Service":
      return Wrench;
    case "Orders":
      return Utensils;
    case "Inventory":
      return PackageSearch;
    case "Rooms":
      return BedDouble;
    case "Accounting":
      return DollarSign;
    default:
      return Sparkles;
  }
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path, { quiet: true });
  } catch {
    return fallback;
  }
}

function buildNotifications(hotelId: string, payload: NotificationPayload): SmartNotification[] {
  const items: SmartNotification[] = [];
  const today = isoDate(new Date());
  const inHouse = payload.reservations.filter((r) => r.status === "CHECKED_IN");
  const confirmed = payload.reservations.filter((r) => r.status === "CONFIRMED");
  const overdue = inHouse.filter((r) => {
    const days = daysFromToday(r.checkOutDate);
    return days != null && days < 0;
  });
  const departingToday = inHouse.filter((r) => daysFromToday(r.checkOutDate) === 0);
  const dueSoon = inHouse.filter((r) => {
    const days = daysFromToday(r.checkOutDate);
    return days != null && days > 0 && days <= 2;
  });
  const arrivalsToday =
    payload.executive?.todaysArrivals?.length ??
    confirmed.filter((r) => r.checkInDate?.slice(0, 10) === today).length;
  const departuresToday = payload.executive?.todaysDepartures?.length ?? departingToday.length;
  const departuresWithBalance =
    payload.executive?.todaysDepartures?.filter((d) => Number(d.balanceDue ?? 0) > 0.01).length ?? 0;
  const queueCritical = payload.reservationQueue.filter((q) => q.severity === "critical");
  const queueWarning = payload.reservationQueue.filter((q) => q.severity === "warning");

  if (payload.reservationQueue.length) {
    const top = queueCritical[0] ?? queueWarning[0] ?? payload.reservationQueue[0];
    items.push({
      id: "reservation-ops-queue",
      title: `${plural(payload.reservationQueue.length, "reservation task")} need attention`,
      detail: top.detail,
      category: "Reservations",
      tone: queueCritical.length ? "critical" : queueWarning.length ? "warning" : "info",
      href: staffAppPath("reservations"),
      count: payload.reservationQueue.length,
      relatedItems: payload.reservationQueue.slice(0, 5).map((q) => ({
        id: q.id,
        label: q.title,
        detail: q.dueDate ? `${q.type.replaceAll("_", " ")} · due ${q.dueDate}` : q.type.replaceAll("_", " "),
        href: q.href || undefined,
      })),
    });
  }

  if (overdue.length) {
    const first = overdue[0];
    items.push({
      id: "reservations-overdue",
      title: `${plural(overdue.length, "guest")} past checkout`,
      detail: `${first.guestName ?? "Guest"}${first.roomNumber ? ` in room ${first.roomNumber}` : ""} needs checkout, extension, or overstay handling.`,
      category: "Reservations",
      tone: "critical",
      href: `${staffAppPath("reservations")}?view=overdue`,
      count: overdue.length,
      relatedItems: overdue.slice(0, 5).map((r) => ({
        id: r.id,
        label: r.guestName || "Guest",
        detail: `${r.roomNumber ? `Room ${r.roomNumber}` : "Room unassigned"} · due ${r.checkOutDate}`,
        href: staffAppPath("reservations", r.id),
      })),
    });
  }
  if (departingToday.length) {
    items.push({
      id: "reservations-departures",
      title: `${plural(departingToday.length, "guest")} checking out today`,
      detail: departuresWithBalance
        ? `${plural(departuresWithBalance, "departure")} still has balance due.`
        : "Prepare folios and room release workflow.",
      category: "Reservations",
      tone: departuresWithBalance ? "warning" : "info",
      href: staffAppPath("guests", "checkout"),
      count: departingToday.length,
    });
  }
  if (dueSoon.length) {
    items.push({
      id: "reservations-days-remaining",
      title: `${plural(dueSoon.length, "in-house stay")} ending soon`,
      detail: "Guests have 1-2 days remaining. Review extensions, payments, and housekeeping turnover.",
      category: "Reservations",
      tone: "info",
      href: staffAppPath("reservations"),
      count: dueSoon.length,
    });
  }
  if (arrivalsToday) {
    items.push({
      id: "reservations-arrivals",
      title: `${plural(arrivalsToday, "arrival")} today`,
      detail: "Confirm room readiness, IDs, deposits, and guest preferences before check-in.",
      category: "Reservations",
      tone: "success",
      href: staffAppPath("reservations"),
      count: arrivalsToday,
    });
  }
  if (departuresToday && !departingToday.length) {
    items.push({
      id: "dashboard-departures",
      title: `${plural(departuresToday, "scheduled departure")} today`,
      detail: "Review checkout desk and folio status.",
      category: "Reservations",
      tone: "info",
      href: staffAppPath("guests", "checkout"),
      count: departuresToday,
    });
  }

  const pendingHk = payload.housekeeping?.pending ?? [];
  const inProgressHk = payload.housekeeping?.inProgress ?? [];
  const urgentHk = [...pendingHk, ...inProgressHk].filter((t) => t.priority === "URGENT" || t.priority === "HIGH");
  const oldHk = pendingHk.filter((t) => (minutesSince(t.createdAt) ?? 0) >= 120);
  if (urgentHk.length || oldHk.length) {
    items.push({
      id: "housekeeping-attention",
      title: `${plural(urgentHk.length || oldHk.length, "housekeeping task")} needs attention`,
      detail: urgentHk.length
        ? `${plural(urgentHk.length, "high-priority task")} on the board.`
        : `${plural(oldHk.length, "task")} waiting over 2 hours.`,
      category: "Housekeeping",
      tone: urgentHk.length ? "critical" : "warning",
      href: staffAppPath("housekeeping"),
      count: urgentHk.length || oldHk.length,
    });
  } else if (pendingHk.length) {
    items.push({
      id: "housekeeping-pending",
      title: `${plural(pendingHk.length, "room task")} pending`,
      detail: "Room turns and stayover work are waiting for assignment or start.",
      category: "Housekeeping",
      tone: "info",
      href: staffAppPath("housekeeping"),
      count: pendingHk.length,
    });
  }

  const serviceUrgent = payload.serviceRequests.filter((r) => r.priority === "URGENT" || r.priority === "HIGH");
  if (payload.serviceRequests.length) {
    items.push({
      id: "service-requests",
      title: `${plural(payload.serviceRequests.length, "open service request")}`,
      detail: serviceUrgent.length
        ? `${plural(serviceUrgent.length, "urgent request")} should be handled first.`
        : "Guest requests are waiting for assignment or completion.",
      category: "Service",
      tone: serviceUrgent.length ? "critical" : "warning",
      href: staffAppPath("service-requests"),
      count: payload.serviceRequests.length,
    });
  }

  const activeOrders = payload.selfOrders.filter((o) => !["COMPLETED", "CANCELLED"].includes(o.status));
  const readyOrders = activeOrders.filter((o) => o.status === "READY");
  const oldOrders = activeOrders.filter((o) => (minutesSince(o.createdAt) ?? 0) >= 20);
  if (activeOrders.length) {
    items.push({
      id: "self-orders",
      title: `${plural(activeOrders.length, "active self order")}`,
      detail: readyOrders.length
        ? `${plural(readyOrders.length, "order")} ready for pickup/service.`
        : oldOrders.length
          ? `${plural(oldOrders.length, "order")} waiting more than 20 minutes.`
          : "Kitchen and pickup board have live orders.",
      category: "Orders",
      tone: readyOrders.length || oldOrders.length ? "warning" : "info",
      href: staffAppPath("self-orders"),
      count: activeOrders.length,
    });
  }

  const lowStock = Number(payload.inventory?.lowStockCount ?? 0);
  const outOfStock = Number(payload.inventory?.outOfStockCount ?? 0);
  if (outOfStock || lowStock) {
    const first = payload.inventory?.lowStockItems?.[0];
    items.push({
      id: "inventory-stock",
      title: outOfStock ? `${plural(outOfStock, "item")} out of stock` : `${plural(lowStock, "item")} low stock`,
      detail: first?.name ? `${first.name}${first.sku ? ` (${first.sku})` : ""} is on the watchlist.` : "Review reorder points and purchasing.",
      category: "Inventory",
      tone: outOfStock ? "critical" : "warning",
      href: staffAppPath("inventory"),
      count: outOfStock || lowStock,
    });
  }

  const staleDnd = payload.rooms?.staleDndRooms ?? [];
  const dirtyRooms = Number(payload.rooms?.bucketCounts?.VACANT_DIRTY ?? payload.rooms?.bucketCounts?.DIRTY ?? 0);
  const outOfOrder = Number(payload.rooms?.bucketCounts?.OUT_OF_ORDER ?? payload.rooms?.bucketCounts?.OUT_OF_SERVICE ?? 0);
  if (staleDnd.length) {
    items.push({
      id: "rooms-dnd",
      title: `${plural(staleDnd.length, "DND room")} needs review`,
      detail: `Room ${staleDnd[0].roomNumber} has stale DND status.`,
      category: "Rooms",
      tone: "warning",
      href: staffAppPath("rooms"),
      count: staleDnd.length,
    });
  }
  if (outOfOrder || dirtyRooms >= 5) {
    items.push({
      id: "rooms-status",
      title: outOfOrder ? `${plural(outOfOrder, "room")} out of order` : `${plural(dirtyRooms, "dirty room")} waiting`,
      detail: outOfOrder ? "Maintenance blocks may affect sellable inventory." : "Room readiness may affect arrivals.",
      category: "Rooms",
      tone: outOfOrder ? "critical" : "warning",
      href: staffAppPath("rooms"),
      count: outOfOrder || dirtyRooms,
    });
  }

  const pettyCash = Number(payload.accounting?.pendingPettyCashCount ?? 0);
  if (pettyCash) {
    items.push({
      id: "accounting-petty-cash",
      title: `${plural(pettyCash, "petty cash request")} pending`,
      detail: "Finance approval is waiting in accounting.",
      category: "Accounting",
      tone: "warning",
      href: staffAppPath("accounting"),
      count: pettyCash,
    });
  }

  if (!items.length) {
    items.push({
      id: "system-clear",
      title: "Operations are clear",
      detail: "No urgent alerts found across reservations, rooms, billing, orders, and stock.",
      category: "System",
      tone: "success",
      href: staffAppPath("dashboard"),
    });
  }

  const rank: Record<Tone, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  return items.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 12);
}

export function GlobalNotificationBell({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [payload, setPayload] = useState<NotificationPayload | null>(null);
  const [readKeys, setReadKeys] = useState<Set<string>>(() => new Set());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const readStorageKey = `hms:notifications:read:${hotelId}`;

  async function loadNotifications() {
    if (!hotelId || !getToken()) return;
    setLoading(true);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [reservations, reservationQueue, executive, housekeeping, serviceRequests, selfOrders, inventory, rooms, accounting] =
      await Promise.all([
        safeFetch<ReservationRow[]>(
          `/api/v1/hotels/${hotelId}/reservations?status=CHECKED_IN,CONFIRMED&page=1&pageSize=250`,
          [],
        ),
        safeFetch<ReservationQueueItem[]>(`/api/v1/hotels/${hotelId}/reservations/operations-queue`, []),
        safeFetch<ExecutiveDashboard | null>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`, null),
        safeFetch<HousekeepingBoard | null>(`/api/v1/hotels/${hotelId}/housekeeping/tasks`, null),
        safeFetch<ServiceRequest[]>(`/api/v1/hotels/${hotelId}/service-requests/pending`, []),
        safeFetch<SelfOrderRow[]>(`/api/v1/hotels/${hotelId}/inventory/self-service-orders`, []),
        safeFetch<InventoryDashboard | null>(`/api/v1/hotels/${hotelId}/inventory/dashboard`, null),
        safeFetch<RoomDashboard | null>(`/api/v1/hotels/${hotelId}/rooms/dashboard`, null),
        safeFetch<SalesAnalytics | null>(
          `/api/v1/hotels/${hotelId}/accounting/sales-analytics?from=${isoDate(monthStart)}&to=${isoDate(now)}`,
          null,
        ),
      ]);
    setPayload({ reservations, reservationQueue, executive, housekeeping, serviceRequests, selfOrders, inventory, rooms, accounting });
    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => void loadNotifications(), 60_000);
    return () => window.clearInterval(timer);
  }, [hotelId]);

  useEffect(() => {
    if (!hotelId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(readStorageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setReadKeys(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setReadKeys(new Set());
    }
  }, [hotelId, readStorageKey]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current || rootRef.current.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const allNotifications = useMemo(
    () =>
      payload
        ? buildNotifications(hotelId, payload)
        : [
            {
              id: "system-loading",
              title: "Loading smart alerts",
              detail: "Checking reservations, rooms, services, orders, inventory, and accounting.",
              category: "System" as Category,
              tone: "info" as Tone,
            },
          ],
    [hotelId, payload],
  );

  function notificationReadKey(n: SmartNotification): string {
    return `${n.id}:${n.count ?? 0}:${n.title}:${n.detail}`;
  }

  function persistReadKeys(next: Set<string>) {
    setReadKeys(next);
    try {
      window.localStorage.setItem(readStorageKey, JSON.stringify(Array.from(next).slice(-250)));
    } catch {
      /* best effort */
    }
  }

  function markAsRead(n: SmartNotification) {
    const next = new Set(readKeys);
    next.add(notificationReadKey(n));
    persistReadKeys(next);
  }

  function markAllAsRead() {
    const next = new Set(readKeys);
    allNotifications.forEach((n) => next.add(notificationReadKey(n)));
    persistReadKeys(next);
  }

  const notifications = useMemo(() => {
    const visible = allNotifications.filter((n) => n.category === "System" || !readKeys.has(notificationReadKey(n)));
    if (visible.length === 0) {
      return [
        {
          id: "system-all-read",
          title: "All caught up",
          detail: "No unread operational notifications right now.",
          category: "System" as Category,
          tone: "success" as Tone,
          href: staffAppPath("dashboard"),
        },
      ];
    }
    return visible;
  }, [allNotifications, readKeys]);

  const activeCount = notifications
    .filter((n) => n.category !== "System" && (n.tone === "critical" || n.tone === "warning" || n.tone === "info"))
    .reduce((sum, n) => sum + (n.count ?? 1), 0);
  const criticalCount = notifications.filter((n) => n.category !== "System" && n.tone === "critical").length;
  const unreadItems = notifications.filter((n) => n.category !== "System");

  return (
    <div ref={rootRef} className="fixed right-3 top-3 z-[70] sm:right-5 sm:top-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-700"
        aria-label="Open notifications"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {activeCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white ring-2 ring-white">
            {activeCount > 99 ? "99+" : activeCount}
          </span>
        ) : null}
        {criticalCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-3 w-[calc(100vw-1.5rem)] max-w-[26rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          <div className="border-b border-slate-200 bg-white px-4 py-3 text-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Notifications</p>
                <h2 className="mt-1 text-base font-black">Operations watch</h2>
                <p className="mt-0.5 text-xs text-slate-500">Live alerts from every HMS module.</p>
              </div>
              <div className="flex items-center gap-1.5">
                {unreadItems.length > 0 ? (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                  >
                    Mark all read
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100"
                  aria-label="Refresh notifications"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <p className="font-black text-slate-950">{notifications.filter((n) => n.tone === "critical").length}</p>
                <p className="text-slate-500">Critical</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <p className="font-black text-slate-950">{notifications.filter((n) => n.tone === "warning").length}</p>
                <p className="text-slate-500">Warnings</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                <p className="font-black text-slate-950">{activeCount}</p>
                <p className="text-slate-500">Signals</p>
              </div>
            </div>
          </div>

          <div className="max-h-[65vh] overflow-y-auto bg-white p-2.5">
            {notifications.map((n) => {
              const Icon = categoryIcon(n.category);
              const tone = toneClasses[n.tone];
              const content = (
                <div
                  className={`group flex gap-3 rounded-xl border border-slate-200 border-l-4 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50 ${tone.border}`}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                    {n.tone === "success" && n.category === "System" ? (
                      <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
                    ) : n.tone === "critical" ? (
                      <AlertTriangle className="h-4.5 w-4.5" aria-hidden />
                    ) : (
                      <Icon className="h-4.5 w-4.5" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-black leading-snug text-slate-950">{n.title}</span>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${tone.badge}`}>
                        {n.category}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-600">{n.detail}</span>
                    {n.relatedItems?.length ? (
                      <span className="mt-2 block space-y-1.5">
                        {n.relatedItems.map((item) => (
                          <span
                            key={item.id}
                            className="block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                          >
                            <span className="block text-xs font-bold text-slate-900">{item.label}</span>
                            <span className="block text-[11px] text-slate-500">{item.detail}</span>
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
              return n.href ? (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => {
                    markAsRead(n);
                    setOpen(false);
                  }}
                  className="mb-2 block no-underline"
                >
                  {content}
                </Link>
              ) : (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markAsRead(n)}
                  className="mb-2 block w-full border-0 bg-transparent p-0 text-left shadow-none"
                >
                  {content}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2.5 text-[11px] text-slate-500">
            <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for first refresh"}</span>
            <span className="font-bold text-slate-700">Auto-refresh 60s</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
