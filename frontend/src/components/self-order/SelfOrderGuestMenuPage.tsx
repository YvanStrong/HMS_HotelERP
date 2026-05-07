"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";
import {
  formatMoney,
  menuItemMatchesService,
  trackBundleStorageKey,
  trackStorageKey,
} from "@/components/self-order/selfOrderGuestUtils";
import { buildGuestSelfOrderHref, type GuestOrderQuery } from "@/lib/selfOrderGuestNav";
import type { SelfOrderPaymentMode, SelfOrderServiceType } from "@/lib/selfOrderApi";
import { placeSelfOrder, SELF_ORDER_SMS_CONSENT_VERSION } from "@/lib/selfOrderApi";

type Step = "menu" | "payment";

const MENU_PAGE_SIZE = 12;

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

  const { currency, depots, items, selfOrderSmsEnabled } = useSelfOrderGuestMeta();

  const [step, setStep] = useState<Step>("menu");
  const [serviceType, setServiceType] = useState<SelfOrderServiceType | null>(null);
  const [depotId, setDepotId] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [lineModifiers, setLineModifiers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [paymentMode, setPaymentMode] = useState<SelfOrderPaymentMode>("SIMULATED");
  const [roomNumber, setRoomNumber] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [pickupDisplayName, setPickupDisplayName] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [smsNotifyPhone, setSmsNotifyPhone] = useState("");
  const [smsConsentAccepted, setSmsConsentAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const placeIdempotencyKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuPage, setMenuPage] = useState(0);
  const depotIdRef = useRef(depotId);
  depotIdRef.current = depotId;

  useEffect(() => {
    if (depots.length === 1) setDepotId(depots[0].id);
  }, [depots]);

  useEffect(() => {
    const t = searchParams.get("table")?.trim();
    if (t) setPickupLocation((prev) => (prev.trim() ? prev : t));
  }, [searchParams]);

  useEffect(() => {
    setMenuPage(0);
  }, [serviceType, depotId]);

  useEffect(() => {
    setCart({});
    setLineModifiers({});
  }, [serviceType]);

  /** Multi-outlet cart: clear outlet filter so guests can keep adding from any outlet. */
  useEffect(() => {
    const ids = new Set(
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id]) => items.find((x) => x.id === id)?.depotId)
        .filter((x): x is string => Boolean(x)),
    );
    if (ids.size > 1 && depotId) setDepotId("");
  }, [cart, items, depotId]);

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

  const addToCart = useCallback((productId: string) => {
    const p = items.find((x) => x.id === productId);
    if (!p) return;
    setError(null);
    const cur = depotIdRef.current;
    if (!cur) setDepotId(p.depotId);
    setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
  }, [items]);

  const setQty = useCallback((productId: string, qty: number) => {
    setCart((c) => {
      const next = { ...c };
      if (!Number.isFinite(qty) || qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }, []);

  async function submit() {
    const depotIds = Array.from(new Set(cartRows.map((r) => r.depotId)));
    if (!serviceType || cartRows.length === 0) return;
    if (depotIds.length === 0) return;
    if (paymentMode === "CHARGE_ROOM") {
      if (!roomNumber.trim() || !bookingCode.trim()) {
        setError("Enter room number and booking / confirmation code to charge to your folio.");
        return;
      }
    }
    const phone = smsNotifyPhone.trim().slice(0, 24);
    if (phone && selfOrderSmsEnabled && !smsConsentAccepted) {
      setError("Tick the SMS consent box to receive a text when your order is ready.");
      return;
    }
    if (!placeIdempotencyKeyRef.current) {
      placeIdempotencyKeyRef.current = crypto.randomUUID();
    }
    setSubmitting(true);
    setError(null);
    try {
      const idem = placeIdempotencyKeyRef.current;
      const res = await placeSelfOrder(
        hotelId,
        {
          serviceType,
          ...(depotIds.length === 1 ? { depotId: depotIds[0] } : {}),
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
          ...(pickupDisplayName.trim()
            ? { pickup_display_name: pickupDisplayName.trim().slice(0, 64) }
            : {}),
          ...(pickupLocation.trim() ? { pickup_location: pickupLocation.trim().slice(0, 48) } : {}),
          ...(phone && selfOrderSmsEnabled
            ? {
                sms_notify_phone: phone,
                sms_consent_accepted: true,
                sms_consent_version: SELF_ORDER_SMS_CONSENT_VERSION,
              }
            : {}),
        },
        { idempotencyKey: idem },
      );
      const tok = String(res.trackToken);
      sessionStorage.setItem(trackStorageKey(hotelId), tok);
      const siblings = res.siblingOrders ?? [];
      const bundle = [tok, ...siblings.map((s) => String(s.trackToken))];
      if (bundle.length > 1) {
        sessionStorage.setItem(trackBundleStorageKey(hotelId), JSON.stringify(bundle));
      } else {
        sessionStorage.removeItem(trackBundleStorageKey(hotelId));
      }
      setCart({});
      setLineModifiers({});
      setNote("");
      setRoomNumber("");
      setBookingCode("");
      setPickupDisplayName("");
      setPickupLocation(query.table?.trim() ?? "");
      setSmsNotifyPhone("");
      setSmsConsentAccepted(false);
      placeIdempotencyKeyRef.current = null;
      router.push(buildGuestSelfOrderHref(hotelId, "status", query));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 py-3 sm:py-5 space-y-4 sm:space-y-6 max-w-6xl mx-auto w-full px-2 sm:px-4 min-w-0">
      {error && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">{error}</div>
      )}

      <>
          <div className="rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-5 space-y-2 sm:space-y-3">
            <p className="text-xs sm:text-sm text-zinc-400">Dine in or take away — browse and add items to one cart (multiple outlets combine into one checkout).</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setServiceType("DINE_IN")}
                className={`rounded-lg sm:rounded-xl border-2 py-3 sm:py-4 text-left px-3 sm:px-4 transition-all ${
                  serviceType === "DINE_IN"
                    ? "border-emerald-500/80 bg-emerald-950/30 text-white"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold text-sm sm:text-base">Dine in</span>
                <span className="text-[10px] sm:text-xs text-zinc-500">On site</span>
              </button>
              <button
                type="button"
                onClick={() => setServiceType("TAKE_AWAY")}
                className={`rounded-lg sm:rounded-xl border-2 py-3 sm:py-4 text-left px-3 sm:px-4 transition-all ${
                  serviceType === "TAKE_AWAY"
                    ? "border-emerald-500/80 bg-emerald-950/30 text-white"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <span className="block font-semibold text-sm sm:text-base">Take away</span>
                <span className="text-[10px] sm:text-xs text-zinc-500">Pickup</span>
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
                  Filter menu by outlet{" "}
                  {cartRows.length > 0 ? (
                    <span className="text-zinc-600">(changing outlet clears the cart)</span>
                  ) : null}
                  <select
                    value={depotId}
                    onChange={(e) => {
                      setDepotId(e.target.value);
                      setCart({});
                      setLineModifiers({});
                    }}
                    className="mt-1 w-full max-w-md rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 py-2 px-3"
                  >
                    <option value="">All outlets</option>
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
                  <div className="w-full min-w-0">
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
                      {pagedMenuItems.map((p) => {
                        const managed = p.stockType === "STOCK";
                        const stock = Number(p.stockQty);
                        const blocked = managed && stock <= 0;
                        return (
                          <div
                            key={p.id}
                            className={`rounded-xl sm:rounded-2xl overflow-hidden border flex flex-col min-w-0 ${
                              blocked ? "opacity-50 border-zinc-800 border-dashed" : "border-zinc-800 bg-zinc-900"
                            }`}
                          >
                            <div className="aspect-[4/3] bg-zinc-800 overflow-hidden max-h-[140px] sm:max-h-none">
                              {p.photoUrl ? (
                                <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <MenuImagePlaceholder />
                              )}
                            </div>
                            <div className="p-2.5 sm:p-3 flex flex-col flex-1 bg-zinc-900 min-h-0">
                              <p className="font-semibold text-sm sm:text-base text-white leading-snug line-clamp-2">
                                {p.productName}
                              </p>
                              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">
                                {formatMoney(currency, Number(p.sellingPrice))}
                              </p>
                              {managed ? (
                                <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-0.5">{stock.toFixed(0)} in stock</p>
                              ) : null}
                              <button
                                type="button"
                                disabled={blocked}
                                onClick={() => addToCart(p.id)}
                                className="mt-auto pt-2 sm:pt-3 w-full rounded-lg sm:rounded-xl border border-zinc-600 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 min-h-[40px] sm:min-h-[44px]"
                              >
                                {blocked ? "Sold out" : "+ Add"}
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
                              <span className="font-medium text-zinc-100 min-w-0">
                                <span className="block">{r.productName} × {r.qty}</span>
                                {depots.length > 1 ? (
                                  <span className="block text-[10px] font-normal text-zinc-500 mt-0.5">
                                    {r.depotName}
                                  </span>
                                ) : null}
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
                      onClick={() => {
                        placeIdempotencyKeyRef.current = crypto.randomUUID();
                        setStep("payment");
                      }}
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
              <button
                type="button"
                className="text-sm text-zinc-400 hover:text-white underline"
                onClick={() => {
                  placeIdempotencyKeyRef.current = null;
                  setSmsConsentAccepted(false);
                  setStep("menu");
                }}
              >
                ← Back to menu
              </button>
              <p className="text-zinc-400 text-sm">
                Total <span className="text-white font-semibold tabular-nums">{cartTotal.toFixed(2)}</span> {currency}
              </p>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-3">
                <p className="text-xs text-zinc-400">
                  Pickup details — staff can call <strong className="text-zinc-200">“Order for …”</strong> using the
                  name below (and your short code on the receipt).
                </p>
                <label className="block text-xs text-zinc-500">
                  Name for order
                  <input
                    value={pickupDisplayName}
                    onChange={(e) => setPickupDisplayName(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 text-white px-3 py-2 min-h-[44px]"
                    placeholder="e.g. Alex"
                    maxLength={64}
                    autoComplete="name"
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Table / seat / area
                  <input
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 text-white px-3 py-2 min-h-[44px]"
                    placeholder="Pre-filled from QR when available"
                    maxLength={48}
                  />
                </label>
                {selfOrderSmsEnabled ? (
                  <>
                    <label className="block text-xs text-zinc-500">
                      Mobile for SMS when ready (optional)
                      <input
                        value={smsNotifyPhone}
                        onChange={(e) => {
                          setSmsNotifyPhone(e.target.value);
                          if (!e.target.value.trim()) setSmsConsentAccepted(false);
                        }}
                        className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 text-white px-3 py-2 min-h-[44px]"
                        placeholder="+233… (E.164)"
                        maxLength={24}
                        inputMode="tel"
                        autoComplete="tel"
                      />
                    </label>
                    {smsNotifyPhone.trim() ? (
                      <label className="flex gap-3 items-start text-xs text-zinc-300 leading-snug cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-zinc-600"
                          checked={smsConsentAccepted}
                          onChange={(e) => setSmsConsentAccepted(e.target.checked)}
                        />
                        <span>
                          I agree to receive <strong className="text-zinc-200">one transactional SMS</strong> when this
                          order is marked ready (consent v{SELF_ORDER_SMS_CONSENT_VERSION}). Message and data rates may
                          apply.
                        </span>
                      </label>
                    ) : (
                      <p className="text-[11px] text-zinc-500 leading-relaxed">
                        Optional SMS when ready — enter a mobile number above, then confirm consent.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    SMS alerts when ready are turned off for this venue.
                  </p>
                )}
              </div>
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
                <p className="text-xs text-zinc-500">
                  Items from different outlets are still one checkout: you get one kitchen ticket per outlet (same
                  payment choice for all).
                </p>
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
