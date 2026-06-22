"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { HMS_POS_ORDER_EVENT, posOrderEventKey, type PosOrderNotification as PosOrderRow } from "@/lib/posOrderNotification";
import { staffAppPath } from "@/lib/staffAppRoutes";

type ReservationRow = {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  roomNumber?: string | null;
  totalAmount?: number;
  currency?: string;
};

type KpiCard = {
  key: string;
  title: string;
  value: number;
  valueDisplay?: string;
  subtext?: string;
  actionPath?: string | null;
};

type ExecutiveDashboard = {
  operationsAlerts?: KpiCard[];
  todaysArrivals?: unknown[];
  todaysDepartures?: unknown[];
};

type SubscriptionStatus = {
  billingStatus?: string;
  subscriptionEndDate?: string | null;
  daysRemaining?: number | null;
  suspended?: boolean;
  manuallyBlocked?: boolean;
};

type StaffAlert = {
  id: string;
  signature: string;
  section: "Reservations" | "Rooms" | "Guests" | "Tasks" | "System" | "POS";
  tone: "red" | "amber" | "blue" | "green";
  title: string;
  body: string;
  href: string;
};

type PosOrderNotification = {
  eventId: string;
  eventType: string;
  title: string;
  body: string;
  staffDisplayName: string | null;
  staffUsername: string | null;
  at: string;
};

const READ_KEY_PREFIX = "hms:staff-notifications:read:";
const CLEARED_KEY_PREFIX = "hms:staff-notifications:cleared:";
const REMINDER_SNOOZE_MS = 30 * 60 * 1000;

type SignatureExpiryMap = Record<string, number>;

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readStorageKey(hotelId: string) {
  return `${READ_KEY_PREFIX}${hotelId}`;
}

function clearedStorageKey(hotelId: string) {
  return `${CLEARED_KEY_PREFIX}${hotelId}`;
}

function pruneExpiryMap(map: SignatureExpiryMap, now = Date.now()): SignatureExpiryMap {
  return Object.fromEntries(Object.entries(map).filter(([, expiresAt]) => expiresAt > now));
}

function parseExpiryMap(raw: string | null): SignatureExpiryMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === "number")
        .map(([key, value]) => [key, value as number] as const);
      return pruneExpiryMap(Object.fromEntries(entries));
    }
  } catch {
    return {};
  }
  return {};
}

function loadReadSignatures(hotelId: string): SignatureExpiryMap {
  if (typeof window === "undefined") return {};
  return parseExpiryMap(window.localStorage.getItem(readStorageKey(hotelId)));
}

function loadClearedSignatures(hotelId: string): SignatureExpiryMap {
  if (typeof window === "undefined") return {};
  return parseExpiryMap(window.localStorage.getItem(clearedStorageKey(hotelId)));
}

function saveReadSignatures(hotelId: string, signatures: SignatureExpiryMap) {
  try {
    window.localStorage.setItem(readStorageKey(hotelId), JSON.stringify(pruneExpiryMap(signatures)));
  } catch {
    // Best effort. Notification read state should never block operations.
  }
}

function saveClearedSignatures(hotelId: string, signatures: SignatureExpiryMap) {
  try {
    window.localStorage.setItem(clearedStorageKey(hotelId), JSON.stringify(pruneExpiryMap(signatures)));
  } catch {
    // Best effort. Notification clear state should never block operations.
  }
}

