"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchSelfOrderTrack, type TrackOrderResponse } from "@/lib/selfOrderApi";

const STATUS_LABEL: Record<string, string> = {
  PLACED: "Received",
  IN_PROGRESS: "In the kitchen",
  READY: "Ready for pickup / service",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default function SelfOrderTrackPage() {
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

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-10">
      <Link href={`/book/order/${hotelId}`} className="text-sm text-muted-foreground hover:text-primary mb-8 self-start max-w-md mx-auto w-full">
        ← New order
      </Link>

      {error && !data && <div className="error max-w-md w-full">{error}</div>}

      {data && (
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm space-y-6 text-center">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Order code</p>
            <p className="text-5xl font-black tracking-widest text-primary mt-1">{data.displayCode}</p>
            <p className="text-xs text-muted-foreground mt-2">{data.orderNumber}</p>
          </div>
          <div className="rounded-xl bg-muted/50 py-4 px-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-xl font-semibold mt-1">{STATUS_LABEL[data.status] ?? data.status}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {data.serviceType === "DINE_IN" ? "Dine in" : "Take away"} · {data.depotName}
            </p>
            {data.paymentStatus === "UNPAID" ? (
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mt-3">
                Payment: waiting for counter collection ({data.paymentMethod ?? "—"})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-3">
                Payment: {data.paymentMethod ?? "PAID"}
              </p>
            )}
          </div>
          <ul className="text-left text-sm space-y-2 border-t border-border pt-4">
            {data.lines.map((ln, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {ln.productName} × {Number(ln.quantity)}
                </span>
                <span className="tabular-nums shrink-0">{Number(ln.lineTotal).toFixed(2)}</span>
              </li>
            ))}
            <li className="flex justify-between font-semibold pt-2 border-t border-border">
              <span>Total</span>
              <span>{Number(data.totalAmount).toFixed(2)}</span>
            </li>
          </ul>
          {data.customerNote ? (
            <p className="text-xs text-left text-muted-foreground">
              <span className="font-medium text-foreground">Your note:</span> {data.customerNote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
