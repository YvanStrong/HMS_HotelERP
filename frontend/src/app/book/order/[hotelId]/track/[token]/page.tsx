"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { OrderStatusTimeline } from "@/components/self-order/OrderStatusTimeline";
import { fetchSelfOrderTrack, type TrackOrderResponse } from "@/lib/selfOrderApi";

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Received",
  IN_PROGRESS: "In the kitchen",
  READY: "Ready for pickup / service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function TrackInner() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const token = String(params.token);

  const [data, setData] = useState<TrackOrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      void (async () => {
        try {
          const d = await fetchSelfOrderTrack(hotelId, token);
          if (!cancelled) {
            setData(d);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not load order");
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hotelId, token]);

  const folio =
    data &&
    (String(data.paymentMethod ?? "").includes("ROOM") || String(data.paymentMethod ?? "").includes("FOLIO"));

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 flex flex-col items-center px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:py-10">
      <Link href={`/book/order/${hotelId}`} className="text-sm text-zinc-500 hover:text-white mb-6 self-start max-w-lg w-full">
        ← Back to ordering
      </Link>

      {error && !data && (
        <div className="max-w-lg w-full rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {data && (
        <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-8 shadow-sm space-y-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wider text-zinc-500">Order code</p>
            <p className="text-4xl sm:text-5xl font-black tracking-widest text-emerald-400 mt-1 break-all">{data.displayCode}</p>
            <p className="text-xs text-zinc-500 mt-2 break-all">{data.orderNumber}</p>
          </div>
          <div className="rounded-xl bg-zinc-950/60 py-4 px-3 sm:px-4 border border-zinc-800/80">
            <p className="text-sm text-zinc-500 text-center">Status</p>
            <p className="text-lg sm:text-xl font-semibold mt-1 text-center text-white">{STATUS_LABEL[data.status] ?? data.status}</p>
            <p className="text-xs text-zinc-500 mt-2 text-center">
              {data.serviceType === "DINE_IN" ? "Dine in" : "Take away"} · {data.depotName}
            </p>
            {data.paymentStatus === "UNPAID" ? (
              <p className="text-xs font-medium text-amber-300 mt-3 text-center">
                Payment: waiting for counter ({data.paymentMethod ?? "—"})
              </p>
            ) : (
              <p className="text-xs text-zinc-500 mt-3 text-center">
                Payment: {folio ? "Room folio" : data.paymentMethod ?? "PAID"}
              </p>
            )}
          </div>

          <OrderStatusTimeline data={data} />

          <ul className="text-left text-sm space-y-3 border-t border-zinc-800 pt-4">
            {data.lines.map((ln, i) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800 ring-1 ring-zinc-700">
                  {ln.photoUrl ? (
                    <img src={ln.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-500 text-center px-1">
                      Item
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium leading-snug text-zinc-100">
                      {ln.productName} × {Number(ln.quantity)}
                    </span>
                    <span className="tabular-nums shrink-0 text-zinc-300">{Number(ln.lineTotal).toFixed(2)}</span>
                  </div>
                  {ln.productCode ? <p className="text-[11px] text-zinc-500 font-mono">{ln.productCode}</p> : null}
                  {ln.modifiersNote ? <p className="text-xs text-zinc-400 leading-snug">{ln.modifiersNote}</p> : null}
                </div>
              </li>
            ))}
            <li className="flex justify-between font-semibold pt-2 border-t border-zinc-800 text-zinc-100">
              <span>Total</span>
              <span>{Number(data.totalAmount).toFixed(2)}</span>
            </li>
          </ul>
          {data.customerNote ? (
            <p className="text-xs text-left text-zinc-500">
              <span className="font-medium text-zinc-300">Your note:</span> {data.customerNote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SelfOrderTrackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-zinc-950 text-zinc-400 flex items-center justify-center">Loading…</div>
      }
    >
      <TrackInner />
    </Suspense>
  );
}
