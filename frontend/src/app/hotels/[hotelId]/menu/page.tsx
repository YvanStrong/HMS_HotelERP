"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { printDepotSaleInvoice } from "@/lib/printDepotSaleInvoice";
import { staffAppPath } from "@/lib/staffAppRoutes";

type DepotRow = {
  id: string;
  name: string;
  code: string;
  depotType: string;
  active: boolean;
  warehouseId?: string | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
};
type WarehouseRow = { id: string; name: string; code: string; isDefault: boolean; active: boolean };
type DepotProductRow = {
  id: string;
  depotId: string;
  depotName: string;
  productNumber: number;
  productName: string;
  productCode: string;
  batchNo: string;
  expiryDate?: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  stockType: "STOCK" | "NON_STOCK";
  photoUrl?: string | null;
  menuName: string;
  /** When false, receipt treats line as 0% VAT (selling price has no VAT split). */
  taxable?: boolean;
  active: boolean;
  /** ERP inventory item when this sellable row is linked to stock. */
  inventoryItemId?: string | null;
};

type ErpInventoryRow = {
  id: string;
  name: string;
  sku?: string;
  currentStock?: number | string;
  unitCost?: number | string | null;
  sellingPrice?: number | string | null;
  imageUrl?: string | null;
  active?: boolean;
  stockType?: "STOCK" | "NON_STOCK";
};

type InventoryItemsPayload = { data?: ErpInventoryRow[] };
type CreateDepotProductApiResponse = {
  id: string;
  autoProductNumber: number;
  autoProductCode: string;
  message: string;
  product: DepotProductRow;
};
type SaleRow = { saleId: string; saleNumber: string; depotName: string; customerName?: string | null; totalAmount: number; soldAt: string };

