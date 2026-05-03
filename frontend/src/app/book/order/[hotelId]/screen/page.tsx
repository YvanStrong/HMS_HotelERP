"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchSelfOrderBoard, type BoardOrderCard } from "@/lib/selfOrderApi";

function statusTone(status: string): string {
  switch (status) {
    case "READY":
      return "bg-emerald-600/90 text-white border-emerald-400";
    case "IN_PROGRESS":
      return "bg-amber-600/90 text-white border-amber-400";
    case "PLACED":
      return "bg-slate-700/90 text-white border-slate-500";
    default:
      return "bg-zinc-800 text-white border-zinc-600";
  }
}

export default function SelfOrderBigScreenPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const boardKey = useMemo(() => searchParams.get("key")?.trim() || "", [searchParams]);
  const [orders, setOrders] = useState<BoardOrderCard[]>([]);
  const [clock, setClock] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => {
      setClock(
        new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      );
    }, 1000);
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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-zinc-800 bg-black/40">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Kitchen orders</h1>
          <p className="text-zinc-500 text-sm mt-0.5">
            Live · refreshes every few seconds
            {!boardKey ? " · add ?key=… if your hotel uses a board secret" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl md:text-4xl font-mono tabular-nums text-primary">{clock}</p>
          <Link href={`/book/order/${hotelId}`} className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-1 inline-block">
            Kiosk link
          </Link>
        </div>
      </header>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-red-950/80 border border-red-800 px-4 py-2 text-sm text-red-100">{error}</div>
      )}

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {orders.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xl md:text-2xl font-medium">
            No active orders
          </div>
        ) : (
          <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {orders.map((o) => (
              <article
                key={o.orderId}
                className={`rounded-2xl border-2 p-5 md:p-6 flex flex-col gap-3 shadow-lg ${statusTone(o.status)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase opacity-90">{o.serviceType === "DINE_IN" ? "Dine in" : "Take away"}</p>
                    <p className="text-5xl md:text-6xl font-black tracking-wider leading-none mt-1">{o.displayCode}</p>
                  </div>
                  <span className="text-xs font-semibold uppercase px-2 py-1 rounded-md bg-black/25">{o.status.replace("_", " ")}</span>
                </div>
                <p className="text-sm opacity-90">{o.depotName}</p>
                <ul className="text-base md:text-lg space-y-1.5 mt-auto pt-2 border-t border-white/20">
                  {o.lines.map((ln, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{ln.productName}</span>
                      <span className="shrink-0 font-mono">×{Number(ln.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
