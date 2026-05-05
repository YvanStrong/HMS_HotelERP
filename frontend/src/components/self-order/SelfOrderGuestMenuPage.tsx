"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";
import {
  formatMoney,
  menuItemMatchesService,
  trackStorageKey,
} from "@/components/self-order/selfOrderGuestUtils";
import { buildGuestSelfOrderHref, type GuestOrderQuery } from "@/lib/selfOrderGuestNav";
import type { SelfOrderPaymentMode, SelfOrderServiceType } from "@/lib/selfOrderApi";
import { placeSelfOrder } from "@/lib/selfOrderApi";

type Step = "menu" | "payment";

const MENU_PAGE_SIZE = 8;

function MenuImagePlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-zinc-800 px-3 text-center">
      <svg
        className="h-12 w-12 text-zinc-600 mb-2 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <span className="text-[11px] text-zinc-500 leading-snug">Photo from Staff → Menu (product image)</span>
    </div>
  );
}

export default function SelfOrderGuestMenuPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);

  const query: GuestOrderQuery = useMemo(
    () => ({
      table: searchParams.get("table"),
      key: searchParams.get("key"),
    }),
    [searchParams],
  );

  const { currency, depots, items } = useSelfOrderGuestMeta();

  const [step, setStep] = useState<Step>("menu");
  const [serviceType, setServiceType] = useState<SelfOrderServiceType | null>(null);
  const [depotId, setDepotId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [lineModifiers, setLineModifiers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [paymentMode, setPaymentMode] = useState<SelfOrderPaymentMode>("SIMULATED");
  const [roomNumber, setRoomNumber] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPage, setMenuPage] = useState(0);
  const depotIdRef = useRef(depotId);
  depotIdRef.current = depotId;

  useEffect(() => {
    if (depots.length === 1) setDepotId(depots[0].id);
  }, [depots]);

  useEffect(() => {
    setMenuPage(0);
  }, [serviceType, depotId]);

  useEffect(() => {
    setCart({});
    setLineModifiers({});
  }, [serviceType]);

  const filteredItems = useMemo(() => {
    if (!serviceType) return [];
    return items.filter((p) => {
      if (depotId && p.depotId !== depotId) return false;
      return menuItemMatchesService(p.menuName, serviceType);
    });
  }, [items, depotId, serviceType]);

  const menuPageCount = Math.max(1, Math.ceil(filteredItems.length / MENU_PAGE_SIZE));
  useEffect(() => {
    setMenuPage((p) => Math.min(p, menuPageCount - 1));
  }, [menuPageCount]);

  const pagedMenuItems = useMemo(() => {
    const safe = Math.min(menuPage, menuPageCount - 1);
    const start = safe * MENU_PAGE_SIZE;
    return filteredItems.slice(start, start + MENU_PAGE_SIZE);
  }, [filteredItems, menuPage, menuPageCount]);

  const cartRows = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = items.find((x) => x.id === id);
        if (!p || qty <= 0) return null;
        return { ...p, qty };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, items]);

  const cartTotal = useMemo(
    () => cartRows.reduce((s, r) => s + Number(r.sellingPrice) * r.qty, 0),
    [cartRows],
  );

  const addToCart = useCallback(
    (productId: string) => {
      const p = items.find((x) => x.id === productId);
      if (!p) return;
      setError(null);
      const cur = depotIdRef.current;
      if (cur && cur !== p.depotId) {
        setError(
          "This item is from a different outlet than your cart. Clear the cart to switch outlet, or finish this order first.",
        );
        return;
      }
      if (!cur) setDepotId(p.depotId);
      setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
    },
    [items],
  );

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (!Number.isFinite(qty) || qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  async function submit() {
    const resolvedDepotId = depotId || cartRows[0]?.depotId || "";
    if (!serviceType || !resolvedDepotId || cartRows.length === 0) return;
    if (paymentMode === "CHARGE_ROOM") {
      if (!roomNumber.trim() || !bookingCode.trim()) {
        setError("Enter room number and booking / confirmation code to charge to your folio.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await placeSelfOrder(hotelId, {
        serviceType,
        depotId: resolvedDepotId,
        lines: cartRows.map((r) => {
          const m = (lineModifiers[r.id] ?? "").trim();
          return {
            productId: r.id,
            quantity: r.qty,
            ...(m ? { modifiersNote: m } : {}),
          };
        }),
        customerNote: note.trim() || null,
        paymentMode,
        ...(paymentMode === "CHARGE_ROOM"
          ? {
              room_charge: {
                roomNumber: roomNumber.trim(),
                bookingCode: bookingCode.trim(),
              },
            }
          : {}),
      });
      const tok = String(res.trackToken);
      sessionStorage.setItem(trackStorageKey(hotelId), tok);
      setCart({});
      setLineModifiers({});
      setNote("");
      setRoomNumber("");
      setBookingCode("");
      router.push(buildGuestSelfOrderHref(hotelId, "status", query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 py-4 sm:py-6 space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-4">
      {error && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">{error}</div>
      )}

      <>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5 space-y-3">
            <p className="text-sm text-zinc-400">Dine in or take away — then scroll the menu and tap add.</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setServiceType("DINE_IN")}
                className={`rounded-xl border-2 py-4 text-left px-4 transition-all ${
                  serviceType === "DINE_IN"
                    ? "border-emerald-500/80 bg-emerald-950/30 text-white"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold">Dine in</span>
                <span className="text-xs text-zinc-500">On site</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceType("TAKE_AWAY")}
                className={`rounded-xl border-2 py-4 text-left px-4 transition-all ${
                  serviceType === "TAKE_AWAY"
                    ? "border-emerald-500/80 bg-emerald-950/30 text-white"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold">Take away</span>
                <span className="text-xs text-zinc-500">Pickup</span>
              </button>
            </div>
          </div>

          {!serviceType && (
            <p className="text-center text-zinc-500 text-sm py-8 border border-dashed border-zinc-800 rounded-2xl">
              Choose <strong className="text-zinc-300">Dine in</strong> or <strong className="text-zinc-300">Take away</strong> to open the menu.
            </p>
          )}

          {serviceType && step === "menu" && (
            <>
              {depots.length > 1 && (
                <label className="block text-xs text-zinc-500">
                  Outlet {depotId && cartRows.length > 0 ? <span className="text-zinc-600">(set from your items — change clears cart)</span> : null}
                  <select
                    value={depotId}
                    onChange={(e) => {
                      setDepotId(e.target.value);
                      setCart({});
                      setLineModifiers({});
                    }}
                    className="mt-1 w-full max-w-md rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 py-2 px-3"
                  >
                    <option value="">All outlets (pick an item to set)</option>
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {depots.length === 0 ? (
                <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-amber-100">
                  No sellable outlets yet. Add depot products on Staff → Menu.
                </div>
              ) : (
                <>
                  <div className="-mx-1 px-1">
                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-px-4">
                      {pagedMenuItems.map((p) => {
                        const managed = p.stockType === "STOCK";
                        const stock = Number(p.stockQty);
                        const blocked = managed && stock <= 0;
                        return (
                          <div
                            key={p.id}
                            className={`snap-start shrink-0 w-[min(85vw,280px)] rounded-2xl overflow-hidden border flex flex-col ${
                              blocked ? "opacity-50 border-zinc-800 border-dashed" : "border-zinc-800 bg-zinc-900"
                            }`}
                          >
                            <div className="aspect-[4/3] bg-zinc-800 overflow-hidden">
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <MenuImagePlaceholder />
                              )}
                            </div>
                            <div className="p-4 flex flex-col flex-1 bg-zinc-900">
                              <p className="font-bold text-lg text-white leading-tight">{p.productName}</p>
                              <p className="text-sm text-zinc-400 mt-1">{formatMoney(currency, Number(p.sellingPrice))}</p>
                              {managed ? (
                                <p className="text-[11px] text-zinc-500 mt-0.5">{stock.toFixed(0)} in stock</p>
                              ) : null}
                              <button
                                type="button"
                                disabled={blocked}
                                onClick={() => addToCart(p.id)}
                                className="mt-4 w-full rounded-xl border border-zinc-600 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 min-h-[48px]"
                              >
                                {blocked ? "Sold out" : "+ Add to order"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {filteredItems.length > MENU_PAGE_SIZE && (
                    <div className="flex flex-wrap items-center justify-center gap-3 py-2">
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40 min-h-[44px]"
                        disabled={menuPage <= 0}
                        onClick={() => setMenuPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </button>
                      <span className="text-sm text-zinc-400 tabular-nums">
                        Page {Math.min(menuPage + 1, menuPageCount)} / {menuPageCount} ({filteredItems.length} items)
                      </span>
                      <button
                        type="button"
                        className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 disabled:opacity-40 min-h-[44px]"
                        disabled={menuPage >= menuPageCount - 1}
                        onClick={() => setMenuPage((p) => Math.min(menuPageCount - 1, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                  {filteredItems.length === 0 && (
                    <p className="text-zinc-500 text-sm text-center py-6">No items for this mode / outlet.</p>
                  )}
                  <p className="text-center text-zinc-500 text-sm">Add items to start your order.</p>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
                    <h3 className="font-semibold text-zinc-200">Your order</h3>
                    {cartRows.length === 0 ? (
                      <p className="text-sm text-zinc-500">Cart is empty.</p>
                    ) : (
                      <ul className="space-y-3">
                        {cartRows.map((r) => (
                          <li key={r.id} className="rounded-xl border border-zinc-800 p-3 space-y-2 bg-zinc-950/50">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <span className="font-medium text-zinc-100">
                                {r.productName} × {r.qty}
                              </span>
                              <span className="tabular-nums text-zinc-300">
                                {(Number(r.sellingPrice) * r.qty).toFixed(2)}
                              </span>
                              <div className="flex gap-1 w-full sm:w-auto">
                                <button
                                  type="button"
                                  className="rounded-lg border border-zinc-600 px-3 py-2 min-h-[44px] text-zinc-200"
                                  onClick={() => setQty(r.id, r.qty - 1)}
                                >
                                  −
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-zinc-600 px-3 py-2 min-h-[44px] text-zinc-200"
                                  onClick={() => setQty(r.id, r.qty + 1)}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <label className="block text-xs text-zinc-500">
                              Allergens / modifiers (optional)
                              <input
                                value={lineModifiers[r.id] ?? ""}
                                onChange={(e) =>
                                  setLineModifiers((prev) => ({
                                    ...prev,
                                    [r.id]: e.target.value.slice(0, 280),
                                  }))
                                }
                                className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 text-sm px-3 py-2"
                                placeholder="e.g. No dairy · Medium spice"
                                maxLength={280}
                              />
                            </label>
                          </li>
                        ))}
                        <li className="flex justify-between font-semibold text-zinc-100 pt-2 border-t border-zinc-800">
                          <span>Total</span>
                          <span>
                            {cartTotal.toFixed(2)} {currency}
                          </span>
                        </li>
                      </ul>
                    )}
                    <label className="block text-xs text-zinc-500">
                      Note to kitchen (optional)
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="mt-1 w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 px-3 py-2"
                        maxLength={280}
                      />
                    </label>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-white text-zinc-900 font-semibold py-3 min-h-[48px] disabled:opacity-40"
                      disabled={cartRows.length === 0 || depots.length === 0}
                      onClick={() => setStep("payment")}
                    >
                      Continue to payment
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {serviceType && step === "payment" && (
            <div className="max-w-lg mx-auto space-y-4 w-full">
              <button type="button" className="text-sm text-zinc-400 hover:text-white underline" onClick={() => setStep("menu")}>
                ← Back to menu
              </button>
              <p className="text-zinc-400 text-sm">
                Total <span className="text-white font-semibold tabular-nums">{cartTotal.toFixed(2)}</span> {currency}
              </p>
              <div className="space-y-3">
                {(
                  [
                    ["SIMULATED", "Pay now (demo)", "Marks paid so the kitchen sees the ticket immediately."],
                    ["PAY_AT_COUNTER", "Pay at counter", "Staff confirms payment in the hotel console; then the kitchen display shows your order."],
                    ["CHARGE_ROOM", "Charge to room (folio)", "Posts to your in-house bill when room and booking code match a checked-in stay."],
                  ] as const
                ).map(([mode, title, desc]) => (
                  <label
                    key={mode}
                    className={`flex gap-3 rounded-xl border-2 p-4 cursor-pointer ${
                      paymentMode === mode ? "border-emerald-500/70 bg-emerald-950/20" : "border-zinc-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      checked={paymentMode === mode}
                      onChange={() => setPaymentMode(mode)}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium text-white">{title}</p>
                      <p className="text-sm text-zinc-500 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
                {paymentMode === "CHARGE_ROOM" && (
                  <div className="rounded-xl border border-zinc-800 p-3 space-y-2 bg-zinc-900/60">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <label className="text-xs text-zinc-500 block">
                        Room number
                        <input
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 text-white px-3 py-2 min-h-[44px]"
                        />
                      </label>
                      <label className="text-xs text-zinc-500 block">
                        Booking / confirmation code
                        <input
                          value={bookingCode}
                          onChange={(e) => setBookingCode(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 text-white px-3 py-2 min-h-[44px]"
                        />
                      </label>
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-500">Split bill: separate orders per guest, or ask front desk.</p>
              </div>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-3 min-h-[52px] disabled:opacity-50"
              >
                {submitting ? "Placing order…" : "Place order"}
              </button>
            </div>
          )}
      </>
    </main>
  );
}
