"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { OrderStatusTimeline } from "@/components/self-order/OrderStatusTimeline";
import { SelfOrderPickupCallout } from "@/components/self-order/SelfOrderPickupCallout";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";
import { SelfOrderWebPushOptIn } from "@/components/self-order/SelfOrderWebPushOptIn";
import { trackBundleStorageKey, trackStorageKey } from "@/components/self-order/selfOrderGuestUtils";
import { fetchSelfOrderTrack, type TrackOrderResponse } from "@/lib/selfOrderApi";

function readTrackTokens(hotelId: string): string[] {
  if (typeof window === "undefined") return [];
  const rawBundle = sessionStorage.getItem(trackBundleStorageKey(hotelId));
  const primary = sessionStorage.getItem(trackStorageKey(hotelId));
  if (rawBundle) {
    try {
      const parsed = JSON.parse(rawBundle) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(String);
      }
    } catch {
      /* ignore */
    }
  }
  return primary ? [primary] : [];
}

export default function SelfOrderGuestStatusPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const tableFromQr = searchParams.get("table")?.trim() || "";
  const { selfOrderPushEnabled } = useSelfOrderGuestMeta();

  const [trackTokens, setTrackTokens] = useState<string[]>([]);
  const [orders, setOrders] = useState<(TrackOrderResponse | null)[]>([]);
  const [trackError, setTrackError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const tokens = readTrackTokens(hotelId);
    setTrackTokens(tokens);
    if (tokens.length === 0) {
      setOrders([]);
      return;
    }
    void (async () => {
      try {
        const rows = await Promise.all(
          tokens.map(async (t) => {
            try {
              return await fetchSelfOrderTrack(hotelId, t);
            } catch {
              return null;
            }
          }),
        );
        setOrders(rows);
        setTrackError(null);
      } catch (e) {
        setTrackError(e instanceof Error ? e.message : "Could not load order");
      }
    })();
  }, [hotelId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (trackTokens.length === 0) return;
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [refresh, trackTokens.length]);

  const primaryToken = trackTokens[0] ?? "";

  return (
    <main className="flex-1 py-4 sm:py-6 max-w-lg mx-auto w-full min-w-0 px-2 sm:px-4 space-y-5 sm:space-y-6">
      {trackTokens.length === 0 && (
        <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8 text-center text-zinc-400 text-xs sm:text-sm">
          Place an order from <strong className="text-zinc-200">Customer menu</strong> to see live status here.
        </div>
      )}
      {trackTokens.length > 0 && trackError && orders.every((o) => !o) && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs sm:text-sm text-red-100">{trackError}</div>
      )}
      {orders.some(Boolean) && (
        <div className="space-y-8 sm:space-y-10">
          {orders.map((trackData, idx) => {
            const tok = trackTokens[idx];
            if (!trackData) {
              return (
                <div
                  key={tok ?? `missing-${idx}`}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500 text-center"
                >
                  Could not load one of your tickets — we retry automatically every few seconds.
                </div>
              );
            }
            const isPrimary = Boolean(tok && tok === primaryToken);

            return (
              <section key={tok ?? idx} className="space-y-4">
                <SelfOrderPickupCallout data={trackData} tableFromQr={tableFromQr} />

                {isPrimary && tok ? (
                  <SelfOrderWebPushOptIn
                    hotelId={hotelId}
                    trackToken={tok}
                    orderStatus={trackData.status}
                    tenantPushEnabled={selfOrderPushEnabled}
                  />
                ) : null}

                <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-zinc-500 text-center leading-relaxed px-1">
                  {orders.filter(Boolean).length > 1 ? (
                    <>
                      <span className="text-zinc-400">{trackData.depotName}</span>
                      <span className="text-zinc-600"> · </span>
                    </>
                  ) : null}
                  Order · {trackData.displayCode}
                  {tableFromQr ? ` · Table ${tableFromQr}` : ""}
                </p>
                <OrderStatusTimeline data={trackData} />
                {tok ? (
                  <Link
                    href={`/book/order/${hotelId}/track/${tok}`}
                    className="block text-center text-[11px] sm:text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Open dedicated tracker link
                  </Link>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
