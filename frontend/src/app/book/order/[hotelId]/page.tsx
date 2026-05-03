"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { PublicMenuItem, SelfOrderPaymentMode, SelfOrderServiceType } from "@/lib/selfOrderApi";
import { fetchSelfOrderMenu, placeSelfOrder } from "@/lib/selfOrderApi";

type Step = "menu" | "payment" | "done";

/**
 * If a depot product's menu name includes only DINE_IN or only TAKE_AWAY-style tags, it is shown for that service
 * only. Names without those tags (e.g. GENERAL, BAR) appear for both. Staff can use menu names like DINE_IN_LUNCH
 * or TAKEAWAY_SNACKS in Inventory → Products.
 */
function menuItemMatchesService(menuName: string | undefined, st: SelfOrderServiceType): boolean {
  const raw = (menuName ?? "").toUpperCase().replace(/\s+/g, "_");
  const dine = raw.includes("DINE_IN") || raw.includes("DINEIN");
  const take =
    raw.includes("TAKE_AWAY") || raw.includes("TAKEAWAY") || raw.includes("TAKE_OUT") || raw.includes("PICKUP");
  if (dine && take) return true;
  if (dine && !take) return st === "DINE_IN";
  if (take && !dine) return st === "TAKE_AWAY";
  return true;
}

