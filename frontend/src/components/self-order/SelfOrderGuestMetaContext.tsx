"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchSelfOrderMenu, type PublicMenuItem } from "@/lib/selfOrderApi";

type SelfOrderGuestMeta = {
  hotelId: string;
  loading: boolean;
  error: string | null;
  currency: string;
  hotelName: string;
  boardKeyConfigured: boolean;
  /** False when hotel disables SMS on READY for guests. */
  selfOrderSmsEnabled: boolean;
  /** False when hotel disables Web Push subscribe for guests. */
  selfOrderPushEnabled: boolean;
  depots: { id: string; name: string }[];
  items: PublicMenuItem[];
  reload: () => void;
};

const Ctx = createContext<SelfOrderGuestMeta | null>(null);

export function SelfOrderGuestMetaProvider({ hotelId, children }: { hotelId: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [hotelName, setHotelName] = useState("");
  const [boardKeyConfigured, setBoardKeyConfigured] = useState(false);
  const [selfOrderSmsEnabled, setSelfOrderSmsEnabled] = useState(true);
  const [selfOrderPushEnabled, setSelfOrderPushEnabled] = useState(true);
  const [depots, setDepots] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await fetchSelfOrderMenu(hotelId);
        if (cancelled) return;
        setCurrency(m.currency || "USD");
        setHotelName(m.hotelName?.trim() || "");
        setBoardKeyConfigured(Boolean(m.orderBoardKeyConfigured));
        setSelfOrderSmsEnabled(m.selfOrderSmsEnabled !== false);
        setSelfOrderPushEnabled(m.selfOrderPushEnabled !== false);
        setDepots(m.depots ?? []);
        setItems(m.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load menu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId, tick]);

  const value = useMemo(
    () =>
      ({
        hotelId,
        loading,
        error,
        currency,
        hotelName,
        boardKeyConfigured,
        selfOrderSmsEnabled,
        selfOrderPushEnabled,
        depots,
        items,
        reload: () => setTick((x) => x + 1),
      }) satisfies SelfOrderGuestMeta,
    [
      hotelId,
      loading,
      error,
      currency,
      hotelName,
      boardKeyConfigured,
      selfOrderSmsEnabled,
      selfOrderPushEnabled,
      depots,
      items,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSelfOrderGuestMeta() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSelfOrderGuestMeta must be used under SelfOrderGuestMetaProvider");
  return v;
}