function toneClasses(tone: StaffAlert["tone"]) {
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function StaffNotificationBell({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<StaffAlert[]>([]);
  const [read, setRead] = useState<SignatureExpiryMap>({});
  const [cleared, setCleared] = useState<SignatureExpiryMap>({});
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRead(loadReadSignatures(hotelId));
    setCleared(loadClearedSignatures(hotelId));
  }, [hotelId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAlerts() {
      if (!getToken()) return;
      setLoading(true);
      try {
        const since = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
        const [reservations, dashboard, subscription, posOrders] = await Promise.all([
          apiFetch<ReservationRow[]>(`/api/v1/hotels/${hotelId}/reservations?status=CONFIRMED,CHECKED_IN`),
          apiFetch<ExecutiveDashboard>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`).catch(() => null),
          apiFetch<SubscriptionStatus>(`/api/v1/hotels/${hotelId}/subscription-status`).catch(() => null),
          apiFetch<PosOrderNotification[]>(`/api/v1/hotels/${hotelId}/pos/notifications?since=${encodeURIComponent(since)}`, {
            quiet: true,
          }).catch(() => [] as PosOrderNotification[]),
        ]);
        if (cancelled) return;
        const today = todayYmd();
        const overdue = reservations.filter(
          (r) => String(r.status).toUpperCase() === "CHECKED_IN" && r.checkOutDate < today,
        );
        const departuresToday = reservations.filter(
          (r) => String(r.status).toUpperCase() === "CHECKED_IN" && r.checkOutDate === today,
        );
        const arrivalsToday = reservations.filter(
          (r) => String(r.status).toUpperCase() === "CONFIRMED" && r.checkInDate === today,
        );
        const nextAlerts: StaffAlert[] = [];
        if (subscription?.manuallyBlocked) {
          nextAlerts.push({
            id: "subscription-manual-block",
            signature: `subscription:manual:${subscription.billingStatus ?? ""}`,
            section: "System",
            tone: "red",
            title: "Hotel subscription is blocked",
            body: "Platform administrator has blocked this hotel. Contact platform support before continuing operations.",
            href: staffAppPath("dashboard"),
          });
        } else if (subscription?.suspended || (subscription?.daysRemaining ?? 1) <= 0) {
          nextAlerts.push({
            id: "subscription-expired",
            signature: `subscription:expired:${subscription?.subscriptionEndDate ?? ""}`,
            section: "System",
            tone: "red",
            title: "Subscription expired",
            body: "Contact the platform administrator to renew and restore access.",
            href: staffAppPath("dashboard"),
          });
        } else if (typeof subscription?.daysRemaining === "number" && subscription.daysRemaining <= 15) {
          const days = subscription.daysRemaining;
          nextAlerts.push({
            id: "subscription-expiring",
            signature: `subscription:expiring:${days}:${subscription.subscriptionEndDate ?? ""}`,
            section: "System",
            tone: days <= 3 ? "red" : "amber",
            title: days === 1 ? "Subscription expires tomorrow" : `Subscription expires in ${days} days`,
            body: "Please confirm renewal with the platform administrator before access is suspended.",
            href: staffAppPath("dashboard"),
          });
        }
        if (overdue.length > 0) {
          nextAlerts.push({
            id: "reservations-overdue",
            signature: `reservations-overdue:${overdue.length}:${overdue.map((r) => `${r.id}:${r.checkOutDate}`).join("|")}`,
            section: "Reservations",
            tone: "red",
            title: `${overdue.length} overdue checked-in stay${overdue.length === 1 ? "" : "s"}`,
            body: "Guests are still in-house after checkout date. Review extension or checkout action.",
            href: staffAppPath("reservations?attention=overdue"),
          });
        }
        if (departuresToday.length > 0) {
          nextAlerts.push({
            id: "reservations-departures-today",
            signature: `departures-today:${today}:${departuresToday.length}`,
            section: "Reservations",
            tone: "amber",
            title: `${departuresToday.length} checkout${departuresToday.length === 1 ? "" : "s"} due today`,
            body: "Review folios, balances, housekeeping release, and late checkout requests.",
            href: staffAppPath("reservations?attention=departures"),
          });
        }
        if (arrivalsToday.length > 0) {
          nextAlerts.push({
            id: "reservations-arrivals-today",
            signature: `arrivals-today:${today}:${arrivalsToday.length}`,
            section: "Reservations",
            tone: "blue",
            title: `${arrivalsToday.length} arrival${arrivalsToday.length === 1 ? "" : "s"} expected today`,
            body: "Prepare room assignment, guest documents, and deposit confirmation.",
            href: staffAppPath("reservations?attention=arrivals"),
          });
        }
        for (const card of dashboard?.operationsAlerts ?? []) {
          if (Number(card.value) <= 0) continue;
          nextAlerts.push({
            id: `ops:${card.key}`,
            signature: `ops:${card.key}:${card.value}:${card.subtext ?? ""}`,
            section: "System",
            tone: "amber",
            title: card.title,
            body: card.subtext || "Operational item needs attention.",
            href: card.actionPath || staffAppPath("dashboard"),
          });
        }
        for (const order of posOrders.slice(0, 12)) {
          const who = order.staffDisplayName || order.staffUsername || "Staff";
          nextAlerts.push({
            id: `pos:${order.eventId}`,
            signature: `pos:${posOrderEventKey(order as PosOrderRow)}`,
            section: "POS",
            tone: order.eventType === "KITCHEN_ORDER" ? "green" : "blue",
            title: order.title,
            body: `${who} — ${order.body}`,
            href: staffAppPath("invoices?tab=deliveries"),
          });
        }
        setAlerts(nextAlerts);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    const onPosOrder = () => void loadAlerts();
    void loadAlerts();
    const timer = window.setInterval(() => void loadAlerts(), 60_000);
    window.addEventListener(HMS_POS_ORDER_EVENT, onPosOrder);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(HMS_POS_ORDER_EVENT, onPosOrder);
    };
  }, [hotelId]);

  const visibleAlerts = useMemo(
    () => alerts.filter((alert) => (cleared[alert.signature] ?? 0) <= now),
    [alerts, cleared, now],
  );
  const unread = useMemo(
    () => visibleAlerts.filter((alert) => (read[alert.signature] ?? 0) <= now),
    [visibleAlerts, read, now],
  );

  function markRead(signature: string) {
    const next = pruneExpiryMap({ ...read, [signature]: Date.now() + REMINDER_SNOOZE_MS });
    setRead(next);
    saveReadSignatures(hotelId, next);
  }

  function markAllRead() {
    const expiresAt = Date.now() + REMINDER_SNOOZE_MS;
    const next = pruneExpiryMap({
      ...read,
      ...Object.fromEntries(visibleAlerts.map((alert) => [alert.signature, expiresAt])),
    });
    setRead(next);
    saveReadSignatures(hotelId, next);
  }

  function clearAll() {
    const expiresAt = Date.now() + REMINDER_SNOOZE_MS;
    const nextCleared = pruneExpiryMap({
      ...cleared,
      ...Object.fromEntries(visibleAlerts.map((alert) => [alert.signature, expiresAt])),
    });
    const nextRead = pruneExpiryMap({
      ...read,
      ...Object.fromEntries(visibleAlerts.map((alert) => [alert.signature, expiresAt])),
    });
    setCleared(nextCleared);
    setRead(nextRead);
    saveClearedSignatures(hotelId, nextCleared);
    saveReadSignatures(hotelId, nextRead);
  }

  function toggleOpen() {
    setOpen((value) => {
      const next = !value;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-white/90 text-foreground shadow-sm transition hover:border-primary/30 hover:bg-primary/5"
        aria-label="Open notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V4a2 2 0 10-4 0v1.3A6 6 0 006 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[2147483647] pointer-events-none">
          <div className="absolute right-4 top-16 w-[min(92vw,27rem)] overflow-hidden rounded-2xl border border-border/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.35)] pointer-events-auto">
            <div className="flex items-start justify-between gap-3 border-b border-border/60 bg-white p-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Smart alerts</p>
                <h2 className="mt-1 text-lg font-black text-foreground">Operations inbox</h2>
                <p className="mt-1 text-xs text-muted-foreground">{loading ? "Refreshing signals..." : `${unread.length} unread signal${unread.length === 1 ? "" : "s"}`}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                {unread.length > 0 && (
                  <button type="button" onClick={markAllRead} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground hover:bg-muted/70">
                    Mark all read
                  </button>
                )}
                {visibleAlerts.length > 0 && (
                  <button type="button" onClick={clearAll} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-100">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
              {visibleAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
                  <p className="text-sm font-bold text-foreground">All caught up</p>
                  <p className="mt-1 text-xs text-muted-foreground">New or changed operational signals will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleAlerts.map((alert) => {
                    const isRead = (read[alert.signature] ?? 0) > now;
                    return (
                    <Link
                      key={alert.signature}
                      href={alert.href}
                      onClick={() => {
                        markRead(alert.signature);
                        setOpen(false);
                      }}
                      className={`block rounded-2xl border p-3 no-underline transition hover:border-primary/30 hover:bg-muted/40 ${
                        isRead ? "border-border/60 bg-white" : "border-blue-200 bg-blue-50/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${isRead ? "bg-slate-300" : "bg-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"}`} />
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${toneClasses(alert.tone)}`}>
                            {alert.section}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide ${isRead ? "text-slate-400" : "text-blue-700"}`}>
                          {isRead ? "Read" : "Unread"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-black text-foreground">{alert.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.body}</p>
                    </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
