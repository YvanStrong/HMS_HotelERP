"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";
import { fetchSelfOrderPickupBoard, type BoardOrderCard } from "@/lib/selfOrderApi";

function formatElapsed(createdIso: string, nowMs: number): string {
  const t = Date.parse(createdIso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function SelfOrderGuestPickupPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const boardKey = searchParams.get("key")?.trim() || "";

  const { hotelName } = useSelfOrderGuestMeta();
  const [orders, setOrders] = useState<BoardOrderCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void (async () => {
        try {
          const b = await fetchSelfOrderPickupBoard(hotelId, boardKey || undefined);
          if (!cancelled) {
            setOrders(b.orders ?? []);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not load pickup board");
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hotelId, boardKey]);

  return (
    <main className="flex-1 py-4 sm:py-6 px-2 sm:px-4 min-w-0 max-w-5xl mx-auto w-full">
      <header className="mb-4 sm:mb-6 text-center space-y-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Ready for pickup</p>
        <h1 className="text-xl sm:text-2xl font-bold text-white">{hotelName || "Restaurant"}</h1>
        <p className="text-xs text-zinc-500 max-w-xl mx-auto">
          Orders appear here when the kitchen marks them <strong className="text-zinc-400">READY</strong>. Same board
          key as the kitchen display URL.
        </p>
      </header>
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-100 mb-4">{error}</div>
      )}
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 py-16 text-center text-zinc-500 text-sm">
          No orders ready right now.
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {orders.map((o) => {
            const name = (o.pickupDisplayName ?? "").trim();
            const loc = (o.pickupLocation ?? "").trim();
            const dine = o.serviceType === "DINE_IN";
            return (
              <article
                key={o.orderId}
                className="rounded-2xl border border-emerald-800/50 bg-emerald-950/20 overflow-hidden flex flex-col min-w-0"
              >
                <div className="px-4 py-3 bg-emerald-950/40 border-b border-emerald-900/40 flex justify-between gap-2">
                  <span className="text-[10px] font-mono text-emerald-400/90 tabular-nums">
                    {formatElapsed(o.createdAt, nowMs)} ago
                  </span>
                  <span className="text-[10px] text-zinc-500">{o.depotName}</span>
                </div>
                <div className="p-4 sm:p-5 space-y-2">
                  <p className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                    {name ? `Order for ${name}` : "Order ready"}
                  </p>
                  <p className="text-lg sm:text-xl font-mono text-emerald-300 tracking-widest">#{o.displayCode}</p>
                  {loc ? (
                    <p className="text-sm text-zinc-300">
                      {dine ? "Table / seat: " : "Location: "}
                      <span className="font-semibold text-white">{loc}</span>
                    </p>
                  ) : dine ? (
                    <p className="text-sm text-zinc-400">
                      {name
                        ? "Dine in — listen for your name and code at the pass."
                        : "Dine in — listen for your order code at the pass."}
                    </p>
                  ) : null}
                  <ul className="pt-2 space-y-1 text-sm text-zinc-300 border-t border-zinc-800/80">
                    {o.lines.map((ln, i) => (
                      <li key={i}>
                        <span className="text-white font-medium">{ln.productName}</span>
                        {Number(ln.quantity) > 1 ? (
                          <span className="text-zinc-500"> ×{Number(ln.quantity)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