type SaleDetailResponse = {
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName?: string | null;
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

/** Staff guest search (JSON uses snake_case from backend). */
type GuestSearchHit = {
  guest: { id: string; full_name?: string; email?: string; phone?: string };
};

function clientLabelFromGuestHit(hit: GuestSearchHit): string {
  const name = (hit.guest?.full_name ?? "").trim();
  if (name.length > 0) return name;
  const mail = (hit.guest?.email ?? "").trim();
  if (mail.length > 0) return mail;
  return "Guest";
}

function depotIdForWarehouse(wh: WarehouseRow, depotsList: DepotRow[]): string {
  const linked = depotsList.find((d) => d.warehouseId === wh.id);
  if (linked) return linked.id;
  const byCode = depotsList.find((d) => d.code.toUpperCase() === wh.code.toUpperCase());
  if (byCode) return byCode.id;
  if (wh.code.toUpperCase() === "PRINCIPAL") {
    const pr = depotsList.find((d) => d.code.toUpperCase() === "PRINC");
    if (pr) return pr.id;
  }
  return "";
}

export default function MenuPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [error, setError] = useState<string | null>(null);
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [products, setProducts] = useState<DepotProductRow[]>([]);
  const [erpInventoryItems, setErpInventoryItems] = useState<ErpInventoryRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishingItemId, setPublishingItemId] = useState<string | null>(null);

  const [selectedDepotId, setSelectedDepotId] = useState("");
  const [selectedMenu, setSelectedMenu] = useState("");
  const [selectedStockType, setSelectedStockType] = useState<"" | "STOCK" | "NON_STOCK">("");
  const [customerName, setCustomerName] = useState("");
  const [qtyByProduct, setQtyByProduct] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<Record<string, number>>({});
  const [reprintingSaleId, setReprintingSaleId] = useState<string | null>(null);
  const [guestHits, setGuestHits] = useState<GuestSearchHit[]>([]);
  const [guestPickerOpen, setGuestPickerOpen] = useState(false);

  const [setupMsg, setSetupMsg] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [addSellBusy, setAddSellBusy] = useState(false);
  const [sellDepotId, setSellDepotId] = useState("");
  const [sellName, setSellName] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [sellCost, setSellCost] = useState("0");
  const [sellStockType, setSellStockType] = useState<"STOCK" | "NON_STOCK">("NON_STOCK");
  const [sellStockQty, setSellStockQty] = useState("999");
  const [sellMenuName, setSellMenuName] = useState("GENERAL");
  const [sellPhotoUrl, setSellPhotoUrl] = useState("");
  const [sellLinkItemId, setSellLinkItemId] = useState("");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [d, wh, p, s, inv] = await Promise.all([
        apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`),
        apiFetch<WarehouseRow[]>(`/api/v1/hotels/${hotelId}/inventory/warehouses`),
        apiFetch<DepotProductRow[]>(`/api/v1/hotels/${hotelId}/inventory/depot-products`),
        apiFetch<SaleRow[]>(`/api/v1/hotels/${hotelId}/inventory/sales`),
        apiFetch<InventoryItemsPayload>(`/api/v1/hotels/${hotelId}/inventory/items`),
      ]);
      setDepots(d);
      setWarehouses(wh ?? []);
      setProducts(p);
      setSales(s);
      setErpInventoryItems(inv?.data ?? []);
      if (!selectedDepotId && d.length > 0) {
        const preferredWh = (wh ?? []).find((w) => w.isDefault) ?? (wh ?? [])[0];
        const fallbackDepot = d[0].id;
        const resolved = preferredWh ? depotIdForWarehouse(preferredWh, d) : "";
        setSelectedDepotId(resolved || fallbackDepot);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    void loadAll();
  }, [hotelId]);

  const outletSelectOptions = useMemo(() => {
    const activeWh = (warehouses ?? []).filter((w) => w.active);
    const fromWh = activeWh
      .map((w) => {
        const depotId = depotIdForWarehouse(w, depots);
        if (!depotId) return null;
        const dep = depots.find((x) => x.id === depotId);
        return {
          depotId,
          label: `${w.name} (${w.code})`,
          sortKey: w.isDefault ? 0 : 1,
          depName: dep?.name,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
    fromWh.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
      return a.label.localeCompare(b.label);
    });
    const seen = new Set(fromWh.map((x) => x.depotId));
    const extra = depots
      .filter((d) => d.active && !seen.has(d.id))
      .map((d) => ({
        depotId: d.id,
        label: `${d.name} (outlet · ${d.code})`,
        sortKey: 2,
        depName: undefined as string | undefined,
      }));
    return [...fromWh, ...extra];
  }, [warehouses, depots]);

  useEffect(() => {
    if (outletSelectOptions.length > 0 && !sellDepotId) {
      setSellDepotId(outletSelectOptions[0].depotId);
    }
  }, [outletSelectOptions, sellDepotId]);

  async function bootstrapDepots() {
    setBootstrapping(true);
    setError(null);
    setSetupMsg(null);
    try {
      await apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots/bootstrap`, { method: "POST" });
      await loadAll();
      setSetupMsg("Default outlets created where missing. Add sellable products below, then check the public kiosk.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bootstrap failed");
    } finally {
      setBootstrapping(false);
    }
  }

  async function addSellableProduct(e: FormEvent) {
    e.preventDefault();
    if (!sellDepotId || !sellName.trim()) {
      setError("Choose an outlet and enter a product name.");
      return;
    }
    const price = Number(sellPrice);
    if (!Number.isFinite(price) || price < 0) {
      setError("Enter a valid selling price.");
      return;
    }
    setAddSellBusy(true);
    setError(null);
    setSetupMsg(null);
    try {
      const link = sellLinkItemId.trim();
      const uuidOk = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(link);
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/depot-products`, {
        method: "POST",
        body: JSON.stringify({
          depotId: sellDepotId,
          productName: sellName.trim(),
          batchNo: null,
          expiryDate: null,
          costPrice: Number(sellCost) || 0,
          sellingPrice: price,
          stockQty: sellStockType === "NON_STOCK" ? 0 : Number(sellStockQty) || 0,
          stockType: sellStockType,
          photoUrl: sellPhotoUrl.trim() || null,
          menuName: sellMenuName.trim() || "GENERAL",
          inventoryItemId: uuidOk ? link : null,
          taxable: true,
        }),
      });
      setSetupMsg(`“${sellName.trim()}” added to the sellable list (self-order + this page).`);
      setSellName("");
      setSellPrice("");
      setSellPhotoUrl("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add product");
    } finally {
      setAddSellBusy(false);
    }
  }

  useEffect(() => {
    const q = customerName.trim();
    if (q.length < 1) {
      setGuestHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await apiFetch<GuestSearchHit[]>(
            `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(q)}`,
            { quiet: true },
          );
          setGuestHits(Array.isArray(hits) ? hits : []);
        } catch {
          setGuestHits([]);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [customerName, hotelId]);

  const menusForDepot = useMemo(() => {
    const set = new Set(
      products
        .filter((p) => !selectedDepotId || p.depotId === selectedDepotId)
        .map((p) => p.menuName),
    );
    return Array.from(set).sort();
  }, [products, selectedDepotId]);

  const productsForDepot = useMemo(
    () =>
      products.filter(
        (p) =>
          (!selectedDepotId || p.depotId === selectedDepotId) &&
          (!selectedMenu || p.menuName === selectedMenu) &&
          (!selectedStockType || p.stockType === selectedStockType),
      ),
    [products, selectedDepotId, selectedMenu, selectedStockType],
  );

  /** ERP inventory rows not yet published as a depot product on the selected outlet. */
  const unpublishedErpForDepot = useMemo(() => {
    if (!selectedDepotId) return [];
    return erpInventoryItems.filter((item) => {
      if (item.active === false) return false;
      const linkedHere = products.some(
        (p) => p.depotId === selectedDepotId && p.inventoryItemId === item.id,
      );
      return !linkedHere;
    });
  }, [erpInventoryItems, products, selectedDepotId]);

  async function publishErpItemToMenu(item: ErpInventoryRow) {
    if (!selectedDepotId) {
      setError("Select an outlet first.");
      return;
    }
    const selling = Number(item.sellingPrice ?? 0);
    if (!Number.isFinite(selling) || selling < 0) {
      setError(`Set a selling price on “${item.name}” in Inventory before adding it to the menu.`);
      return;
    }
    setPublishingItemId(item.id);
    setError(null);
    setSetupMsg(null);
    try {
      const cost = Number(item.unitCost ?? 0);
      const stockN = Number(item.currentStock ?? 0);
      const stockType = item.stockType === "NON_STOCK" ? "NON_STOCK" : "STOCK";
      const stockQty = stockType === "NON_STOCK" ? 0 : Number.isFinite(stockN) && stockN >= 0 ? stockN : 0;
      const menuTag = (selectedMenu || "GENERAL").trim() || "GENERAL";
      await apiFetch<CreateDepotProductApiResponse>(`/api/v1/hotels/${hotelId}/inventory/depot-products`, {
        method: "POST",
        body: JSON.stringify({
          depotId: selectedDepotId,
          productName: item.name,
          batchNo: null,
          expiryDate: null,
          costPrice: Number.isFinite(cost) && cost >= 0 ? cost : 0,
          sellingPrice: selling,
          stockQty,
          stockType,
          photoUrl: item.imageUrl?.trim() || null,
          menuName: menuTag,
          inventoryItemId: item.id,
          taxable: true,
        }),
      });
      setSetupMsg(`“${item.name}” is now on this outlet and guest self-order.`);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add to menu");
    } finally {
      setPublishingItemId(null);
    }
  }

  const cartRows = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, qty]) => {
        const p = products.find((x) => x.id === productId);
        if (!p || qty <= 0) return null;
        return {
          productId,
          productName: p.productName,
          productCode: p.productCode,
          qty,
          unitPrice: Number(p.sellingPrice),
          lineTotal: Number(p.sellingPrice) * qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, products]);

  const cartTotal = useMemo(() => cartRows.reduce((sum, r) => sum + r.lineTotal, 0), [cartRows]);

  function addToCart(productId: string) {
    const qty = Number(qtyByProduct[productId] || "1");
    if (!Number.isFinite(qty) || qty <= 0) return;
    setCart((prev) => ({ ...prev, [productId]: (prev[productId] ?? 0) + qty }));
  }

  function setCartQty(productId: string, qty: number) {
    setCart((prev) => {
      if (!Number.isFinite(qty) || qty <= 0) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: Number(qty.toFixed(3)) };
    });
  }

  function changeCartQty(productId: string, delta: number) {
    setCartQty(productId, (cart[productId] ?? 0) + delta);
  }

  function bumpPreCartQty(productId: string, delta: number) {
    setQtyByProduct((prev) => {
      const cur = Number(prev[productId] ?? "1");
      const next = Math.max(1, Math.floor(cur) + delta);
      return { ...prev, [productId]: String(next) };
    });
  }

  async function sellNow() {
    if (cartRows.length === 0) {
      setError("Add at least one product to the cart.");
      return;
    }
    if (!selectedDepotId) {
      setError("Select a depot menu before selling.");
      return;
    }
    const mismatched = cartRows.filter((r) => {
      const p = products.find((x) => x.id === r.productId);
      return p && p.depotId !== selectedDepotId;
    });
    if (mismatched.length > 0) {
      setError("Every item in the cart must belong to the selected depot. Change depot or clear the cart and add products again.");
      return;
    }
    setError(null);
    const clientLabel = customerName.trim() || null;
    try {
      const res = await apiFetch<CreateSaleResponse>(`/api/v1/hotels/${hotelId}/inventory/sales`, {
        method: "POST",
        body: JSON.stringify({
          customerName: clientLabel,
          depotId: selectedDepotId,
          lines: cartRows.map((r) => ({ productId: r.productId, quantity: r.qty })),
        }),
      });
      const depotName = depots.find((d) => d.id === selectedDepotId)?.name ?? "Depot";
      try {
        printDepotSaleInvoice(
          {
            saleId: String(res.saleId),
            saleNumber: res.saleNumber,
            depotName,
            customerName: clientLabel,
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
        setError("Sale completed, but the receipt window could not open. Try disabling strict pop-up / print blocking.");
      }
      setCart({});
      setQtyByProduct({});
      setCustomerName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to sell products");
    }
  }

  async function reprintSale(saleId: string) {
    setError(null);
    setReprintingSaleId(saleId);
    try {
      const q = new URLSearchParams({ saleId });
      const detail = await apiFetch<SaleDetailResponse>(
        `/api/v1/hotels/${hotelId}/inventory/sales/detail?${q.toString()}`,
      );
      const clientLabel = detail.customerName?.trim() || null;
      try {
        printDepotSaleInvoice(
          {
            saleId: String(detail.saleId),
            saleNumber: detail.saleNumber,
            depotName: detail.depotName,
            customerName: clientLabel,
            totalAmount: Number(detail.totalAmount),
            soldAt: detail.soldAt,
            lines: (detail.lines ?? []).map((ln) => ({
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
        setError("Receipt window could not open. Try disabling pop-up / print blocking for this site.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sale for reprint");
    } finally {
      setReprintingSaleId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
          <p className="text-muted-foreground text-sm">
            Depots and <strong>depot products</strong> are what guests see on{" "}
            <Link href={`/book/order/${hotelId}`} className="underline font-medium text-foreground" target="_blank" rel="noreferrer">
              self-order
            </Link>{" "}
            and what you sell here. Products you create under{" "}
            <Link href={staffAppPath("inventory")} className="underline">
              Inventory
            </Link>{" "}
            appear below until you add them to the selected outlet; use <strong>Add to menu</strong> to publish (linked
            stock and selling price).
          </p>
        </div>
        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void loadAll()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {setupMsg && <p className="text-sm text-emerald-700 dark:text-emerald-300 px-1">{setupMsg}</p>}

      <section className="hms-section-card space-y-3">
        <h2 className="hms-section-title">Self-order &amp; kiosk catalogue</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          If the public kiosk is empty, create at least one <strong>outlet</strong> (depot), then <strong>sellable products</strong>{" "}
          here. Use menu name <code className="bg-muted px-1 rounded">GENERAL</code> for dine-in and take-away, or tag with{" "}
          <code className="bg-muted px-1 rounded">DINE_IN</code> / <code className="bg-muted px-1 rounded">TAKE_AWAY</code>{" "}
          in the name to filter by mode.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            className="hms-btn-outline hms-btn-sm"
            disabled={bootstrapping || loading}
            onClick={() => void bootstrapDepots()}
          >
            {bootstrapping ? "Creating…" : "Create default outlets"}
          </button>
          {depots.length === 0 ? (
            <span className="text-xs text-muted-foreground">No depots yet — bootstrap first.</span>
          ) : (
            <span className="text-xs text-muted-foreground">{depots.length} outlet(s) loaded.</span>
          )}
        </div>
        <form onSubmit={(e) => void addSellableProduct(e)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 border-t border-border/60 pt-3">
          <div>
            <label className="text-xs font-medium block mb-1">Store / outlet (linked warehouse)</label>
            <select
              value={sellDepotId}
              onChange={(e) => setSellDepotId(e.target.value)}
              className="w-full text-sm"
              required
            >
              {outletSelectOptions.length === 0 ? <option value="">Bootstrap outlets first</option> : null}
              {outletSelectOptions.map((o) => (
                <option key={o.depotId} value={o.depotId}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Product name (e.g. Burger)</label>
            <input value={sellName} onChange={(e) => setSellName(e.target.value)} className="w-full text-sm" required placeholder="Burger" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Selling price</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className="w-full text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Cost (optional)</label>
            <input type="number" min={0} step="0.01" value={sellCost} onChange={(e) => setSellCost(e.target.value)} className="w-full text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Stock type</label>
            <select value={sellStockType} onChange={(e) => setSellStockType(e.target.value as "STOCK" | "NON_STOCK")} className="w-full text-sm">
              <option value="NON_STOCK">NON_STOCK (kitchen / unlimited)</option>
              <option value="STOCK">STOCK (quantity tracked)</option>
            </select>
          </div>
          {sellStockType === "STOCK" ? (
            <div>
              <label className="text-xs font-medium block mb-1">Stock quantity</label>
              <input type="number" min={0} step="1" value={sellStockQty} onChange={(e) => setSellStockQty(e.target.value)} className="w-full text-sm" />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-medium block mb-1">Menu name (kiosk filter)</label>
            <input
              value={sellMenuName}
              onChange={(e) => setSellMenuName(e.target.value)}
              className="w-full text-sm font-mono"
              placeholder="GENERAL"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium block mb-1">Photo URL (optional — shown on guest kiosk)</label>
            <input
              value={sellPhotoUrl}
              onChange={(e) => setSellPhotoUrl(e.target.value)}
              className="w-full text-sm"
              placeholder="https://… (public image link)"
              inputMode="url"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="text-xs font-medium block mb-1">Link inventory item ID (optional)</label>
            <input
              value={sellLinkItemId}
              onChange={(e) => setSellLinkItemId(e.target.value)}
              className="w-full text-sm font-mono text-xs"
              placeholder="UUID from Inventory → Items"
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button type="submit" className="hms-btn-solid hms-btn-sm" disabled={addSellBusy || outletSelectOptions.length === 0}>
              {addSellBusy ? "Adding…" : "Add sellable item"}
            </button>
          </div>
        </form>
      </section>

      <section className="hms-section-card space-y-4 overflow-visible">
        <div className="grid gap-3 md:grid-cols-5">
          <select value={selectedDepotId} onChange={(e) => setSelectedDepotId(e.target.value)}>
            <option value="">Select store / outlet</option>
            {outletSelectOptions.map((o) => (
              <option key={o.depotId} value={o.depotId}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={selectedMenu} onChange={(e) => setSelectedMenu(e.target.value)}>
            <option value="">All menus</option>
            {menusForDepot.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select value={selectedStockType} onChange={(e) => setSelectedStockType(e.target.value as "" | "STOCK" | "NON_STOCK")}>
            <option value="">All stock categories</option>
            <option value="STOCK">STOCK</option>
            <option value="NON_STOCK">NON STOCK</option>
          </select>
          <div className="relative z-20 min-w-0">
            <input
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value);
                setGuestPickerOpen(true);
              }}
              onFocus={() => setGuestPickerOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setGuestPickerOpen(false), 180);
              }}
              placeholder="Guest / client name (search or type)"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={guestPickerOpen && guestHits.length > 0}
              className="w-full"
            />
            {guestPickerOpen && guestHits.length > 0 && (
              <ul
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-md"
                role="listbox"
              >
                {guestHits.map((hit) => {
                  const label = clientLabelFromGuestHit(hit);
                  const sub = [hit.guest?.email, hit.guest?.phone].filter(Boolean).join(" · ");
                  return (
                    <li key={hit.guest.id} role="option">
                      <button
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted/80"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCustomerName(label);
                          setGuestHits([]);
                          setGuestPickerOpen(false);
                        }}
                      >
                        <span className="font-medium text-foreground">{label}</span>
                        {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="hms-btn-solid"
            onClick={() => void sellNow()}
            disabled={cartRows.length === 0 || !selectedDepotId}
            title={
              cartRows.length === 0
                ? "Add products to the cart"
                : !selectedDepotId
                  ? "Choose a depot menu first"
                  : undefined
            }
          >
            Sell now ({cartRows.length})
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          After a successful sale, a printable receipt opens automatically (use Print → Save as PDF for a PDF file).
        </p>
        <p className="text-xs text-muted-foreground">
          Prepared items that show &quot;Stock 0&quot; must be set to <strong>NON STOCK</strong> on Inventory → Products so sales are not blocked.
        </p>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {productsForDepot.map((p) => (
            <div key={p.id} className="flex items-start gap-1.5 rounded-lg border border-border/70 bg-card p-1.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted/30">
                {p.photoUrl ? (
                  <img src={p.photoUrl} alt={p.productName} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">No photo</span>
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold leading-tight">{p.productName}</p>
                  <p className="shrink-0 text-xs font-semibold tabular-nums">{Number(p.sellingPrice).toFixed(2)}</p>
                </div>
                <p className="line-clamp-1 text-[10px] leading-tight text-muted-foreground">
                  {p.productCode} · #{p.productNumber}
                  {p.stockType === "NON_STOCK" ? " · Non stock" : ` · Stock ${Number(p.stockQty).toFixed(3)}`}
                </p>
                <div className="flex flex-nowrap items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm px-2 py-0 text-xs"
                    onClick={() => bumpPreCartQty(p.id, -1)}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="h-7 w-11 min-w-0 px-1 text-xs"
                    value={qtyByProduct[p.id] ?? "1"}
                    onChange={(e) => setQtyByProduct((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm px-2 py-0 text-xs"
                    onClick={() => bumpPreCartQty(p.id, 1)}
                  >
                    +
                  </button>
                  <button type="button" className="hms-btn-outline hms-btn-sm shrink-0 px-2 py-0 text-xs" onClick={() => addToCart(p.id)}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
          {unpublishedErpForDepot.length > 0 ? (
            <>
              <p className="text-muted-foreground text-xs sm:col-span-2 lg:col-span-3 xl:col-span-4 pt-2 border-t border-border/60">
                <span className="font-semibold text-foreground">From Inventory</span> — not on this outlet yet. Add to
                menu to show here and on self-order (uses selling price and current stock).
              </p>
              {unpublishedErpForDepot.map((item) => {
                const sp = Number(item.sellingPrice ?? 0);
                const priceLabel = Number.isFinite(sp) ? sp.toFixed(2) : "—";
                const st = item.currentStock != null ? Number(item.currentStock) : NaN;
                const stockLabel = Number.isFinite(st) ? st.toFixed(3) : "—";
                return (
                  <div
                    key={`erp-${item.id}`}
                    className="flex items-start gap-1.5 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-1.5"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted/30">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted-foreground">
                          No photo
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold leading-tight">{item.name}</p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums">{priceLabel}</p>
                      </div>
                      <p className="line-clamp-1 text-[10px] leading-tight text-muted-foreground">
                        {item.sku ?? "SKU —"} · Stock {stockLabel}
                        <span className="ml-1 rounded bg-muted px-1 font-mono text-[9px]">ERP</span>
                      </p>
                      <div className="pt-0.5">
                        <button
                          type="button"
                          className="hms-btn-solid hms-btn-sm px-2 py-0 text-xs"
                          disabled={publishingItemId === item.id}
                          onClick={() => void publishErpItemToMenu(item)}
                        >
                          {publishingItemId === item.id ? "Adding…" : "Add to menu"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
          {productsForDepot.length === 0 && unpublishedErpForDepot.length === 0 && (
            <p className="text-muted-foreground text-sm sm:col-span-2 lg:col-span-3 xl:col-span-4">
              No products for selected depot/menu. Create items in Inventory or add sellable items above.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <h3 className="font-semibold mb-2">Sale Cart</h3>
          <div className="hms-table-wrap bg-card">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cartRows.map((r) => (
                  <tr key={r.productId}>
                    <td>{r.productName}</td>
                    <td>{r.productCode}</td>
                    <td className="min-w-[170px]">
                      <div className="flex items-center gap-2">
                        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => changeCartQty(r.productId, -1)}>
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={String(cart[r.productId] ?? r.qty)}
                          onChange={(e) => setCartQty(r.productId, Number(e.target.value))}
                          className="w-20"
                        />
                        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => changeCartQty(r.productId, 1)}>
                          +
                        </button>
                      </div>
                    </td>
                    <td>{r.unitPrice.toFixed(2)}</td>
                    <td>{r.lineTotal.toFixed(2)}</td>
                    <td>
                      <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setCartQty(r.productId, 0)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {cartRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground">
                      Cart is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm font-semibold">Total: {cartTotal.toFixed(2)}</p>
        </div>
      </section>

      <section className="hms-section-card">
        <h2 className="hms-section-title mb-3">Recent Sales</h2>
        <div className="hms-table-wrap">
          <table className="hms-table">
            <thead>
              <tr>
                <th>Sale #</th>
                <th>Depot</th>
                <th>Client</th>
                <th>Total</th>
                <th>Sold At</th>
                <th className="w-[1%] whitespace-nowrap text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.saleId}>
                  <td>{s.saleNumber}</td>
                  <td>{s.depotName}</td>
                  <td>{s.customerName || "Walk-in"}</td>
                  <td>{Number(s.totalAmount).toFixed(2)}</td>
                  <td>{new Date(s.soldAt).toLocaleString()}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="hms-btn-outline hms-btn-sm"
                      disabled={reprintingSaleId === s.saleId}
                      onClick={() => void reprintSale(s.saleId)}
                    >
                      {reprintingSaleId === s.saleId ? "…" : "Reprint"}
                    </button>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground">
                    No sales yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