export default function SelfOrderKioskPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [step, setStep] = useState<Step>("menu");
  const [serviceType, setServiceType] = useState<SelfOrderServiceType | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [boardKeyConfigured, setBoardKeyConfigured] = useState(false);
  const [depotId, setDepotId] = useState("");
  const [items, setItems] = useState<PublicMenuItem[]>([]);
  const [depots, setDepots] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [paymentMode, setPaymentMode] = useState<SelfOrderPaymentMode>("SIMULATED");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    displayCode: string;
    trackToken: string;
    orderNumber: string;
    paymentStatus: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const m = await fetchSelfOrderMenu(hotelId);
        if (cancelled) return;
        setCurrency(m.currency || "USD");
        setBoardKeyConfigured(Boolean(m.orderBoardKeyConfigured));
        const d = m.depots ?? [];
        setDepots(d);
        setItems(m.items ?? []);
        if (d.length === 1) setDepotId(d[0].id);
        else setDepotId("");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load menu");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    setCart({});
  }, [serviceType]);

  const filteredItems = useMemo(() => {
    if (!serviceType) return [];
    return items.filter((p) => {
      if (depotId && p.depotId !== depotId) return false;
      return menuItemMatchesService(p.menuName, serviceType);
    });
  }, [items, depotId, serviceType]);

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

  function pickServiceType(st: SelfOrderServiceType) {
    setServiceType(st);
  }

  function addToCart(productId: string) {
    setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
  }

  function setQty(productId: string, qty: number) {
    setCart((c) => {
      const next = { ...c };
      if (!Number.isFinite(qty) || qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  }

  async function submit() {
    if (!serviceType || !depotId || cartRows.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await placeSelfOrder(hotelId, {
        serviceType,
        depotId,
        lines: cartRows.map((r) => ({ productId: r.id, quantity: r.qty })),
        customerNote: note.trim() || null,
        paymentMode,
      });
      setDone({
        displayCode: res.displayCode,
        trackToken: res.trackToken,
        orderNumber: res.orderNumber,
        paymentStatus: res.paymentStatus,
      });
      setStep("done");
      setCart({});
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Order failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-page py-16 text-center text-muted-foreground">
        Loading menu…
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="container-page py-12 space-y-4">
        <div className="error">{error}</div>
        <Link href="/book/hotels" className="hms-btn-outline">
          Back to hotels
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8 max-w-4xl mx-auto space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link href="/book/hotels" className="hover:text-primary">
          Hotels
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Self-order</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Order food</h1>
        <p className="text-muted-foreground text-sm mt-1">
          First choose <strong>dine in</strong> or <strong>take away</strong> — the menu appears after you pick. Then
          add items, pay, and track your order.
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      {step === "menu" && (
        <section className="space-y-8">
          <div className="rounded-2xl border-2 border-border bg-card p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Step 1 — Dine in or take away?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                The list below updates for your choice. (Optional: staff can tag menu groups in Inventory with{" "}
                <code className="text-xs bg-muted px-1 rounded">DINE_IN</code> or{" "}
                <code className="text-xs bg-muted px-1 rounded">TAKE_AWAY</code> in the menu name to show items only
                for that mode.)
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                type="button"
                className={`rounded-2xl border-2 p-6 sm:p-8 text-left transition-all ${
                  serviceType === "DINE_IN"
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 bg-muted/20"
                }`}
                onClick={() => pickServiceType("DINE_IN")}
              >
                <span className="text-xl font-bold block mb-2">Dine in</span>
                <span className="text-sm text-muted-foreground">Eat on site — menu for dining room / table service.</span>
              </button>
              <button
                type="button"
                className={`rounded-2xl border-2 p-6 sm:p-8 text-left transition-all ${
                  serviceType === "TAKE_AWAY"
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40 bg-muted/20"
                }`}
                onClick={() => pickServiceType("TAKE_AWAY")}
              >
                <span className="text-xl font-bold block mb-2">Take away</span>
                <span className="text-sm text-muted-foreground">Pick up to go — menu for takeaway / counter pickup.</span>
              </button>
            </div>
          </div>

          {!serviceType && (
            <p className="text-center text-muted-foreground py-10 rounded-xl border border-dashed border-border bg-muted/10">
              Choose <strong>Dine in</strong> or <strong>Take away</strong> above to load the menu for that option.
            </p>
          )}

          {serviceType && (
            <>
              <div className="rounded-xl bg-primary/10 border border-primary/25 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">
                  Menu for:{" "}
                  <span className="text-primary">{serviceType === "DINE_IN" ? "Dine in" : "Take away"}</span>
                </p>
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline hover:text-foreground"
                  onClick={() => setServiceType(null)}
                >
                  Change choice
                </button>
              </div>

              {depots.length === 0 && (
                <p className="text-sm text-amber-800 dark:text-amber-200 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                  No active outlets are set up for this hotel yet. Ask staff to create depots under Inventory before
                  self-order is available.
                </p>
              )}

              {depots.length > 1 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Menu / outlet</label>
                  <select
                    value={depotId}
                    onChange={(e) => {
                      setDepotId(e.target.value);
                      setCart({});
                    }}
                    className="w-full max-w-md"
                  >
                    <option value="">Choose outlet…</option>
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <h2 className="text-lg font-semibold mb-3">Step 2 — Menu</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredItems.map((p) => {
                    const managed = p.stockType === "STOCK";
                    const stock = Number(p.stockQty);
                    const blocked = managed && stock <= 0;
                    return (
                      <div
                        key={p.id}
                        className={`flex gap-3 rounded-xl border p-3 ${blocked ? "opacity-50" : "bg-card border-border/70"}`}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted/40">
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
                              No photo
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold leading-tight">{p.productName}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/90">{p.menuName}</p>
                          <p className="text-xs text-muted-foreground">
                            {Number(p.sellingPrice).toFixed(2)} {currency}
                            {managed ? ` · Stock ${stock.toFixed(0)}` : " · Non stock"}
                          </p>
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm mt-2"
                            disabled={blocked}
                            onClick={() => addToCart(p.id)}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredItems.length === 0 && (
                  <p className="text-muted-foreground text-sm mt-3">
                    No items for this outlet and service type. Try another outlet or ask staff to add products (or use
                    menu names without DINE_IN / TAKE_AWAY tags so items show for both).
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                <h3 className="font-semibold">Your order</h3>
                {cartRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tap Add on items above.</p>
                ) : (
                  <ul className="space-y-2">
                    {cartRows.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {r.productName} × {r.qty}
                        </span>
                        <span className="tabular-nums">{(Number(r.sellingPrice) * r.qty).toFixed(2)}</span>
                        <div className="flex items-center gap-1 w-full sm:w-auto">
                          <button type="button" className="hms-btn-outline hms-btn-sm px-2" onClick={() => setQty(r.id, r.qty - 1)}>
                            −
                          </button>
                          <button type="button" className="hms-btn-outline hms-btn-sm px-2" onClick={() => setQty(r.id, r.qty + 1)}>
                            +
                          </button>
                        </div>
                      </li>
                    ))}
                    <li className="pt-2 border-t font-semibold flex justify-between">
                      <span>Total</span>
                      <span>
                        {cartTotal.toFixed(2)} {currency}
                      </span>
                    </li>
                  </ul>
                )}
                <label className="block text-sm">
                  <span className="text-muted-foreground">Note to kitchen (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full" maxLength={280} />
                </label>
                <button
                  type="button"
                  className="hms-btn-solid"
                  disabled={!depotId || cartRows.length === 0 || depots.length === 0}
                  onClick={() => setStep("payment")}
                >
                  Continue to payment
                </button>
                {depots.length > 1 && !depotId && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">Select a menu / outlet before continuing.</p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {step === "payment" && serviceType && (
        <section className="space-y-6 max-w-lg">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setStep("menu")}>
              ← Back
            </button>
            <span className="text-sm rounded-full bg-muted px-3 py-1">
              {serviceType === "DINE_IN" ? "Dine in" : "Take away"}
            </span>
            <span className="text-sm text-muted-foreground">
              Total {cartTotal.toFixed(2)} {currency}
            </span>
          </div>
          <h2 className="text-lg font-semibold">Payment</h2>
          <div className="space-y-3">
            <label
              className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 ${
                paymentMode === "SIMULATED" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="pay"
                checked={paymentMode === "SIMULATED"}
                onChange={() => setPaymentMode("SIMULATED")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">Pay now (demo)</p>
                <p className="text-sm text-muted-foreground">
                  Marks the order paid immediately so the kitchen sees it. Use for kiosks or testing.
                </p>
              </div>
            </label>
            <label
              className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 ${
                paymentMode === "PAY_AT_COUNTER" ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="radio"
                name="pay"
                checked={paymentMode === "PAY_AT_COUNTER"}
                onChange={() => setPaymentMode("PAY_AT_COUNTER")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">Pay at counter</p>
                <p className="text-sm text-muted-foreground">
                  Order is sent unpaid. Staff collects payment and confirms in the hotel console; then stock updates and
                  the kitchen board shows your order.
                </p>
              </div>
            </label>
            <label className="flex gap-3 rounded-xl border-2 border-dashed border-muted p-4 opacity-60 cursor-not-allowed">
              <input type="radio" name="pay" disabled className="mt-1" />
              <div>
                <p className="font-medium">Card (Stripe)</p>
                <p className="text-sm text-muted-foreground">Coming soon — connect Stripe for online prepayment.</p>
              </div>
            </label>
          </div>
          <button type="button" className="hms-btn-solid" disabled={submitting} onClick={() => void submit()}>
            {submitting ? "Placing order…" : "Place order"}
          </button>
        </section>
      )}

      {step === "done" && done && (
        <section className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Your order number</p>
          <p className="text-5xl font-black tracking-widest text-primary">{done.displayCode}</p>
          <p className="text-sm text-muted-foreground">Also saved as {done.orderNumber}</p>
          {done.paymentStatus === "UNPAID" ? (
            <p className="text-sm max-w-md mx-auto text-amber-900 dark:text-amber-100">
              Pay at the counter and keep this code. Staff will confirm payment; after that the kitchen will see your
              order on the display.
            </p>
          ) : (
            <p className="text-sm max-w-md mx-auto">
              Watch the kitchen screen for this code when the status moves to <strong>Ready</strong>, or open your
              personal tracker.
            </p>
          )}
          {boardKeyConfigured ? (
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              The live kitchen TV uses a private link from staff — it is not opened from here.
            </p>
          ) : (
            <Link
              href={`/book/order/${hotelId}/screen`}
              className="inline-block hms-btn-outline text-sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open big screen (no secret)
            </Link>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link href={`/book/order/${hotelId}/track/${done.trackToken}`} className="hms-btn-solid">
              Track my order
            </Link>
            <button
              type="button"
              className="hms-btn-outline"
              onClick={() => {
                setDone(null);
                setStep("menu");
                setServiceType(null);
                setPaymentMode("SIMULATED");
                setDepotId(depots.length === 1 ? depots[0].id : "");
              }}
            >
              New order
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
