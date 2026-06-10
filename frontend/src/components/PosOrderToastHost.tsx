"use client";

import { Client } from "@stomp/stompjs";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import {
  HMS_POS_ORDER_EVENT,
  posOrderEventKey,
  showPosOrderPopup,
  type PosOrderNotification,
  type PosOrderPopupDetail,
} from "@/lib/posOrderNotification";
import { staffAppPath } from "@/lib/staffAppRoutes";

type ToastState = {
  visible: boolean;
  notification: PosOrderNotification | null;
};

const DEFAULT_TIMEOUT_MS = 8000;

function wsBrokerUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, "").replace(/^http/, "ws") + "/ws";
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:8080/ws`;
  }
  return "ws://localhost:8080/ws";
}

export function PosOrderToastHost({ hotelId }: { hotelId: string }) {
  const [toast, setToast] = useState<ToastState>({ visible: false, notification: null });
  const timerRef = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const openToast = (notification: PosOrderNotification, timeoutMs = DEFAULT_TIMEOUT_MS) => {
      clearTimer();
      setToast({ visible: true, notification });
      timerRef.current = window.setTimeout(() => {
        setToast({ visible: false, notification: null });
      }, timeoutMs);
    };

    const onPosOrder = (event: Event) => {
      const custom = event as CustomEvent<PosOrderPopupDetail>;
      const notification = custom.detail?.notification;
      if (!notification) return;
      openToast(notification, custom.detail.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    };

    window.addEventListener(HMS_POS_ORDER_EVENT, onPosOrder as EventListener);
    return () => {
      clearTimer();
      window.removeEventListener(HMS_POS_ORDER_EVENT, onPosOrder as EventListener);
    };
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const client = new Client({
      brokerURL: wsBrokerUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/hotel/${hotelId}/pos-orders`, (message) => {
          try {
            const notification = JSON.parse(message.body) as PosOrderNotification;
            const key = posOrderEventKey(notification);
            if (seenRef.current.has(key)) return;
            seenRef.current.add(key);
            showPosOrderPopup({ notification });
          } catch {
            // Ignore malformed payloads.
          }
        });
      },
    });

    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    const sessionStart = new Date().toISOString();

    async function poll() {
      if (!getToken()) return;
      try {
        const rows = await apiFetch<PosOrderNotification[]>(
          `/api/v1/hotels/${hotelId}/pos/notifications?since=${encodeURIComponent(sessionStart)}`,
          { quiet: true },
        );
        if (cancelled) return;
        for (const row of rows) {
          const key = posOrderEventKey(row);
          if (seenRef.current.has(key)) continue;
          seenRef.current.add(key);
          if (!bootstrappedRef.current) continue;
          showPosOrderPopup({ notification: row });
        }
        bootstrappedRef.current = true;
      } catch {
        // POS module may be disabled; ignore quietly.
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 6000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hotelId]);

  if (!toast.visible || !toast.notification) return null;

  const n = toast.notification;
  const who = n.staffDisplayName || n.staffUsername || "Staff";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex max-w-sm flex-col gap-2 px-4">
      <div className="pointer-events-auto rounded-2xl border border-emerald-300/80 bg-white p-4 shadow-2xl animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">POS order</p>
            <p className="mt-1 text-sm font-bold text-foreground">{n.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              From <span className="font-semibold text-foreground">{who}</span>
              {n.depotName ? ` · ${n.depotName}` : ""}
            </p>
            {n.itemSummary ? (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{n.itemSummary}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="hms-btn-outline hms-btn-sm shrink-0"
            onClick={() => setToast({ visible: false, notification: null })}
          >
            Close
          </button>
        </div>
        <Link
          href={staffAppPath("invoices?tab=deliveries")}
          className="mt-3 inline-block text-xs font-bold text-primary no-underline hover:underline"
          onClick={() => setToast({ visible: false, notification: null })}
        >
          Open invoices →
        </Link>
      </div>
    </div>
  );
}
