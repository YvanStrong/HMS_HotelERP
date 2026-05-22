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

type InventoryItemRow = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  currentStock?: number | string;
  sellingPrice?: number | string | null;
  imageUrl?: string | null;
  active?: boolean;
  unitCost?: number | string | null;
  stockType?: "STOCK" | "NON_STOCK";
};

type InventoryItemsPayload = { data?: InventoryItemRow[] };

type DepotProductRow = {
  id: string;
  depotId: string;
  productName: string;
  productCode: string;
  sellingPrice: number;
  stockQty?: number | string;
  photoUrl?: string | null;
  menuName: string;
  active: boolean;
  taxable?: boolean;
  inventoryItemId?: string | null;
  stockType?: "STOCK" | "NON_STOCK";
};

/** Unified row for the POS product grid (inventory-wide or single-outlet). */
type PosCatalogItem = {
  /** Inventory item id when linked; else depot-product id for outlet-only rows. */
  key: string;
  inventoryItemId: string | null;
  depotProductId: string | null;
  name: string;
  sku: string;
  category: string;
  currentStock: number | string | null | undefined;
  stockType: "STOCK" | "NON_STOCK";
  sellingPrice: number;
  imageUrl: string | null;
  onOutlet: boolean;
};

type CreateDepotProductApiResponse = {
  id: string;
  product: DepotProductRow;
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
const ALL_DEPOTS = "__ALL_DEPOTS__";
const UNCATEGORIZED = "Uncategorized";

function formatMoney(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function formatStock(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function categoryLabel(raw: string | undefined | null): string {
  const s = (raw ?? "").trim();
  return s || UNCATEGORIZED;
}

function menuTagFromCategory(cat: string): string {
  if (!cat || cat === UNCATEGORIZED) return "GENERAL";
  return cat.toUpperCase().replace(/\s+/g, "_");
}

export default function PosPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);
  const [depotProducts, setDepotProducts] = useState<DepotProductRow[]>([]);
  const [depotId, setDepotId] = useState(ALL_DEPOTS);
  const [orderType, setOrderType] = useState<OrderType>("Dine In");
  const [locationLabel, setLocationLabel] = useState("Outlet / table");
  const [customerLabel, setCustomerLabel] = useState("Walk-in Customer");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
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
      const [d, inv, dp] = await Promise.all([
        apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`),
        apiFetch<InventoryItemsPayload>(`/api/v1/hotels/${hotelId}/inventory/items`),
        apiFetch<DepotProductRow[]>(`/api/v1/hotels/${hotelId}/inventory/depot-products`),
      ]);
      const activeDepots = (d ?? []).filter((x) => x.active);
      setDepots(activeDepots);
      setInventoryItems((inv?.data ?? []).filter((x) => x.active !== false));
      setDepotProducts((dp ?? []).filter((x) => x.active));
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

  function depotProductForItem(itemId: string, targetDepotId: string): DepotProductRow | undefined {
    return depotProducts.find(
      (p) => p.inventoryItemId === itemId && p.depotId === targetDepotId && p.active,
    );
  }

  /** Default outlet for sales when “All” is selected (Principal depot if present, else first active outlet). */
  function defaultSaleDepotId(): string | null {
    if (depots.length === 0) return null;
    const principal = depots.find(
      (d) =>
        d.code.toUpperCase() === "PRINC" ||
        d.code.toUpperCase() === "PRINCIPAL" ||
        d.name.toLowerCase().includes("principal"),
    );
    return principal?.id ?? depots[0].id;
  }

  const catalogItems = useMemo((): PosCatalogItem[] => {
    if (depotId === ALL_DEPOTS) {
      const saleDepot = defaultSaleDepotId();
      return inventoryItems.map((inv) => {
        const linked = saleDepot ? depotProductForItem(inv.id, saleDepot) : undefined;
        return {
          key: inv.id,
          inventoryItemId: inv.id,
          depotProductId: linked?.id ?? null,
          name: inv.name,
          sku: inv.sku ?? "",
          category: categoryLabel(inv.category),
          currentStock: inv.currentStock,
          stockType: inv.stockType === "NON_STOCK" ? "NON_STOCK" : "STOCK",
          sellingPrice: Number(inv.sellingPrice ?? 0),
          imageUrl: inv.imageUrl?.trim() || null,
          onOutlet: Boolean(linked),
        };
      });
    }

    return depotProducts
      .filter((p) => p.depotId === depotId && p.active)
      .map((dp) => {
        const inv = dp.inventoryItemId
          ? inventoryItems.find((x) => x.id === dp.inventoryItemId)
          : undefined;
        return {
          key: inv?.id ?? dp.id,
          inventoryItemId: inv?.id ?? null,
          depotProductId: dp.id,
          name: inv?.name ?? dp.productName,
          sku: inv?.sku ?? dp.productCode,
          category: categoryLabel(inv?.category),
          currentStock: inv?.currentStock ?? dp.stockQty,
          stockType: dp.stockType === "NON_STOCK" || inv?.stockType === "NON_STOCK" ? "NON_STOCK" : "STOCK",
          sellingPrice: Number(dp.sellingPrice),
          imageUrl: (inv?.imageUrl?.trim() || dp.photoUrl?.trim() || null) as string | null,
          onOutlet: true,
        };
      });
  }, [depotId, inventoryItems, depotProducts, depots]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of catalogItems) {
      set.add(item.category);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [catalogItems]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (category !== "All" && item.category !== category) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [catalogItems, search, category]);

  const selectedOutlet = useMemo(
    () => (depotId === ALL_DEPOTS ? null : depots.find((d) => d.id === depotId) ?? null),
    [depotId, depots],
  );

  function resolveSaleDepotId(): string | null {
    if (depotId !== ALL_DEPOTS) return depotId;
    const cartProductIds = Object.keys(cart).filter((id) => (cart[id] ?? 0) > 0);
    if (cartProductIds.length > 0) {
      const first = depotProducts.find((p) => p.id === cartProductIds[0]);
      if (first) return first.depotId;
    }
    return defaultSaleDepotId();
  }

  const activeSaleDepot = useMemo(() => {
    const id = resolveSaleDepotId();
    if (!id) return null;
    return depots.find((d) => d.id === id) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cart + depotId drive sale outlet
  }, [depotId, depots, cart, depotProducts]);

  const cartRows = useMemo(() => {
    return Object.entries(cart)
      .map(([depotProductId, qty]) => {
        const dp = depotProducts.find((x) => x.id === depotProductId);
        if (!dp || qty <= 0) return null;
        const inv = dp.inventoryItemId
          ? inventoryItems.find((x) => x.id === dp.inventoryItemId)
          : undefined;
        const unit = Number(dp.sellingPrice);
        const dep = depots.find((d) => d.id === dp.depotId);
        return {
          productId: depotProductId,
          inventoryItemId: dp.inventoryItemId,
          name: inv?.name ?? dp.productName,
          code: dp.productCode,
          category: categoryLabel(inv?.category),
          stock: inv?.currentStock,
          unit,
          qty,
          lineTotal: unit * qty,
          taxable: dp.taxable,
          outletLabel: dep ? `${dep.name} (${dep.code})` : "",
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, depotProducts, inventoryItems, depots]);

  const totalPayable = useMemo(() => cartRows.reduce((s, r) => s + r.lineTotal, 0), [cartRows]);

  async function ensureDepotProduct(item: InventoryItemRow, targetDepotId: string): Promise<DepotProductRow> {
    const existing = depotProductForItem(item.id, targetDepotId);
    if (existing) return existing;

    const selling = Number(item.sellingPrice ?? 0);
    if (!Number.isFinite(selling) || selling < 0) {
      throw new Error(`Set a selling price on “${item.name}” in Inventory before selling at POS.`);
    }
    const cost = Number(item.unitCost ?? 0);
    const stockN = Number(item.currentStock ?? 0);
    const stockType = item.stockType === "NON_STOCK" ? "NON_STOCK" : "STOCK";
    const stockQty = stockType === "NON_STOCK" ? 0 : Number.isFinite(stockN) && stockN >= 0 ? stockN : 0;

    const res = await apiFetch<CreateDepotProductApiResponse>(
      `/api/v1/hotels/${hotelId}/inventory/depot-products`,
      {
        method: "POST",
        body: JSON.stringify({
          depotId: targetDepotId,
          productName: item.name,
          batchNo: null,
          expiryDate: null,
          costPrice: Number.isFinite(cost) && cost >= 0 ? cost : 0,
          sellingPrice: selling,
          stockQty,
          stockType,
          photoUrl: item.imageUrl?.trim() || null,
          menuName: menuTagFromCategory(categoryLabel(item.category)),
          inventoryItemId: item.id,
          taxable: true,
        }),
      },
    );
    const created = res.product;
    setDepotProducts((prev) => {
      const without = prev.filter((p) => p.id !== created.id);
      return [...without, created];
    });
    return created;
  }

  async function addLine(catalogKey: string) {
    const row = catalogItems.find((x) => x.key === catalogKey);
    if (!row) return;

    const saleDepot = resolveSaleDepotId();
    if (!saleDepot) {
      setError("No active outlet found. Create outlets under Menu first.");
      return;
    }

    const existingCartIds = Object.keys(cart).filter((id) => (cart[id] ?? 0) > 0);
    if (existingCartIds.length > 0) {
      const firstDp = depotProducts.find((p) => p.id === existingCartIds[0]);
      if (firstDp && firstDp.depotId !== saleDepot) {
        setError("One order can only use one outlet. Clear the cart to switch outlets.");
        return;
      }
    }

    setAddingItemId(catalogKey);
    setError(null);
    try {
      if (depotId !== ALL_DEPOTS && row.depotProductId) {
        setCart((prev) => ({ ...prev, [row.depotProductId!]: (prev[row.depotProductId!] ?? 0) + 1 }));
        setMsg(null);
        return;
      }

      const item = inventoryItems.find((x) => x.id === row.inventoryItemId);
      if (!item) {
        setError("Product not found in inventory.");
        return;
      }
      const dp = await ensureDepotProduct(item, saleDepot);
      setCart((prev) => ({ ...prev, [dp.id]: (prev[dp.id] ?? 0) + 1 }));
      setMsg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add item");
    } finally {
      setAddingItemId(null);
    }
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
    const saleDepotId = resolveSaleDepotId() ?? depotProducts.find((p) => p.id === cartRows[0].productId)?.depotId;
    if (!saleDepotId) {
      setError("Could not determine outlet for this sale.");
      return;
    }
    const mixed = cartRows.some((r) => depotProducts.find((p) => p.id === r.productId)?.depotId !== saleDepotId);
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">POS</h1>
          <p className="text-sm text-muted-foreground">
            Catalog from Inventory products — categories and stock match the products table.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="sr-only text-xs text-muted-foreground">Outlet</label>
          <select
            className="hms-input min-w-0 max-w-full flex-1 text-sm sm:min-w-[10rem] sm:max-w-[20rem] sm:flex-none"
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
      {depotId === ALL_DEPOTS && activeSaleDepot ? (
        <p className="text-xs text-muted-foreground">
          Selling via <strong className="text-foreground">{activeSaleDepot.name}</strong> ({activeSaleDepot.code})
          — all inventory products; same outlet for the whole order.
        </p>
      ) : selectedOutlet ? (
        <p className="text-xs text-muted-foreground">
          Showing products on <strong className="text-foreground">{selectedOutlet.name}</strong> ({selectedOutlet.code})
          only.
        </p>
      ) : null}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
          {msg}
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
        <section className="flex min-h-[min(380px,55dvh)] w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft lg:max-w-xl lg:basis-[40%] xl:max-w-none xl:basis-[40%]">
          <div className="border-b border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Running order</p>
            <div className="flex flex-wrap gap-1.5">
              {ORDER_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    orderType === t
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80 bg-background text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Location / table</label>
                <input
                  className="hms-input mt-0.5 w-full text-sm"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="e.g. Nanzige, Table 4"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Customer</label>
                <input
                  className="hms-input mt-0.5 w-full text-sm"
                  value={customerLabel}
                  onChange={(e) => setCustomerLabel(e.target.value)}
                  placeholder="Walk-in Customer"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-2 sm:p-3">
            {cartRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No items yet — add from the catalog.</p>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-2">Item</th>
                      <th className="pb-2 w-14">Stock</th>
                      <th className="pb-2 w-16">Price</th>
                      <th className="pb-2 w-28">Qty</th>
                      <th className="pb-2 w-16 text-right">Total</th>
                      <th className="pb-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {cartRows.map((r) => (
                      <tr key={r.productId} className="border-b border-border/40 align-middle">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{r.name}</div>
                          <div className="text-[10px] text-muted-foreground">{r.category}</div>
                          {depotId === ALL_DEPOTS && r.outletLabel ? (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">{r.outletLabel}</div>
                          ) : null}
                        </td>
                        <td className="py-2 tabular-nums text-muted-foreground">{formatStock(r.stock)}</td>
                        <td className="py-2 text-muted-foreground">{formatMoney(r.unit)}</td>
                        <td className="py-2">
                          <div className="inline-flex items-center overflow-hidden rounded-lg border border-border/80">
                            <button
                              type="button"
                              className="px-2 py-1 text-lg leading-none hover:bg-muted"
                              onClick={() => bumpQty(r.productId, -1)}
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <span className="min-w-[2rem] px-2 text-center tabular-nums">{r.qty}</span>
                            <button
                              type="button"
                              className="px-2 py-1 text-lg leading-none hover:bg-muted"
                              onClick={() => bumpQty(r.productId, 1)}
                              aria-label="Increase"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums">{formatMoney(r.lineTotal)}</td>
                        <td className="py-2">
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline"
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

          <div className="space-y-3 border-t border-border/60 bg-muted/10 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-muted-foreground">Total payable</span>
              <span className="text-xl font-bold tabular-nums text-primary">{formatMoney(totalPayable)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-[380px]:grid-cols-1 sm:grid-cols-4">
              <button
                type="button"
                className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                disabled={placing}
                onClick={clearCart}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                disabled={placing}
                onClick={saveDraft}
              >
                Draft
              </button>
              <button
                type="button"
                className="rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                disabled={placing || cartRows.length === 0}
                onClick={() => void submitSale(true)}
              >
                {placing ? "…" : "Quick invoice"}
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={placing || cartRows.length === 0}
                onClick={() => void submitSale(false)}
              >
                {placing ? "…" : "Place order"}
              </button>
            </div>
          </div>
        </section>

        <section className="flex min-h-[min(420px,60dvh)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="shrink-0 border-b border-border/60 p-2 sm:p-3">
            <input
              className="hms-input w-full min-w-0 text-sm"
              placeholder="Search name, SKU, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
            <nav
              className="scrollbar-thin flex shrink-0 gap-1.5 overflow-x-auto overflow-y-hidden border-b border-border/60 bg-muted/15 p-2 lg:w-44 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r"
              aria-label="Inventory categories"
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
              {catalogItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedOutlet
                    ? `No products on ${selectedOutlet.name}. Add them via Menu → Add to menu, or use All to sell from inventory.`
                    : "No active products in Inventory. Add products under Inventory → Products, then return here."}
                </p>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products match this filter.</p>
              ) : (
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredItems.map((item) => {
                    const stockN = Number(item.currentStock ?? 0);
                    const lowStock = item.stockType !== "NON_STOCK" && Number.isFinite(stockN) && stockN <= 0;
                    const busy = addingItemId === item.key;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={busy}
                        onClick={() => void addLine(item.key)}
                        className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-border/70 bg-background p-2 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md disabled:opacity-60 sm:p-3"
                      >
                        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-muted/40">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">
                              ◇
                            </span>
                          )}
                          {item.onOutlet && depotId === ALL_DEPOTS ? (
                            <span className="absolute right-1 top-1 rounded bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
                              On outlet
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 flex min-h-0 min-w-0 flex-1 flex-col gap-0.5">
                          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug">{item.name}</p>
                          {item.sku ? (
                            <p className="truncate text-[10px] text-muted-foreground">{item.sku}</p>
                          ) : null}
                          <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                          <p
                            className={`text-xs font-medium tabular-nums ${
                              lowStock ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {item.stockType === "NON_STOCK" ? "Non stock" : `Stock: ${formatStock(item.currentStock)}`}
                          </p>
                          <p className="mt-auto pt-1 text-sm font-bold tabular-nums text-primary">
                            {formatMoney(item.sellingPrice)}
                          </p>
                          {busy ? <p className="text-[10px] text-muted-foreground">Adding…</p> : null}
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
