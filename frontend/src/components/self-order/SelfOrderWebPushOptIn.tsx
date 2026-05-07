"use client";

import { useCallback, useEffect, useState } from "react";
import { urlBase64ToUint8Array } from "@/components/self-order/selfOrderGuestUtils";
import { fetchSelfOrderWebPushConfig, subscribeSelfOrderPush } from "@/lib/selfOrderApi";

type Props = {
  hotelId: string;
  trackToken: string;
  /** From track API — hide opt-in once the order is past kitchen prep. */
  orderStatus: string;
  /** Hotel tenant toggle from menu meta; avoids a needless config round-trip when off. */
  tenantPushEnabled?: boolean;
};

export function SelfOrderWebPushOptIn({ hotelId, trackToken, orderStatus, tenantPushEnabled = true }: Props) {
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantPushEnabled) {
      setConfigured(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchSelfOrderWebPushConfig(hotelId);
        if (!cancelled) setConfigured(Boolean(cfg.configured && cfg.publicKey));
      } catch {
        if (!cancelled) setConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, tenantPushEnabled]);

  const eligible =
    orderStatus !== "READY" && orderStatus !== "COMPLETED" && orderStatus !== "CANCELLED";

  const enable = useCallback(async () => {
    setMessage(null);
    if (!trackToken) return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Browser notifications are not supported on this device.");
      return;
    }
    setBusy(true);
    try {
      const cfg = await fetchSelfOrderWebPushConfig(hotelId);
      if (!cfg.configured || !cfg.publicKey) {
        setMessage("Push is not configured for this hotel.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage("Notifications were blocked. You can allow them in browser settings and try again.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/self-order-sw.js");
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg.publicKey) as BufferSource,
        });
      }
      const j = sub.toJSON();
      const endpoint = j.endpoint;
      const p256dh = j.keys?.p256dh;
      const auth = j.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        setMessage("Could not read push subscription. Try again.");
        return;
      }
      await subscribeSelfOrderPush(hotelId, { trackToken, endpoint, p256dh, auth });
      setDone(true);
      setMessage("You’ll get a browser alert when the kitchen marks this order ready.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, [hotelId, trackToken]);

  if (!tenantPushEnabled || !configured || !eligible) return null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-3 space-y-2">
      <p className="text-xs text-zinc-400 text-center">Get a push when the kitchen taps Ready (this device).</p>
      {done ? (
        <p className="text-xs text-emerald-400 text-center">Notifications on for this ticket.</p>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enable()}
          className="w-full rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium py-2.5 disabled:opacity-50"
        >
          {busy ? "Enabling…" : "Notify me when ready"}
        </button>
      )}
      {message ? <p className="text-[11px] text-amber-200/90 text-center">{message}</p> : null}
    </div>
  );
}
