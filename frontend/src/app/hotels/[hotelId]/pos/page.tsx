"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { printDepotSaleInvoice } from "@/lib/printDepotSaleInvoice";

type DepotRow = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  warehouseId?: string | null;
};
type DepotProductRow = {
  id: string;
  depotId: string;
  productName: string;
  productCode: string;
  sellingPrice: number;
  photoUrl?: string | null;
  menuName: string;
  active: boolean;
  taxable?: boolean;
};

type CreateSaleResponse = {
  saleId: string;
  saleNumber: string;
  depotId: string;
  totalAmount: number | string;
  soldAt: string;
  lines: {
    productName: string;
    productCode: string;
    quantity: number | string;
    unitPrice: number | string;
    lineTotal: number | string;
    taxable?: boolean;
  }[];
  message: string;
};

const ORDER_TYPES = ["Dine In", "Take Away", "Delivery", "Table"] as const;
type OrderType = (typeof ORDER_TYPES)[number];

const DRAFT_KEY = (hotelId: string) => `hms_pos_draft_${hotelId}`;

/** Outlet selector: show products from every active depot. Checkout still uses one depot (from cart). */
const ALL_DEPOTS = "__ALL_DEPOTS__";

/** Sidebar presets (after “All”). `menuKeys` are normalized depot `menuName` values (underscores OK). */
const POS_CATEGORY_PRESETS: { label: string; menuKeys: string[] }[] = [
  { label: "Beverages", menuKeys: ["BEVERAGES", "BEV", "DRINK", "DRINKS"] },
  { label: "Starters", menuKeys: ["STARTERS", "STARTER"] },
  { label: "Main Meals", menuKeys: ["MAIN_MEALS", "MAIN", "MAINS", "MAIN_MEAL"] },
  { label: "Fast Food", menuKeys: ["FAST_FOOD", "FASTFOOD", "SNACK", "SNACKS"] },
  { label: "BEV", menuKeys: ["BEV", "BEVERAGES", "DRINK", "DRINKS"] },
  { label: "BAR", menuKeys: ["BAR"] },
  { label: "VEG", menuKeys: ["VEG", "VEGETARIAN", "VEGGIE"] },
];

function menuNorm(raw: string | undefined): string {
  return (raw ?? "GENERAL").trim().toUpperCase().replace(/\s+/g, "_");
}

function displayMenuLabel(raw: string | undefined): string {
  const s = (raw ?? "GENERAL").trim() || "GENERAL";
  return s.replace(/_/g, " ");
}

function productMatchesPreset(p: DepotProductRow, presetLabel: string): boolean {
  const def = POS_CATEGORY_PRESETS.find((x) => x.label === presetLabel);
  if (!def) return false;
  const n = menuNorm(p.menuName);
  return def.menuKeys.includes(n);
}

function productMatchesCategory(p: DepotProductRow, cat: string): boolean {
  if (cat === "All") return true;
  if (POS_CATEGORY_PRESETS.some((x) => x.label === cat)) {
    return productMatchesPreset(p, cat);
  }
  const n = menuNorm(p.menuName);
  return n === menuNorm(cat) || displayMenuLabel(p.menuName) === cat;
}

