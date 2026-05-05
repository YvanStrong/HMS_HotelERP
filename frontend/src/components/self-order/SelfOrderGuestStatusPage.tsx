"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { OrderStatusTimeline } from "@/components/self-order/OrderStatusTimeline";
import { trackStorageKey } from "@/components/self-order/selfOrderGuestUtils";
import { fetchSelfOrderTrack, type TrackOrderResponse } from "@/lib/selfOrderApi";

export default function SelfOrderGuestStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const tableFromQr = searchParams.get("table")?.trim() || "";

  const [trackToken, setTrackToken] = useState<string | null>(null);
  const [trackData, setTrackData] = useState<TrackOrderResponse | null>(null);
  const [trackError, setTrackError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTrackToken(sessionStorage.getItem(trackStorageKey(hotelId)));
  }, [hotelId]);

  useEffect(() => {
    if (!trackToken) {
      setTrackData(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      void (async () => {
        try {
          const d = await fetchSelfOrderTrack(hotelId, trackToken);
          if (!cancelled) {
            setTrackData(d);
            setTrackError(null);
          }
        } catch (e) {
          if (!cancelled) setTrackError(e instanceof Error ? e.message : "Could not load order");
        }
      })();
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hotelId, trackToken]);

  return (
    <main className="flex-1 py-6 max-w-md mx-auto w-full px-3 sm:px-4 space-y-6">
      {!trackToken && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-400 text-sm">
          Place an order from <strong className="text-zinc-200">Customer menu</strong> to see live status here.
        </div>
      )}
      {trackToken && trackError && !trackData && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-100">{trackError}</div>
      )}
      {trackData && (
        <div className="space-y-8">
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 text-center">
            Order · {trackData.displayCode}
            {tableFromQr ? ` · Table ${tableFromQr}` : ""}
          </p>
          <OrderStatusTimeline data={trackData} />
          <Link
            href={`/book/order/${hotelId}/track/${trackToken}`}
            className="block text-center text-xs text-zinc-500 hover:text-zinc-300 underline"
          >
            Open dedicated tracker link
          </Link>
        </div>
      )}
    </main>
  );
}
