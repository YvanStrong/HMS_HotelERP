"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchSelfOrderBoard, type BoardOrderCard } from "@/lib/selfOrderApi";

function formatElapsed(createdIso: string, nowMs: number): string {
  const t = Date.parse(createdIso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function kdsBadge(status: string): { label: string; bar: string; pill: string } {
  switch (status) {
    case "PLACED":
      return {
        label: "New",
        bar: "bg-red-500",
        pill: "bg-red-600 text-white",
      };
    case "IN_PROGRESS":
      return {
        label: "Preparing",
        bar: "bg-amber-400",
        pill: "bg-amber-300 text-zinc-900",
      };
    case "READY":
      return {
        label: "Ready",
        bar: "bg-emerald-500",
        pill: "bg-emerald-500 text-white",
      };
    default:
      return {
        label: status.replace(/_/g, " "),
        bar: "bg-zinc-500",
        pill: "bg-zinc-600 text-white",
      };
  }
}

type KitchenBoardPanelProps = {
  hotelId: string;
  boardKey?: string;
  /** When false, omit outer min-height (embedded in hub). */
  fillViewport?: boolean;
  title?: string;
};

export function KitchenBoardPanel({
  hotelId,
  boardKey,
  fillViewport = true,
  title = "Kitchen display — live orders",
}: KitchenBoardPanelProps) {
  const [orders, setOrders] = useState<BoardOrderCard[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void (async () => {
        try {
          const b = await fetchSelfOrderBoard(hotelId, boardKey || undefined);
          if (!cancelled) {
            setOrders(b.orders ?? []);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not refresh");
        }
      })();
    };
    load();
    const id = window.setInterval(load, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hotelId, boardKey]);

  const shell = fillViewport ? "min-h-[100dvh]" : "min-h-[50vh]";

  return (
    <div
      className={`${shell} bg-zinc-950 text-zinc-100 flex flex-col rounded-2xl overflow-hidden border border-zinc-800`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/50">
        <h2 className="text-sm sm:text-base font-semibold tracking-wide uppercase text-zinc-300">{title}</h2>
        <Link href={`/book/order/${hotelId}`} className="text-xs text-zinc-500 hover:text-zinc-300 underline shrink-0">
          Kiosk
        </Link>
      </header>
      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-red-950/80 border border-red-800 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      )}
      <div className="flex-1 p-3 sm:p-4 overflow-auto">
        {orders.length === 0 ? (
          <div className="h-full min-h-[30vh] flex items-center justify-center text-zinc-500 text-center px-4">
            No live tickets (paid orders in New / Preparing / Ready appear here)
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {orders.map((o) => {
              const b = kdsBadge(o.status);
              return (
                <article
                  key={o.orderId}
                  className="flex rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-lg min-w-0"
                >
                  <div className={`w-1.5 sm:w-2 shrink-0 ${b.bar}`} aria-hidden />
                  <div className="flex-1 p-3 sm:p-4 flex flex-col gap-2 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {(o.pickupDisplayName ?? "").trim() ? (
                          <>
                            <p className="text-base sm:text-lg font-bold text-white truncate">
                              Order for {(o.pickupDisplayName ?? "").trim()}
                            </p>
                            <p className="text-[11px] sm:text-xs font-mono text-zinc-400 mt-0.5">#{o.displayCode}</p>
                          </>
                        ) : (
                          <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider text-zinc-500 truncate">
                            Order · #{o.displayCode}
                          </p>
                        )}
                        {(o.pickupLocation ?? "").trim() ? (
                          <p className="text-[11px] text-amber-200/90 mt-1 truncate">
                            {o.serviceType === "DINE_IN" ? "Table / seat: " : "Location: "}
                            {(o.pickupLocation ?? "").trim()}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[10px] font-mono tabular-nums text-zinc-500 shrink-0">
                        {formatElapsed(o.createdAt, nowMs)}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-sm text-zinc-100 flex-1">
                      {o.lines.map((ln, i) => (
                        <li key={i} className="leading-snug">
                          <span className="font-medium">{ln.productName}</span>
                          {Number(ln.quantity) > 1 ? (
                            <span className="text-zinc-400 font-mono"> ×{Number(ln.quantity)}</span>
                          ) : null}
                          {ln.modifiersNote ? (
                            <span className="block text-xs text-zinc-400 mt-0.5">{ln.modifiersNote}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-2 flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${b.pill}`}>{b.label}</span>
                      <span className="text-[10px] text-zinc-500 truncate">
                        {o.serviceType === "DINE_IN" ? "Dine in" : "Take away"} · {o.depotName}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