function formatMoney(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

export default function PosPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [products, setProducts] = useState<DepotProductRow[]>([]);
  const [depotId, setDepotId] = useState(ALL_DEPOTS);
  const [orderType, setOrderType] = useState<OrderType>("Dine In");
  const [locationLabel, setLocationLabel] = useState("Outlet / table");
  const [customerLabel, setCustomerLabel] = useState("Walk-in Customer");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([
        apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`),
        apiFetch<DepotProductRow[]>(`/api/v1/hotels/${hotelId}/inventory/depot-products`),
      ]);
      const activeDepots = (d ?? []).filter((x) => x.active);
      setDepots(activeDepots);
      setProducts((p ?? []).filter((x) => x.active));
      setDepotId((prev) => {
        if (prev === ALL_DEPOTS) return ALL_DEPOTS;
        if (prev && activeDepots.some((x) => x.id === prev)) return prev;
        if (activeDepots.length === 1) return activeDepots[0].id;
        return ALL_DEPOTS;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load POS data");
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const depotProducts = useMemo(() => {
    if (depotId === ALL_DEPOTS) {
      const allowed = new Set(depots.map((d) => d.id));
      return products.filter((p) => allowed.has(p.depotId));
    }
    return products.filter((p) => p.depotId === depotId);
  }, [products, depotId, depots]);

  const categories = useMemo(() => {
    const presetLabels = POS_CATEGORY_PRESETS.map((x) => x.label);
    const coveredNorms = new Set<string>();
    for (const pr of POS_CATEGORY_PRESETS) {
      for (const k of pr.menuKeys) coveredNorms.add(k);
    }
    const extras: string[] = [];
    const seenExtraNorm = new Set<string>();
    for (const p of depotProducts) {
      const n = menuNorm(p.menuName);
      if (coveredNorms.has(n)) continue;
      if (seenExtraNorm.has(n)) continue;
      seenExtraNorm.add(n);
      extras.push(displayMenuLabel(p.menuName));
    }
    extras.sort((a, b) => a.localeCompare(b));
    return ["All", ...presetLabels, ...extras];
  }, [depotProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return depotProducts.filter((p) => {
      if (!productMatchesCategory(p, category)) return false;
      if (!q) return true;
      const catLabel = displayMenuLabel(p.menuName);
      return (
        p.productName.toLowerCase().includes(q) ||
        p.productCode.toLowerCase().includes(q) ||
        catLabel.toLowerCase().includes(q) ||
        menuNorm(p.menuName).toLowerCase().includes(q)
      );
    });
  }, [depotProducts, search, category]);

  const cartRows = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const p = depotProducts.find((x) => x.id === productId);
        if (!p || qty <= 0) return null;
        const unit = Number(p.sellingPrice);
        const lineTotal = unit * qty;
        const dep = depots.find((d) => d.id === p.depotId);
        return {
          productId,
          name: p.productName,
          code: p.productCode,
          unit,
          qty,
          lineTotal,
          taxable: p.taxable,
          outletLabel: dep ? `${dep.name} (${dep.code})` : "",
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, depotProducts, depots]);

  const totalPayable = useMemo(() => cartRows.reduce((s, r) => s + r.lineTotal, 0), [cartRows]);

  function addLine(productId: string) {
    const p = depotProducts.find((x) => x.id === productId);
    if (!p) return;
    const existingIds = Object.keys(cart).filter((id) => (cart[id] ?? 0) > 0);
    if (existingIds.length > 0 && depotId === ALL_DEPOTS) {
      const first = depotProducts.find((x) => x.id === existingIds[0]);
      if (first && first.depotId !== p.depotId) {
        setError("One order can only use one outlet. Clear the cart to add items from another outlet.");
        return;
      }
    }
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + 1 }));
    setMsg(null);
    setError(null);
  }

  function bumpQty(productId: string, delta: number) {
    setCart((prev) => {
      const cur = prev[productId] ?? 0;
      const next = cur + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  }

  function removeLine(productId: string) {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  }

  function clearCart() {
    setCart({});
    setMsg(null);
  }

  function saveDraft() {
    try {
      const payload = {
        cart,
        orderType,
        locationLabel,
        customerLabel,
        depotId,
        savedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(DRAFT_KEY(hotelId), JSON.stringify(payload));
      setMsg("Draft saved in this browser.");
      setError(null);
    } catch {
      setError("Could not save draft (storage blocked?).");
    }
  }

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY(hotelId));
      if (!raw) {
        setError("No draft found.");
        return;
      }
      const o = JSON.parse(raw) as {
        cart?: Record<string, number>;
        orderType?: OrderType;
        locationLabel?: string;
        customerLabel?: string;
        depotId?: string;
      };
      if (o.cart && typeof o.cart === "object") setCart(o.cart);
      if (o.orderType && ORDER_TYPES.includes(o.orderType)) setOrderType(o.orderType);
      if (typeof o.locationLabel === "string") setLocationLabel(o.locationLabel);
      if (typeof o.customerLabel === "string") setCustomerLabel(o.customerLabel);
      if (o.depotId === ALL_DEPOTS || (o.depotId && depots.some((d) => d.id === o.depotId))) {
        setDepotId(o.depotId!);
      }
      setMsg("Draft loaded.");
      setError(null);
    } catch {
      setError("Draft data was invalid.");
    }
  }

  function buildCustomerName(): string | null {
    const parts = [
      "POS",
      orderType.replace(/\s+/g, "_").toUpperCase(),
      locationLabel.trim() || "—",
      customerLabel.trim() || "Walk-in",
    ];
    const s = parts.join(" | ");
    return s.length > 160 ? s.slice(0, 157) + "…" : s;
  }

  async function submitSale(quickInvoice: boolean) {
    if (cartRows.length === 0) {
      setError("Add at least one item to the order.");
      return;
    }
    const saleDepotId =
      depotId === ALL_DEPOTS
        ? products.find((x) => x.id === cartRows[0].productId)?.depotId
        : depotId;
    if (!saleDepotId) {
      setError("Could not determine outlet for this sale.");
      return;
    }
    const mixed = cartRows.some((r) => products.find((x) => x.id === r.productId)?.depotId !== saleDepotId);
    if (mixed) {
      setError("All items must be from the same outlet.");
      return;
    }
    setPlacing(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<CreateSaleResponse>(`/api/v1/hotels/${hotelId}/inventory/sales`, {
        method: "POST",
        body: JSON.stringify({
          customerName: buildCustomerName(),
          depotId: saleDepotId,
          lines: cartRows.map((r) => ({ productId: r.productId, quantity: r.qty })),
        }),
      });
      const depotName = depots.find((d) => d.id === saleDepotId)?.name ?? "Outlet";
      try {
        printDepotSaleInvoice(
          {
            saleId: String(res.saleId),
            saleNumber: res.saleNumber,
            depotName,
            customerName: buildCustomerName(),
            totalAmount: Number(res.totalAmount),
            soldAt: res.soldAt,
            lines: (res.lines ?? []).map((ln) => ({
              productName: ln.productName,
              productCode: ln.productCode,
              quantity: Number(ln.quantity),
              unitPrice: Number(ln.unitPrice),
              lineTotal: Number(ln.lineTotal),
              taxable: ln.taxable !== false,
            })),
            vatPercent: 18,
          },
          "FRW",
        );
      } catch {
        if (!quickInvoice) {
          setError("Sale recorded; allow pop-ups to print the receipt.");
        }
      }
      clearCart();
      sessionStorage.removeItem(DRAFT_KEY(hotelId));
      setMsg(quickInvoice ? "Invoice printed." : "Order placed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-muted-foreground">
        Loading POS…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] max-w-full min-w-0 flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">POS</h1>
          <p className="text-sm text-muted-foreground">Running order and catalog — same depot sales as Menu.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <label className="text-xs text-muted-foreground sr-only">Outlet</label>
          <select
            className="hms-input min-w-0 max-w-full flex-1 text-sm sm:max-w-[20rem] sm:flex-none sm:min-w-[10rem]"
            value={depotId}
            onChange={(e) => {
              setDepotId(e.target.value);
              setCategory("All");
              clearCart();
            }}
          >
            <option value={ALL_DEPOTS}>All</option>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" className="hms-btn-outline text-sm" onClick={loadDraft}>
            Load draft
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">{msg}</div>
      )}

      <div className="flex flex-col gap-4 flex-1 min-h-0 min-w-0 lg:flex-row">
        {/* Left — running order */}
        <section className="flex min-h-[min(380px,55dvh)] w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft lg:max-w-xl lg:basis-[40%] xl:max-w-none xl:basis-[40%]">
          <div className="p-3 border-b border-border/60 bg-muted/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Running order</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border ${
                    orderType === t
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Location / table</label>
                <input
                  className="hms-input w-full text-sm mt-0.5"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="e.g. Nanzige, Table 4"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Customer</label>
                <input
                  className="hms-input w-full text-sm mt-0.5"
                  value={customerLabel}
                  onChange={(e) => setCustomerLabel(e.target.value)}
                  placeholder="Walk-in Customer"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2 sm:p-3">
            {cartRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No items yet — add from the catalog.</p>
            ) : (
              <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/60">
                    <th className="pb-2 pr-2">Item</th>
                    <th className="pb-2 w-16">Price</th>
                    <th className="pb-2 w-28">Qty</th>
                    <th className="pb-2 w-14">Disc.</th>
                    <th className="pb-2 w-16 text-right">Total</th>
                    <th className="pb-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {cartRows.map((r) => (
                    <tr key={r.productId} className="border-b border-border/40 align-middle">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.name}</div>
                        {depotId === ALL_DEPOTS && r.outletLabel ? (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{r.outletLabel}</div>
                        ) : null}
                      </td>
                      <td className="py-2 text-muted-foreground">{formatMoney(r.unit)}</td>
                      <td className="py-2">
                        <div className="inline-flex items-center rounded-lg border border-border/80 overflow-hidden">
                          <button
                            type="button"
                            className="px-2 py-1 hover:bg-muted text-lg leading-none"
                            onClick={() => bumpQty(r.productId, -1)}
                            aria-label="Decrease"
                          >
                            −
                          </button>
                          <span className="px-2 min-w-[2rem] text-center tabular-nums">{r.qty}</span>
                          <button
                            type="button"
                            className="px-2 py-1 hover:bg-muted text-lg leading-none"
                            onClick={() => bumpQty(r.productId, 1)}
                            aria-label="Increase"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2">
                        <span className="text-xs text-muted-foreground" title="Line discounts are not stored yet">
                          —
                        </span>
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">{formatMoney(r.lineTotal)}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="text-destructive hover:underline text-xs"
                          onClick={() => removeLine(r.productId)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/60 bg-muted/10 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-sm font-medium text-muted-foreground">Total payable</span>
              <span className="text-xl font-bold text-primary tabular-nums">{formatMoney(totalPayable)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-[380px]:grid-cols-1 sm:grid-cols-4">
              <button
                type="button"
                className="rounded-xl py-2.5 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={placing}
                onClick={clearCart}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl py-2.5 text-sm font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                disabled={placing}
                onClick={saveDraft}
              >
                Draft
              </button>
              <button
                type="button"
                className="rounded-xl py-2.5 text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                disabled={placing || cartRows.length === 0}
                onClick={() => void submitSale(true)}
              >
                {placing ? "…" : "Quick invoice"}
              </button>
              <button
                type="button"
                className="rounded-xl py-2.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={placing || cartRows.length === 0}
                onClick={() => void submitSale(false)}
              >
                {placing ? "…" : "Place order"}
              </button>
            </div>
          </div>
        </section>

        {/* Right — catalog */}
        <section className="flex min-h-[min(420px,60dvh)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="shrink-0 border-b border-border/60 p-2 sm:p-3">
            <input
              className="hms-input w-full min-w-0 text-sm"
              placeholder="Search name, code, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
            <nav
              className="scrollbar-thin flex shrink-0 gap-1.5 overflow-x-auto overflow-y-hidden border-b border-border/60 bg-muted/15 p-2 lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r"
              aria-label="Product categories"
            >
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm transition-colors lg:w-full lg:whitespace-normal lg:text-left ${
                    category === c
                      ? "bg-primary font-semibold text-primary-foreground shadow-sm"
                      : "whitespace-nowrap bg-background/80 hover:bg-accent lg:whitespace-normal"
                  }`}
                >
                  {c}
                </button>
              ))}
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-2 sm:p-3">
              {depots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active outlets. Create depots under Menu → default outlets, then return here.
                </p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No products match this filter{depotId === ALL_DEPOTS ? " across outlets" : " for this outlet"}.
                </p>
              ) : (
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredProducts.map((p) => {
                    const outletName = depots.find((d) => d.id === p.depotId)?.name ?? "Outlet";
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addLine(p.id)}
                        className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-border/70 bg-background p-2 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md sm:p-3"
                      >
                        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted/40">
                          {p.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                              ◇
                            </span>
                          )}
                        </div>
                        {depotId === ALL_DEPOTS ? (
                          <p className="mt-2 max-w-full truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {outletName}
                          </p>
                        ) : null}
                        <div className="mt-1 flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug">{p.productName}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {(p.menuName || "").replace(/_/g, " ")}
                          </p>
                          <p className="mt-auto pt-1 text-sm font-bold tabular-nums text-primary">
                            {formatMoney(Number(p.sellingPrice))}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
