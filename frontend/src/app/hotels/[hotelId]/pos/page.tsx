"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { printDepotSaleInvoice } from "@/lib/printDepotSaleInvoice";
import { PosAnnouncementsButton } from "@/components/PosAnnouncementsModal";

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
  barcode?: string | null;
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
  barcode: string;
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
  roomChargeId?: string | null;
  paymentMethod?: string | null;
  message: string;
};

type CreateProformaResponse = {
  proformaId: string;
  proformaNumber: string;
  depotId: string;
  totalAmount: number | string;
  createdAt: string;
  lines: CreateSaleResponse["lines"];
  message: string;
};

type CreateDeliveryOrderResponse = {
  deliveryOrderId: string;
  deliveryNumber: string;
  depotId: string;
  totalAmount: number | string;
  createdAt: string;
  lines: CreateSaleResponse["lines"];
  message: string;
};

type GuestSearchHit = {
  guest?: {
    id: string;
    full_name?: string | null;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

type ReservationOption = {
  id: string;
  booking_reference?: string;
  guestName?: string;
  roomNumber?: string;
  status?: string;
};

const ORDER_TYPES = ["Dine In", "Take Away", "Delivery", "Table"] as const;
type OrderType = (typeof ORDER_TYPES)[number];

const POS_PAYMENT_METHODS = ["MOMO", "CASH", "CREDIT CARD", "BANK"] as const;
type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

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
  const [depotId, setDepotId] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("Dine In");
  const [locationLabel, setLocationLabel] = useState("Outlet / table");
  const [customerLabel, setCustomerLabel] = useState("Walk-in Customer");
  const [customerTin, setCustomerTin] = useState("");
  const [chargeToFolio, setChargeToFolio] = useState(false);
  const [folioReservationId, setFolioReservationId] = useState("");
  const [folioSearch, setFolioSearch] = useState("");
  const [folioReservationOptions, setFolioReservationOptions] = useState<ReservationOption[]>([]);
  const [folioSearchLoading, setFolioSearchLoading] = useState(false);
  const [guestSuggestions, setGuestSuggestions] = useState<GuestSearchHit[]>([]);
  const [guestSearchLoading, setGuestSearchLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [scanCode, setScanCode] = useState("");
  const scanInputRef = useRef<HTMLInputElement>(null);
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
        if (prev && activeDepots.some((x) => x.id === prev)) return prev;
        const principal = activeDepots.find(
          (x) =>
            x.code.toUpperCase() === "PRINC" ||
            x.code.toUpperCase() === "PRINCIPAL" ||
            x.name.toLowerCase().includes("principal"),
        );
        if (principal) return principal.id;
        if (activeDepots.length === 1) return activeDepots[0].id;
        return activeDepots[0]?.id ?? "";
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

  useEffect(() => {
    if (!loading) scanInputRef.current?.focus();
  }, [loading]);

  useEffect(() => {
    const q = customerLabel.trim();
    if (!getToken() || q.length < 2 || q.toLowerCase() === "walk-in customer") {
      setGuestSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setGuestSearchLoading(true);
      try {
        const hits = await apiFetch<GuestSearchHit[]>(
          `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(q)}`,
        );
        if (!cancelled) setGuestSuggestions((hits ?? []).slice(0, 6));
      } catch {
        if (!cancelled) setGuestSuggestions([]);
      } finally {
        if (!cancelled) setGuestSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [customerLabel, hotelId]);

  useEffect(() => {
    const q = folioSearch.trim();
    if (!getToken() || !chargeToFolio || q.length < 2) {
      setFolioReservationOptions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setFolioSearchLoading(true);
      try {
        const p = new URLSearchParams();
        p.set("status", "CHECKED_IN");
        p.set("checkInFrom", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        p.set("checkInTo", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
        p.set("q", q);
        const hits = await apiFetch<ReservationOption[]>(`/api/v1/hotels/${hotelId}/reservations?${p.toString()}`);
        if (!cancelled) {
          setFolioReservationOptions(
            (hits ?? [])
              .filter((r) => r.id && r.status === "CHECKED_IN" && Boolean(r.roomNumber))
              .slice(0, 8),
          );
        }
      } catch {
        if (!cancelled) setFolioReservationOptions([]);
      } finally {
        if (!cancelled) setFolioSearchLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chargeToFolio, folioSearch, hotelId]);

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
          barcode: (inv.barcode ?? "").trim(),
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
          barcode: (inv?.barcode ?? "").trim(),
          category: categoryLabel(inv?.category),
          currentStock: dp.stockQty,
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
        item.barcode.toLowerCase().includes(q) ||
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
          stock: dp.stockQty,
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

  const findCatalogKeyByScan = useCallback(
    (raw: string): string | null => {
      const code = raw.trim();
      if (!code) return null;
      const norm = code.toLowerCase();

      const exact = catalogItems.find(
        (item) =>
          item.sku.toLowerCase() === norm ||
          (item.barcode && item.barcode.toLowerCase() === norm),
      );
      if (exact) return exact.key;

      const dp = depotProducts.find(
        (p) =>
          p.active &&
          p.productCode.toLowerCase() === norm &&
          (depotId === ALL_DEPOTS || p.depotId === depotId),
      );
      if (!dp) return null;

      const row = catalogItems.find((item) => item.depotProductId === dp.id || item.key === dp.id);
      return row?.key ?? null;
    },
    [catalogItems, depotProducts, depotId],
  );

  async function scanAndAddToCart(raw: string) {
    const code = raw.trim();
    if (!code) return false;

    setError(null);
    const localKey = findCatalogKeyByScan(code);
    if (localKey) {
      const row = catalogItems.find((x) => x.key === localKey);
      await addLine(localKey);
      if (row) setMsg(`Added ${row.name} to cart`);
      setScanCode("");
      setSearch("");
      scanInputRef.current?.focus();
      return true;
    }

    try {
      let item: InventoryItemRow;
      try {
        item = await apiFetch<InventoryItemRow>(
          `/api/v1/hotels/${hotelId}/inventory/items/lookup?barcode=${encodeURIComponent(code)}`,
        );
      } catch {
        item = await apiFetch<InventoryItemRow>(
          `/api/v1/hotels/${hotelId}/inventory/items/lookup?sku=${encodeURIComponent(code)}`,
        );
      }
      await addLine(item.id);
      setMsg(`Added ${item.name} to cart`);
      setScanCode("");
      setSearch("");
      scanInputRef.current?.focus();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : `No product found for “${code}”`);
      return false;
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

  function setLineQty(productId: string, rawValue: string) {
    const next = Number(rawValue);
    if (!Number.isFinite(next)) return;
    setCart((prev) => {
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

  function resetRunningOrderFields() {
    setCart({});
    setOrderType("Dine In");
    setLocationLabel("Outlet / table");
    setCustomerLabel("Walk-in Customer");
    setCustomerTin("");
    setChargeToFolio(false);
    setFolioReservationId("");
    setFolioSearch("");
    setFolioReservationOptions([]);
    setGuestSuggestions([]);
  }

  function saveDraft() {
    try {
      const payload = {
        cart,
        orderType,
        locationLabel,
        customerLabel,
        customerTin,
        chargeToFolio,
        folioReservationId,
        folioSearch,
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
        customerTin?: string;
        chargeToFolio?: boolean;
        folioReservationId?: string;
        folioSearch?: string;
        depotId?: string;
      };
      if (o.cart && typeof o.cart === "object") setCart(o.cart);
      if (o.orderType && ORDER_TYPES.includes(o.orderType)) setOrderType(o.orderType);
      if (typeof o.locationLabel === "string") setLocationLabel(o.locationLabel);
      if (typeof o.customerLabel === "string") setCustomerLabel(o.customerLabel);
      if (typeof o.customerTin === "string") setCustomerTin(o.customerTin);
      if (typeof o.chargeToFolio === "boolean") setChargeToFolio(o.chargeToFolio);
      if (typeof o.folioReservationId === "string") setFolioReservationId(o.folioReservationId);
      if (typeof o.folioSearch === "string") setFolioSearch(o.folioSearch);
      if (o.depotId && o.depotId !== ALL_DEPOTS && depots.some((d) => d.id === o.depotId)) {
        setDepotId(o.depotId!);
      }
      setMsg("Draft loaded.");
      setError(null);
    } catch {
      setError("Draft data was invalid.");
    }
  }

  function buildCustomerName(): string | null {
    const customer = customerLabel.trim() || "Walk-in Customer";
    const parts = [
      "POS",
      orderType.replace(/\s+/g, "_").toUpperCase(),
      locationLabel.trim() || "—",
      customer,
    ];
    const s = parts.join(" | ");
    return s.length > 160 ? s.slice(0, 157) + "…" : s;
  }

  async function printProforma() {
    if (cartRows.length === 0) {
      setError("Add at least one item to print a proforma.");
      return;
    }
    const saleDepotId = resolveSaleDepotId() ?? depotProducts.find((p) => p.id === cartRows[0].productId)?.depotId;
    if (!saleDepotId) {
      setError("Could not determine outlet for this proforma.");
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
      const res = await apiFetch<CreateProformaResponse>(`/api/v1/hotels/${hotelId}/inventory/proformas`, {
        method: "POST",
        body: JSON.stringify({
          customerName: buildCustomerName(),
          depotId: saleDepotId,
          lines: cartRows.map((r) => ({ productId: r.productId, quantity: r.qty })),
        }),
      });
      const depotName = depots.find((d) => d.id === saleDepotId)?.name ?? "Outlet";
      printDepotSaleInvoice(
        {
          saleId: String(res.proformaId),
          saleNumber: res.proformaNumber,
          documentTitle: "PROFORMA",
          depotName,
          customerName: buildCustomerName(),
          customerTin: customerTin.trim() || null,
          totalAmount: Number(res.totalAmount),
          soldAt: res.createdAt,
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
      resetRunningOrderFields();
      sessionStorage.removeItem(DRAFT_KEY(hotelId));
      setMsg(`Proforma ${res.proformaNumber} saved and printed.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Proforma failed");
    } finally {
      setPlacing(false);
    }
  }

  async function submitSale(paymentMethod?: PosPaymentMethod) {
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
    if (chargeToFolio && !folioReservationId.trim()) {
      setError("Select a checked-in guest with an assigned room before charging POS sale to room folio.");
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
          chargeToRoom: chargeToFolio,
          reservationId: chargeToFolio ? folioReservationId.trim() : null,
          paymentMethod: paymentMethod ?? "CASH",
        }),
      });
      const depotName = depots.find((d) => d.id === saleDepotId)?.name ?? "Outlet";
      try {
        printDepotSaleInvoice(
          {
            saleId: String(res.saleId),
            saleNumber: res.saleNumber,
            documentTitle: "INVOICE",
            depotName,
            customerName: buildCustomerName(),
            customerTin: customerTin.trim() || null,
            totalAmount: Number(res.totalAmount),
            soldAt: res.soldAt,
            paymentMethod: res.paymentMethod ?? paymentMethod ?? "CASH",
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
        if (paymentMethod) {
          setError("Sale recorded; allow pop-ups to print the receipt.");
        }
      }
      resetRunningOrderFields();
      sessionStorage.removeItem(DRAFT_KEY(hotelId));
      setMsg(
        paymentMethod
          ? `Invoice printed — ${paymentMethod}`
          : "Order placed.",
      );
      if (res.roomChargeId) {
        setMsg(`POS sale charged to room folio. Charge ID: ${res.roomChargeId}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setPlacing(false);
    }
  }

  async function submitDeliveryOrder() {
    if (cartRows.length === 0) {
      setError("Add at least one item to the delivery order.");
      return;
    }
    const saleDepotId = resolveSaleDepotId() ?? depotProducts.find((p) => p.id === cartRows[0].productId)?.depotId;
    if (!saleDepotId) {
      setError("Could not determine outlet for this delivery.");
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
      const res = await apiFetch<CreateDeliveryOrderResponse>(`/api/v1/hotels/${hotelId}/inventory/deliveries`, {
        method: "POST",
        body: JSON.stringify({
          customerName: buildCustomerName(),
          locationLabel: locationLabel.trim() || null,
          depotId: saleDepotId,
          lines: cartRows.map((r) => ({ productId: r.productId, quantity: r.qty })),
        }),
      });
      resetRunningOrderFields();
      sessionStorage.removeItem(DRAFT_KEY(hotelId));
      setMsg(`Delivery ${res.deliveryNumber} saved. Convert it to invoice from the Invoices page after delivery is finished.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delivery order failed");
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
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <a href="/app/pos/tables" className="font-semibold text-primary hover:underline">
              Tables
            </a>
            <a href="/app/pos/tickets" className="font-semibold text-primary hover:underline">
              Tickets
            </a>
            <a href="/app/pos/kitchen" className="font-semibold text-primary hover:underline">
              Kitchen
            </a>
          </div>
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
          {hotelId ? <PosAnnouncementsButton hotelId={hotelId} /> : null}
        </div>
      </div>
      {selectedOutlet ? (
        <p className="text-xs text-muted-foreground">
          Showing products on <strong className="text-foreground">{selectedOutlet.name}</strong> ({selectedOutlet.code})
          only. Stock shown is this outlet&apos;s transferred stock.
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
        <section className="order-2 flex min-h-[min(380px,55dvh)] w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft lg:order-2 lg:max-w-xl lg:basis-[40%] xl:max-w-none xl:basis-[40%]">
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
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div>
                <label className="text-[11px] text-muted-foreground">Location / table</label>
                <input
                  className="hms-input mt-0.5 w-full text-sm"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder="e.g. Nanzige, Table 4"
                />
              </div>
              <div className="relative">
                <label className="text-[11px] text-muted-foreground">Customer</label>
                <input
                  className="hms-input mt-0.5 w-full text-sm"
                  value={customerLabel}
                  onChange={(e) => setCustomerLabel(e.target.value)}
                  onBlur={() => {
                    if (!customerLabel.trim()) setCustomerLabel("Walk-in Customer");
                  }}
                  onFocus={() => {
                    if (customerLabel.trim().toLowerCase() === "walk-in customer") setCustomerLabel("");
                  }}
                  placeholder="Walk-in Customer"
                />
                {(guestSearchLoading || guestSuggestions.length > 0) && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-border/70 bg-card p-1 text-xs shadow-lg">
                    {guestSearchLoading ? (
                      <div className="px-2 py-1.5 text-muted-foreground">Searching guests…</div>
                    ) : (
                      guestSuggestions.map((hit) => {
                        const name = hit.guest?.full_name || hit.guest?.fullName || "";
                        return (
                          <button
                            key={hit.guest?.id ?? name}
                            type="button"
                            className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setCustomerLabel(name || "Walk-in Customer");
                              setGuestSuggestions([]);
                            }}
                          >
                            <span className="block font-medium text-foreground">{name}</span>
                            <span className="block text-muted-foreground">
                              {[hit.guest?.phone, hit.guest?.email].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">TIN number</label>
                <input
                  className="hms-input mt-0.5 w-full text-sm"
                  value={customerTin}
                  onChange={(e) => setCustomerTin(e.target.value)}
                  placeholder="Optional TIN"
                />
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-border/70 bg-background/70 p-3">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={chargeToFolio}
                  onChange={(e) => {
                    setChargeToFolio(e.target.checked);
                    if (!e.target.checked) {
                      setFolioReservationId("");
                      setFolioSearch("");
                      setFolioReservationOptions([]);
                    }
                  }}
                />
                Charge to room folio
              </label>
              {chargeToFolio && (
                <div className="relative">
                  <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-medium text-sky-900">
                    Accepted only when the client is checked in and has a room assigned.
                  </p>
                  <label className="text-[11px] text-muted-foreground">In-house guest / room</label>
                  <input
                    className="hms-input mt-0.5 w-full text-sm"
                    value={folioSearch}
                    onChange={(e) => {
                      setFolioSearch(e.target.value);
                      setFolioReservationId("");
                    }}
                    placeholder="Search in-house guest, room, or booking reference"
                  />
                  {folioReservationId && (
                    <p className="mt-1 text-[11px] font-medium text-primary">Accepted: selected in-house guest folio will receive this POS charge.</p>
                  )}
                  {(folioSearchLoading || folioReservationOptions.length > 0) && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border/70 bg-card p-1 text-xs shadow-lg">
                      {folioSearchLoading ? (
                        <div className="px-2 py-1.5 text-muted-foreground">Searching in-house guests...</div>
                      ) : (
                        folioReservationOptions.length > 0 ? (
                          folioReservationOptions.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className="block w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const label = [
                                  r.guestName || "Guest",
                                  r.roomNumber ? `Room ${r.roomNumber}` : null,
                                  r.booking_reference || null,
                                ].filter(Boolean).join(" - ");
                                setFolioSearch(label);
                                setFolioReservationId(r.id);
                                setFolioReservationOptions([]);
                              }}
                            >
                              <span className="block font-medium text-foreground">{r.guestName || "Guest"}</span>
                              <span className="block text-muted-foreground">
                                {[`Room ${r.roomNumber}`, r.booking_reference, "CHECKED IN"].filter(Boolean).join(" - ")}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-muted-foreground">
                            No in-house guest found. Check in the client and assign a room first.
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
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
                      <th className="pb-2 w-40">Qty</th>
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
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{r.outletLabel}</div>
                        </td>
                        <td className="py-2 tabular-nums text-muted-foreground">{formatStock(r.stock)}</td>
                        <td className="py-2 text-muted-foreground">{formatMoney(r.unit)}</td>
                        <td className="py-2">
                          <div className="inline-flex items-center rounded-lg border border-border/80 bg-background">
                            <button
                              type="button"
                              className="px-2 py-1 text-lg leading-none hover:bg-muted"
                              onClick={() => bumpQty(r.productId, -1)}
                              aria-label="Decrease"
                            >
                              −
                            </button>
                            <input
                              className="h-9 w-20 border-x border-border/80 bg-transparent px-2 text-center font-medium tabular-nums text-foreground outline-none focus:bg-muted/30"
                              type="text"
                              inputMode="decimal"
                              value={r.qty}
                              onChange={(e) => setLineQty(r.productId, e.target.value)}
                              aria-label={`Quantity for ${r.name}`}
                            />
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
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <button
                type="button"
                className="rounded-lg bg-red-600 px-1 py-2 text-[11px] font-semibold leading-tight text-white hover:bg-red-700 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-xs"
                disabled={placing}
                onClick={clearCart}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-1 py-2 text-[11px] font-semibold leading-tight text-white hover:bg-violet-700 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-xs"
                disabled={placing}
                onClick={saveDraft}
              >
                Draft
              </button>
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-1 py-2 text-[11px] font-semibold leading-tight text-white hover:bg-amber-600 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-xs"
                disabled={placing || cartRows.length === 0 || orderType === "Delivery"}
                onClick={() => void printProforma()}
              >
                Proforma
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-1 py-2 text-[11px] font-semibold leading-tight text-white hover:bg-emerald-700 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-xs"
                disabled={placing || cartRows.length === 0}
                onClick={() => (orderType === "Delivery" ? void submitDeliveryOrder() : void submitSale())}
              >
                {placing ? "…" : orderType === "Delivery" ? "Save delivery" : "Place order"}
              </button>
              {POS_PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  className={`rounded-lg px-1 py-2 text-[10px] font-semibold leading-tight text-white disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-[11px] ${
                    method === "MOMO"
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : method === "CASH"
                        ? "bg-lime-700 hover:bg-lime-800"
                        : method === "CREDIT CARD"
                          ? "bg-sky-700 hover:bg-sky-800"
                          : "bg-indigo-700 hover:bg-indigo-800"
                  }`}
                  disabled={placing || cartRows.length === 0 || orderType === "Delivery"}
                  onClick={() => void submitSale(method)}
                >
                  {placing ? "…" : method}
                </button>
              ))}
            </div>
            {orderType === "Delivery" && (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-900">
                Delivery mode saves a delivery order only. Create the invoice later from Invoices → Deliveries after delivery is finished.
              </p>
            )}
          </div>
        </section>

        <section className="order-1 flex min-h-[min(420px,60dvh)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft lg:order-1">
          <div className="shrink-0 space-y-2 border-b border-border/60 p-2 sm:p-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="pos-barcode-scan">
                Scan barcode
              </label>
              <input
                id="pos-barcode-scan"
                ref={scanInputRef}
                className="hms-input w-full min-w-0 text-sm ring-2 ring-primary/20"
                placeholder="Scan barcode — adds to cart automatically"
                value={scanCode}
                autoComplete="off"
                onChange={(e) => setScanCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void scanAndAddToCart(scanCode);
                  }
                }}
              />
            </div>
            <input
              className="hms-input w-full min-w-0 text-sm"
              placeholder="Search name, SKU, barcode, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  e.preventDefault();
                  void scanAndAddToCart(search);
                }
              }}
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
                    ? `No products on ${selectedOutlet.name}. Transfer stock or add products to this outlet first.`
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
