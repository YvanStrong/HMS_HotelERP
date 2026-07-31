"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ImageUpload } from "@/components/ImageUpload";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { INVENTORY_PRODUCT_UNITS } from "@/lib/inventoryUnits";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";

function fmtNum(v: number | string | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

type ItemRow = {
  id: string;
  name: string;
  sku?: string;
  currentStock?: number | string;
  category?: string;
  reorderPoint?: number | string;
  unitCost?: number | string;
  status?: string;
  description?: string | null;
  barcode?: string | null;
  sellingPrice?: number | string | null;
  active?: boolean;
  expiryDate?: string | null;
  manufactureDate?: string | null;
  valuationMethod?: string | null;
  imageUrl?: string | null;
  unitOfMeasure?: string | null;
  stockType?: "STOCK" | "NON_STOCK";
  taxCategory?: "A" | "B";
  taxable?: boolean;
  allergens?: string[];
  dietaryFlags?: string[];
};

const ALLERGEN_OPTS = ["NUTS", "GLUTEN", "DAIRY", "EGGS", "SHELLFISH", "SOY", "SESAME", "FISH"] as const;
const DIETARY_OPTS = ["VEGAN", "VEGETARIAN", "HALAL", "KOSHER", "GLUTEN_FREE", "DAIRY_FREE"] as const;

function flagLabel(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function InventoryFlagChips({
  options,
  selected,
  onChange,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((x) => x !== code) : [...selected, code]);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((code) => {
        const active = selected.includes(code);
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(code)}
            className={`rounded-lg border px-2 py-2 text-center text-sm transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted/50"
            }`}
          >
            {flagLabel(code)}
          </button>
        );
      })}
    </div>
  );
}

type SalesReportPayload = {
  fromDate: string;
  toDate: string;
  totalRevenue: number | string;
  totalPaid: number | string;
  invoiceCount: number;
  lines: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    customerName: string;
    totalAmount: number | string;
    amountPaid: number | string;
    status: string;
    paymentMethod?: string | null;
  }[];
};
type PurchaseReportPayload = {
  fromDate: string;
  toDate: string;
  totalPurchases: number | string;
  poCount: number;
  lines: {
    poId: string;
    poNumber: string;
    orderDate: string;
    supplierName: string;
    totalAmount: number | string;
    status: string;
    paymentTerms?: string | null;
  }[];
};
type StockValueReportPayload = {
  grandTotal: number | string;
  itemCount: number;
  items: {
    id: string;
    name: string;
    sku: string;
    category?: string | null;
    currentStock: number | string;
    unitCost: number | string;
    totalValue: number | string;
  }[];
};
type ProfitReportPayload = {
  fromDate: string;
  toDate: string;
  totalRevenue: number | string;
  totalCost: number | string;
  totalProfit: number | string;
  lines: {
    invoiceId: string;
    invoiceNumber: string;
    invoiceDate: string;
    customerName: string;
    revenue: number | string;
    estimatedCost: number | string;
    profit: number | string;
  }[];
};
type ExpiredLinePayload = {
  itemId: string;
  name: string;
  sku: string;
  expiryDate: string;
  currentStock: number | string;
};
type UserActivityPayload = { username: string; movementCount: number };
type ValuationPayload = Record<string, string>;

type ItemsSummary = {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number | string;
};
type ItemsPayload = { data?: ItemRow[]; summary?: ItemsSummary };
type CategoryRow = { id: string; name: string; code: string };
type SupplierRow = { id: string; name: string };
type SupplierDetail = {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  paymentDetails?: string | null;
  rating?: number | string | null;
  outstandingBalance?: number | string;
  creditLimit?: number | string;
  createdAt?: string;
};
type CreatedId = { id: string };
type PoLineInput = { itemId: string; quantity: number; unitPrice: number; notes?: string | null };
type PoLineResponse = {
  lineId: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};
type CreatePoResponse = {
  poId: string;
  poNumber: string;
  status: string;
  totalAmount: number;
  lines: PoLineResponse[];
  nextSteps: string[];
  approvalUrl: string;
};
type ReceiveResponse = {
  receiptId: string;
  purchaseOrder: { poNumber: string; status: string; remainingQuantity: number };
};
type DashboardPayload = {
  totalProducts: number;
  totalStockValue: number | string;
  lowStockCount: number;
  outOfStockCount: number;
  todaySales: number | string;
  todayPurchases: number | string;
  pendingPOCount: number;
  totalSuppliers: number;
  totalCustomers: number;
  lowStockItems: { id: string; name: string; sku: string; value: number | string }[];
};
type AlertRow = {
  itemId: string;
  name: string;
  sku: string;
  category?: string | null;
  currentStock: number | string;
  reorderPoint?: number | string | null;
  alertType: string;
};
type AlertPayload = { lowStockCount: number; outOfStockCount: number; items: AlertRow[] };
type MovementRow = {
  id: string;
  itemName: string;
  sku: string;
  type: string;
  quantity: number | string;
  reference?: string | null;
  performedBy?: string | null;
  notes?: string | null;
  timestamp: string;
};
type PoSummary = {
  poId: string;
  poNumber: string;
  supplierName: string;
  status: string;
  totalAmount: number | string;
  expectedDelivery?: string | null;
  createdAt?: string;
};
type WarehouseRow = { id: string; name: string; code: string; address?: string | null; isDefault: boolean; active: boolean };
type TransferRow = {
  id: string;
  transferNumber: string;
  status: string;
  fromWarehouse: string;
  toWarehouse: string;
  transferDate: string;
  items: { itemId: string; itemName: string; sku: string; quantity: number | string }[];
  transferredBy?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
};

type MenuOutletRow = {
  id: string;
  name: string;
  code: string;
  depotType: string;
  active: boolean;
  warehouseId?: string | null;
  warehouseCode?: string | null;
  warehouseName?: string | null;
};

type DepotProductStockRow = {
  id: string;
  depotId: string;
  depotName: string;
  productName: string;
  productCode: string;
  stockQty: number | string;
  stockType?: "STOCK" | "NON_STOCK";
  active: boolean;
  inventoryItemId?: string | null;
};

type DepotMenuSaleRow = {
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName?: string | null;
  totalAmount: number | string;
  soldAt: string;
};

type FabricationFormulaLine = {
  id?: string;
  componentItemId: string;
  componentName?: string;
  componentSku?: string;
  quantity: number | string;
  currentStock?: number | string;
  unitOfMeasure?: string | null;
  notes?: string | null;
};

type FabricationFormula = {
  id: string;
  name: string;
  outputItemId: string;
  outputItemName: string;
  outputSku?: string;
  outputQuantity: number | string;
  notes?: string | null;
  active: boolean;
  lines: FabricationFormulaLine[];
};

type FabricationRun = {
  id: string;
  formulaId: string;
  formulaName: string;
  outputItemName: string;
  outputSku?: string;
  quantityProduced: number | string;
  referenceNo?: string | null;
  createdBy?: string | null;
  createdAt: string;
  lines: {
    componentItemId: string;
    componentName: string;
    componentSku?: string;
    requiredQuantity: number | string;
    stockBefore: number | string;
    stockAfter: number | string;
  }[];
};

const PAGE_SIZE = 12;

type Tab =
  | "overview"
  | "catalog"
  | "stock"
  | "purchasing"
  | "fabrication"
  | "branches"
  | "alerts"
  | "reports"
  | "waste";

export function InventoryErpClient() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<Tab>("overview");
  const [payload, setPayload] = useState<ItemsPayload>({ data: [] });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", contactPerson: "", email: "", phone: "" });
  const [itemForm, setItemForm] = useState({
    name: "",
    categoryId: "",
    stockType: "STOCK" as "STOCK" | "NON_STOCK",
    currentStock: "",
    reorderPoint: "",
    unitCost: "",
    unitOfMeasure: "piece",
    description: "",
    barcode: "",
    sellingPrice: "",
    taxCategory: "B" as "A" | "B",
    imageUrl: "",
    expiryDate: "",
  });
  const wasteLog: { id: string; itemName: string; sku: string; quantity: number; reason: string; at: string }[] = [];

  const [poSupplierId, setPoSupplierId] = useState("");
  const [poExpectedDelivery, setPoExpectedDelivery] = useState("");
  const [poPaymentTerms, setPoPaymentTerms] = useState("NET_30");
  const [poDeliveryInstructions, setPoDeliveryInstructions] = useState("");
  const [poLineDraft, setPoLineDraft] = useState({ itemId: "", quantity: "", unitPrice: "", notes: "" });
  const [poLines, setPoLines] = useState<PoLineInput[]>([]);
  const [savingPo, setSavingPo] = useState(false);
  const [latestPo, setLatestPo] = useState<CreatePoResponse | null>(null);
  const [latestPoInputLines, setLatestPoInputLines] = useState<PoLineInput[]>([]);
  const [receiveLines, setReceiveLines] = useState<Record<string, string>>({});
  const [receivingItemId, setReceivingItemId] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [alerts, setAlerts] = useState<AlertPayload | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [poList, setPoList] = useState<PoSummary[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [menuOutlets, setMenuOutlets] = useState<MenuOutletRow[]>([]);
  const [depotProductStocks, setDepotProductStocks] = useState<DepotProductStockRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [supplierDetails, setSupplierDetails] = useState<SupplierDetail[]>([]);

  const [adjust, setAdjust] = useState({ itemId: "", type: "ADD", quantity: "", newQty: "", reason: "" });
  const [returnPoId, setReturnPoId] = useState("");
  const [returnLineId, setReturnLineId] = useState("");
  const [returnQty, setReturnQty] = useState("");

  const [whForm, setWhForm] = useState({ name: "", code: "", address: "" });
  const [editWarehouse, setEditWarehouse] = useState<WarehouseRow | null>(null);
  const [editWhForm, setEditWhForm] = useState({ name: "", code: "", address: "", isDefault: false });
  const [whSaving, setWhSaving] = useState(false);
  const [trFrom, setTrFrom] = useState("");
  const [trTo, setTrTo] = useState("");
  const [trItem, setTrItem] = useState("");
  const [trQty, setTrQty] = useState("");
  const [trPendingId, setTrPendingId] = useState("");

  const [reportKind, setReportKind] = useState<string | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReportPayload | null>(null);
  const [purchaseReport, setPurchaseReport] = useState<PurchaseReportPayload | null>(null);
  const [stockReport, setStockReport] = useState<StockValueReportPayload | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReportPayload | null>(null);
  const [expiredReport, setExpiredReport] = useState<ExpiredLinePayload[] | null>(null);
  const [userActivityReport, setUserActivityReport] = useState<UserActivityPayload[] | null>(null);
  const [valuationReport, setValuationReport] = useState<ValuationPayload | null>(null);
  const [menuSalesReport, setMenuSalesReport] = useState<DepotMenuSaleRow[] | null>(null);
  const [menuSalesDepotId, setMenuSalesDepotId] = useState("");
  const [fabricationFormulas, setFabricationFormulas] = useState<FabricationFormula[]>([]);
  const [fabricationRuns, setFabricationRuns] = useState<FabricationRun[]>([]);
  const [formulaForm, setFormulaForm] = useState({
    name: "",
    outputItemId: "",
    outputQuantity: "1",
    notes: "",
  });
  const [formulaLineDraft, setFormulaLineDraft] = useState({ componentItemId: "", quantity: "", notes: "" });
  const [formulaLines, setFormulaLines] = useState<FabricationFormulaLine[]>([]);
  const [savingFormula, setSavingFormula] = useState(false);
  const [fabricationRunForm, setFabricationRunForm] = useState({
    formulaId: "",
    quantityProduced: "",
    referenceNo: "",
    notes: "",
  });
  const [runningFabrication, setRunningFabrication] = useState(false);
  const [editItem, setEditItem] = useState<ItemRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    barcode: "",
    sellingPrice: "",
    unitCost: "",
    reorderPoint: "",
    stockType: "STOCK" as "STOCK" | "NON_STOCK",
    taxCategory: "B" as "A" | "B",
    imageUrl: "",
    expiryDate: "",
    active: true,
    unitOfMeasure: "piece",
    allergens: [] as string[],
    dietaryFlags: [] as string[],
  });

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (categoryFilter) p.set("category", categoryFilter);
      p.set("lowStock", String(lowStockOnly));
      if (search.trim()) p.set("search", search.trim());
      const [items, cats] = await Promise.all([
        apiFetch<ItemsPayload>(`/api/v1/hotels/${hotelId}/inventory/items?${p.toString()}`),
        apiFetch<CategoryRow[]>(`/api/v1/hotels/${hotelId}/inventory/categories`),
      ]);
      const s = await apiFetch<SupplierRow[]>(`/api/v1/hotels/${hotelId}/inventory/suppliers`);
      setPayload(items ?? { data: [] });
      setCategories(cats ?? []);
      setSuppliers(s ?? []);
      setPage(1);
      if (!itemForm.categoryId && (cats?.length ?? 0) > 0) {
        setItemForm((f) => ({ ...f, categoryId: cats[0].id }));
      }
      if (!poSupplierId && (s?.length ?? 0) > 0) setPoSupplierId(s[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [hotelId, categoryFilter, lowStockOnly, search, itemForm.categoryId, poSupplierId]);

  const loadExtensions = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [dash, mov, pos, wh, outlets, depotProducts, trf, supD] = await Promise.all([
        apiFetch<DashboardPayload>(`/api/v1/hotels/${hotelId}/inventory/dashboard`),
        apiFetch<MovementRow[]>(`/api/v1/hotels/${hotelId}/inventory/movements?limit=150`),
        apiFetch<PoSummary[]>(`/api/v1/hotels/${hotelId}/inventory/purchase-orders`),
        apiFetch<WarehouseRow[]>(`/api/v1/hotels/${hotelId}/inventory/warehouses`),
        apiFetch<MenuOutletRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`).catch(() => []),
        apiFetch<DepotProductStockRow[]>(`/api/v1/hotels/${hotelId}/inventory/depot-products`).catch(() => []),
        apiFetch<TransferRow[]>(`/api/v1/hotels/${hotelId}/inventory/stock-transfers`),
        apiFetch<SupplierDetail[]>(`/api/v1/hotels/${hotelId}/inventory/suppliers/detail`).catch(() => []),
      ]);
      setDashboard(dash);
      setMovements(mov ?? []);
      setPoList(pos ?? []);
      setWarehouses(wh ?? []);
      setMenuOutlets(Array.isArray(outlets) ? outlets : []);
      setDepotProductStocks(Array.isArray(depotProducts) ? depotProducts : []);
      setTransfers(trf ?? []);
      setSupplierDetails(Array.isArray(supD) ? supD : []);
      if (wh && wh.length > 0) {
        setTrFrom((prev) => prev || wh[0].id);
        setTrTo((prev) => prev || (wh.length > 1 ? wh[1].id : ""));
      }
    } catch {
      /* optional */
    }
  }, [hotelId]);

  const loadAlerts = useCallback(async () => {
    if (!getToken()) return;
    try {
      const a = await apiFetch<AlertPayload>(`/api/v1/hotels/${hotelId}/inventory/alerts`);
      setAlerts(a);
    } catch {
      setAlerts(null);
    }
  }, [hotelId]);

  const items = useMemo(() => payload?.data ?? [], [payload?.data]);
  const stockItems = useMemo(
    () => items.filter((item) => item.stockType !== "NON_STOCK"),
    [items],
  );
  const selectedTransferItem = useMemo(
    () => stockItems.find((item) => item.id === trItem) ?? null,
    [stockItems, trItem],
  );
  const selectedTransferOutletBalances = useMemo(() => {
    if (!trItem) return [];
    return depotProductStocks
      .filter((row) => row.inventoryItemId === trItem && row.active !== false && row.stockType !== "NON_STOCK")
      .map((row) => {
        const outlet = menuOutlets.find((o) => o.id === row.depotId);
        return {
          depotId: row.depotId,
          depotName: outlet ? `${outlet.name} (${outlet.code})` : row.depotName,
          stockQty: row.stockQty,
        };
      })
      .sort((a, b) => a.depotName.localeCompare(b.depotName));
  }, [depotProductStocks, menuOutlets, trItem]);

  const productWarehouseLabels = useMemo(() => {
    const outletById = new Map(menuOutlets.map((outlet) => [outlet.id, outlet]));
    const labels = new Map<string, string>();
    for (const row of depotProductStocks) {
      if (!row.inventoryItemId || row.active === false) continue;
      const outlet = outletById.get(row.depotId);
      const warehouse = outlet?.warehouseName || outlet?.warehouseCode || row.depotName;
      const existing = labels.get(row.inventoryItemId);
      if (!existing) {
        labels.set(row.inventoryItemId, warehouse);
      } else if (!existing.split(", ").includes(warehouse)) {
        labels.set(row.inventoryItemId, `${existing}, ${warehouse}`);
      }
    }
    return labels;
  }, [depotProductStocks, menuOutlets]);

  const loadFabrication = useCallback(async () => {
    if (!getToken()) return;
    try {
      const [formulas, runs] = await Promise.all([
        apiFetch<FabricationFormula[]>(`/api/v1/hotels/${hotelId}/inventory/fabrication/formulas`),
        apiFetch<FabricationRun[]>(`/api/v1/hotels/${hotelId}/inventory/fabrication/runs?limit=50`),
      ]);
      setFabricationFormulas(formulas ?? []);
      setFabricationRuns(runs ?? []);
      setFormulaForm((f) => ({ ...f, outputItemId: f.outputItemId || stockItems[0]?.id || "" }));
      setFormulaLineDraft((d) => ({ ...d, componentItemId: d.componentItemId || stockItems[0]?.id || "" }));
      setFabricationRunForm((f) => ({ ...f, formulaId: f.formulaId || formulas?.[0]?.id || "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fabrication load failed");
    }
  }, [hotelId, stockItems]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      tab === "overview" ||
      tab === "branches" ||
      tab === "purchasing" ||
      tab === "catalog" ||
      tab === "stock" ||
      tab === "reports" ||
      tab === "waste" ||
      tab === "fabrication"
    ) {
      void loadExtensions();
    }
    if (tab === "fabrication") void loadFabrication();
    if (tab === "alerts") void loadAlerts();
  }, [tab, loadExtensions, loadAlerts, loadFabrication]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(items, page, PAGE_SIZE),
    [items, page],
  );

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSavingCategory(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/categories`, {
        method: "POST",
        body: JSON.stringify({ name: categoryForm.name.trim(), code: null }),
      });
      setMsg("Category created (code generated automatically).");
      setCategoryForm({ name: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create category failed");
    } finally {
      setSavingCategory(false);
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.categoryId) {
      setError("Item name and category are required.");
      return;
    }
    setSavingItem(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/items`, {
        method: "POST",
        body: JSON.stringify({
          name: itemForm.name.trim(),
          sku: null,
          categoryId: itemForm.categoryId,
          stockType: itemForm.stockType,
          currentStock: itemForm.stockType === "NON_STOCK" ? 0 : itemForm.currentStock ? Number(itemForm.currentStock) : 0,
          reorderPoint: itemForm.stockType === "NON_STOCK" ? 0 : itemForm.reorderPoint ? Number(itemForm.reorderPoint) : 0,
          unitCost: itemForm.unitCost ? Number(itemForm.unitCost) : 0,
          unitOfMeasure: itemForm.unitOfMeasure || "piece",
          isMinibarItem: false,
          description: itemForm.description.trim() || null,
          barcode: itemForm.barcode.trim() || null,
          sellingPrice: itemForm.sellingPrice ? Number(itemForm.sellingPrice) : null,
          taxCategory: itemForm.taxCategory,
          imageUrl: itemForm.imageUrl.trim() || null,
          expiryDate: itemForm.expiryDate || null,
          manufactureDate: null,
        }),
      });
      setMsg("Product created (SKU assigned automatically).");
      setItemForm((f) => ({
        ...f,
        name: "",
        stockType: "STOCK",
        currentStock: "",
        reorderPoint: "",
        unitCost: "",
        description: "",
        barcode: "",
        sellingPrice: "",
        taxCategory: "B",
        imageUrl: "",
        expiryDate: "",
      }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create item failed");
    } finally {
      setSavingItem(false);
    }
  }

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!supplierForm.name.trim()) {
      setError("Supplier name is required.");
      return;
    }
    setSavingSupplier(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch<CreatedId>(`/api/v1/hotels/${hotelId}/inventory/suppliers`, {
        method: "POST",
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          contactPerson: supplierForm.contactPerson.trim() || null,
          email: supplierForm.email.trim() || null,
          phone: supplierForm.phone.trim() || null,
        }),
      });
      setSupplierForm({ name: "", contactPerson: "", email: "", phone: "" });
      setMsg("Supplier created.");
      await load();
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create supplier failed");
    } finally {
      setSavingSupplier(false);
    }
  }

  function addPoLine() {
    const itemId = poLineDraft.itemId;
    const quantity = Number(poLineDraft.quantity);
    const unitPrice = Number(poLineDraft.unitPrice);
    if (!itemId || Number.isNaN(quantity) || quantity <= 0 || Number.isNaN(unitPrice) || unitPrice < 0) {
      setError("Choose item and valid quantity/unit price for PO line.");
      return;
    }
    setPoLines((l) => [...l, { itemId, quantity, unitPrice, notes: poLineDraft.notes.trim() || null }]);
    setPoLineDraft({ itemId: "", quantity: "", unitPrice: "", notes: "" });
  }

  async function submitPurchaseOrder() {
    if (!poSupplierId) {
      setError("Supplier is required.");
      return;
    }
    if (poLines.length === 0) {
      setError("Add at least one PO line.");
      return;
    }
    setSavingPo(true);
    setError(null);
    setMsg(null);
    try {
      const created = await apiFetch<CreatePoResponse>(`/api/v1/hotels/${hotelId}/inventory/purchase-orders`, {
        method: "POST",
        body: JSON.stringify({
          supplierId: poSupplierId,
          expectedDelivery: poExpectedDelivery || null,
          paymentTerms: poPaymentTerms,
          lines: poLines,
          approvalWorkflow: { requiresApproval: false, approverRoles: [], thresholdAmount: 0 },
          deliveryInstructions: poDeliveryInstructions.trim() || null,
        }),
      });
      setLatestPo(created);
      setLatestPoInputLines(poLines);
      setPoLines([]);
      setPoExpectedDelivery("");
      setPoDeliveryInstructions("");
      setMsg(`PO created: ${created.poNumber}`);
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create PO failed");
    } finally {
      setSavingPo(false);
    }
  }

  async function receiveForLine(lineIdx: number) {
    if (!latestPo) return;
    const inLine = latestPoInputLines[lineIdx];
    const outLine = latestPo.lines[lineIdx];
    if (!inLine || !outLine) return;
    const qty = Number(receiveLines[outLine.lineId] ?? "");
    if (Number.isNaN(qty) || qty <= 0) {
      setError("Enter valid received quantity.");
      return;
    }
    const orderedQty = Number(outLine.quantity);
    if (Number.isFinite(orderedQty) && qty > orderedQty) {
      setError(`You cannot receive more than ordered (${fmtNum(orderedQty, 4)}).`);
      return;
    }
    setReceivingItemId(inLine.itemId);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<ReceiveResponse>(`/api/v1/hotels/${hotelId}/inventory/items/${inLine.itemId}/receive`, {
        method: "POST",
        body: JSON.stringify({
          purchaseOrderId: latestPo.poId,
          receivedLines: [
            {
              poLineId: outLine.lineId,
              quantityReceived: qty,
              qualityCheck: "PASS",
              notes: null,
              batchNumber: null,
              expiryDate: null,
            },
          ],
          deliveryNote: null,
          receivedBy: null,
          location: "Main Store",
        }),
      });
      setMsg(`Goods received for ${outLine.itemName}. PO status: ${res.purchaseOrder.status}`);
      setReceiveLines((m) => ({ ...m, [outLine.lineId]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Receive failed");
    } finally {
      setReceivingItemId(null);
    }
  }

  async function submitStockAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust.itemId || !adjust.type) {
      setError("Item and adjustment type required.");
      return;
    }
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/stock/adjust`, {
        method: "POST",
        body: JSON.stringify({
          itemId: adjust.itemId,
          adjustmentType: adjust.type,
          quantity: adjust.quantity ? Number(adjust.quantity) : null,
          newQuantity: adjust.newQty ? Number(adjust.newQty) : null,
          reason: adjust.reason || "ADJUSTMENT",
          notes: null,
        }),
      });
      setMsg("Stock adjusted.");
      setAdjust({ itemId: "", type: "ADD", quantity: "", newQty: "", reason: "" });
      await load();
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Adjust failed");
    }
  }

  function addFormulaLine() {
    const component = stockItems.find((item) => item.id === formulaLineDraft.componentItemId);
    const quantity = Number(formulaLineDraft.quantity);
    if (!component || !Number.isFinite(quantity) || quantity <= 0) {
      setError("Choose an ingredient and enter a positive quantity.");
      return;
    }
    if (component.id === formulaForm.outputItemId) {
      setError("Finished product cannot also be an ingredient.");
      return;
    }
    setFormulaLines((lines) => [
      ...lines,
      {
        componentItemId: component.id,
        componentName: component.name,
        componentSku: component.sku,
        quantity,
        currentStock: component.currentStock,
        unitOfMeasure: component.unitOfMeasure,
        notes: formulaLineDraft.notes.trim() || null,
      },
    ]);
    setFormulaLineDraft({ componentItemId: stockItems[0]?.id || "", quantity: "", notes: "" });
  }

  async function createFabricationFormula(e: React.FormEvent) {
    e.preventDefault();
    if (!formulaForm.name.trim() || !formulaForm.outputItemId || formulaLines.length === 0) {
      setError("Formula name, finished product, and at least one ingredient are required.");
      return;
    }
    setSavingFormula(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch<FabricationFormula>(`/api/v1/hotels/${hotelId}/inventory/fabrication/formulas`, {
        method: "POST",
        body: JSON.stringify({
          name: formulaForm.name.trim(),
          outputItemId: formulaForm.outputItemId,
          outputQuantity: Number(formulaForm.outputQuantity) || 1,
          notes: formulaForm.notes.trim() || null,
          lines: formulaLines.map((line) => ({
            componentItemId: line.componentItemId,
            quantity: Number(line.quantity),
            notes: line.notes || null,
          })),
        }),
      });
      setMsg("Fabrication formula saved.");
      setFormulaForm({ name: "", outputItemId: stockItems[0]?.id || "", outputQuantity: "1", notes: "" });
      setFormulaLines([]);
      await loadFabrication();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create fabrication formula failed");
    } finally {
      setSavingFormula(false);
    }
  }

  async function submitFabricationRun(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(fabricationRunForm.quantityProduced);
    if (!fabricationRunForm.formulaId || !Number.isFinite(qty) || qty <= 0) {
      setError("Choose a formula and enter a positive quantity to produce.");
      return;
    }
    setRunningFabrication(true);
    setError(null);
    setMsg(null);
    try {
      const run = await apiFetch<FabricationRun>(`/api/v1/hotels/${hotelId}/inventory/fabrication/runs`, {
        method: "POST",
        body: JSON.stringify({
          formulaId: fabricationRunForm.formulaId,
          quantityProduced: qty,
          referenceNo: fabricationRunForm.referenceNo.trim() || null,
          notes: fabricationRunForm.notes.trim() || null,
        }),
      });
      setMsg(`Fabrication completed: ${run.quantityProduced} ${run.outputItemName}`);
      setFabricationRunForm((f) => ({ ...f, quantityProduced: "", referenceNo: "", notes: "" }));
      await load();
      await loadFabrication();
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fabrication failed");
    } finally {
      setRunningFabrication(false);
    }
  }

  async function submitPurchaseReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnPoId || !returnLineId || !returnQty) {
      setError("PO id, line id, and quantity required.");
      return;
    }
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/purchase-orders/${returnPoId}/returns`, {
        method: "POST",
        body: JSON.stringify({
          lines: [{ poLineId: returnLineId, quantity: Number(returnQty) }],
          notes: "Purchase return to supplier",
        }),
      });
      setMsg("Purchase return recorded (stock reduced).");
      setReturnLineId("");
      setReturnQty("");
      await load();
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Return failed");
    }
  }

  async function createWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!whForm.name.trim() || !whForm.code.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/warehouses`, {
        method: "POST",
        body: JSON.stringify({
          name: whForm.name.trim(),
          code: whForm.code.trim().toUpperCase(),
          address: whForm.address.trim() || null,
          isDefault: false,
        }),
      });
      setMsg("Warehouse created.");
      setWhForm({ name: "", code: "", address: "" });
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Warehouse create failed");
    }
  }

  function openEditWarehouse(w: WarehouseRow) {
    setEditWarehouse(w);
    setEditWhForm({
      name: w.name,
      code: w.code,
      address: w.address ?? "",
      isDefault: w.isDefault,
    });
  }

  async function saveEditWarehouse(e: React.FormEvent) {
    e.preventDefault();
    if (!editWarehouse || !editWhForm.name.trim() || !editWhForm.code.trim()) return;
    setError(null);
    setWhSaving(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/warehouses/${editWarehouse.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editWhForm.name.trim(),
          code: editWhForm.code.trim().toUpperCase(),
          address: editWhForm.address.trim() || null,
          isDefault: editWhForm.isDefault,
        }),
      });
      setMsg("Warehouse updated.");
      setEditWarehouse(null);
      void loadExtensions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Warehouse update failed");
    } finally {
      setWhSaving(false);
    }
  }

  async function deleteWarehouse(w: WarehouseRow) {
    if (w.isDefault) {
      setError("Cannot delete the default warehouse.");
      return;
    }
    const linked = menuOutlets.find((o) => o.warehouseId === w.id || o.warehouseCode?.toUpperCase() === w.code.toUpperCase());
    const confirmMsg = linked
      ? `Delete warehouse "${w.name}"? This will also deactivate the linked outlet "${linked.name}".`
      : `Delete warehouse "${w.name}" (${w.code})?`;
    if (!window.confirm(confirmMsg)) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/warehouses/${w.id}`, {
        method: "DELETE",
      });
      setMsg(`Warehouse "${w.name}" deleted.`);
      if (editWarehouse?.id === w.id) setEditWarehouse(null);
      void loadExtensions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Warehouse delete failed");
    }
  }

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!trFrom || !trTo || !trItem || !trQty) {
      setError("From, to, item, quantity required for transfer.");
      return;
    }
    setError(null);
    try {
      const res = await apiFetch<{ id: string }>(`/api/v1/hotels/${hotelId}/inventory/stock-transfers`, {
        method: "POST",
        body: JSON.stringify({
          fromWarehouseId: trFrom,
          toWarehouseId: trTo,
          items: [{ itemId: trItem, quantity: Number(trQty) }],
          notes: null,
        }),
      });
      setTrPendingId(res.id);
      setMsg(`Transfer ${res.id} created (PENDING). Complete it below.`);
      void loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfer failed");
    }
  }

  async function completeTransfer() {
    if (!trPendingId) {
      setError("Create a transfer first to get an id.");
      return;
    }
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/stock-transfers/${trPendingId}/complete`, {
        method: "POST",
      });
      setMsg("Transfer completed. Source outlet stock reduced and destination outlet stock increased.");
      await loadExtensions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete transfer failed");
    }
  }

  function clearReportPayloads() {
    setSalesReport(null);
    setPurchaseReport(null);
    setStockReport(null);
    setProfitReport(null);
    setExpiredReport(null);
    setUserActivityReport(null);
    setValuationReport(null);
    setMenuSalesReport(null);
  }

  async function fetchReport(kind: string, opts?: { menuDepotId?: string }) {
    setError(null);
    clearReportPayloads();
    setReportKind(kind);
    try {
      if (kind === "sales") {
        const data = await apiFetch<SalesReportPayload>(`/api/v1/hotels/${hotelId}/inventory/reports/sales`);
        setSalesReport(data);
        return;
      }
      if (kind === "purchases") {
        const data = await apiFetch<PurchaseReportPayload>(`/api/v1/hotels/${hotelId}/inventory/reports/purchases`);
        setPurchaseReport(data);
        return;
      }
      if (kind === "stock") {
        const data = await apiFetch<StockValueReportPayload>(`/api/v1/hotels/${hotelId}/inventory/reports/stock-value`);
        setStockReport(data);
        return;
      }
      if (kind === "profit") {
        const data = await apiFetch<ProfitReportPayload>(`/api/v1/hotels/${hotelId}/inventory/reports/profit`);
        setProfitReport(data);
        return;
      }
      if (kind === "expired") {
        const data = await apiFetch<ExpiredLinePayload[]>(`/api/v1/hotels/${hotelId}/inventory/reports/expired-products`);
        setExpiredReport(Array.isArray(data) ? data : []);
        return;
      }
      if (kind === "users") {
        const data = await apiFetch<UserActivityPayload[]>(`/api/v1/hotels/${hotelId}/inventory/reports/user-activity`);
        setUserActivityReport(Array.isArray(data) ? data : []);
        return;
      }
      if (kind === "valuation") {
        const data = await apiFetch<ValuationPayload>(`/api/v1/hotels/${hotelId}/inventory/settings/valuation`);
        setValuationReport(data);
        return;
      }
      if (kind === "menu-sales") {
        const dep = opts?.menuDepotId ?? menuSalesDepotId;
        const q = dep ? `?depotId=${encodeURIComponent(dep)}` : "";
        const data = await apiFetch<DepotMenuSaleRow[]>(`/api/v1/hotels/${hotelId}/inventory/sales${q}`);
        setMenuSalesReport(Array.isArray(data) ? data : []);
        return;
      }
    } catch (e) {
      clearReportPayloads();
      setError(e instanceof Error ? e.message : "Report failed");
    }
  }

  function openEdit(it: ItemRow) {
    setEditItem(it);
    setEditForm({
      name: it.name,
      description: (it.description as string) ?? "",
      barcode: (it.barcode as string) ?? "",
      sellingPrice: it.sellingPrice != null ? String(it.sellingPrice) : "",
      unitCost: it.unitCost != null ? String(it.unitCost) : "",
      reorderPoint: it.reorderPoint != null ? String(it.reorderPoint) : "",
      stockType: it.stockType === "NON_STOCK" ? "NON_STOCK" : "STOCK",
      taxCategory: it.taxCategory === "A" ? "A" : "B",
      imageUrl: (it.imageUrl as string) ?? "",
      expiryDate: (it.expiryDate as string) ?? "",
      active: it.active !== false,
      unitOfMeasure: it.unitOfMeasure?.trim() || "piece",
      allergens: it.allergens ?? [],
      dietaryFlags: it.dietaryFlags ?? [],
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/items/${editItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          barcode: editForm.barcode.trim() || null,
          sellingPrice: editForm.sellingPrice ? Number(editForm.sellingPrice) : null,
          taxCategory: editForm.taxCategory,
          unitCost: editForm.unitCost ? Number(editForm.unitCost) : null,
          stockType: editForm.stockType,
          reorderPoint: editForm.stockType === "NON_STOCK" ? 0 : editForm.reorderPoint ? Number(editForm.reorderPoint) : null,
          imageUrl: editForm.imageUrl.trim() || null,
          expiryDate: editForm.expiryDate || null,
          active: editForm.active,
          sku: null,
          categoryId: null,
          minimumStock: null,
          maximumStock: null,
          manufactureDate: null,
          valuationMethod: null,
          unitOfMeasure: editForm.unitOfMeasure || "piece",
          allergens: editForm.allergens,
          dietaryFlags: editForm.dietaryFlags,
        }),
      });
      setMsg("Product updated.");
      setEditItem(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  const poLinePreview = poLines.map((l) => {
    const item = items.find((i) => i.id === l.itemId);
    return {
      ...l,
      itemName: item?.name ?? l.itemId,
      sku: item?.sku ?? "—",
      total: l.quantity * l.unitPrice,
    };
  });

  const selectedFormula = useMemo(
    () => fabricationFormulas.find((f) => f.id === fabricationRunForm.formulaId) ?? null,
    [fabricationFormulas, fabricationRunForm.formulaId],
  );

  const fabricationPreview = useMemo(() => {
    if (!selectedFormula) return [];
    const qty = Number(fabricationRunForm.quantityProduced || 0);
    const outputQty = Number(selectedFormula.outputQuantity || 1) || 1;
    const multiplier = qty > 0 ? qty / outputQty : 0;
    return selectedFormula.lines.map((line) => ({
      ...line,
      required: Number(line.quantity) * multiplier,
    }));
  }, [selectedFormula, fabricationRunForm.quantityProduced]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Inventory management</h1>
        <p className="text-muted-foreground mt-1">
          Products, stock, purchasing, branches/warehouses, alerts, and reports. Sell through{" "}
          <Link href={staffAppPath("menu")} className="underline font-medium text-foreground">
            Menu
          </Link>{" "}
          (outlets linked to warehouses); menu sales appear under Reports.
        </p>
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border/60 pt-3">
          <strong>Internal inventory items</strong> (SKU, valuation, POs, adjustments) are here.{" "}
          <strong>Guest self-order / POS catalogue</strong> uses{" "}
          <Link href={staffAppPath("menu")} className="underline font-medium text-foreground">
            Menu
          </Link>{" "}
          depots — link a depot product to an inventory item when you want both in sync.
        </p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["overview", "Dashboard"],
              ["catalog", "Products"],
              ["stock", "Stock ops"],
              ["fabrication", "Fabrication"],
              ["purchasing", "Purchasing"],
              ["branches", "Branches"],
              ["alerts", "Alerts"],
              ["reports", "Reports"],
              ["waste", "Waste log"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={tab === k ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
              onClick={() => setTab(k as Tab)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      {tab === "overview" && dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Active products</p>
            <p className="text-2xl font-bold">{dashboard.totalProducts}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Stock value</p>
            <p className="text-2xl font-bold">{String(dashboard.totalStockValue)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Today&apos;s sales</p>
            <p className="text-2xl font-bold">{String(dashboard.todaySales)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Today&apos;s PO total</p>
            <p className="text-2xl font-bold">{String(dashboard.todayPurchases)}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Low stock</p>
            <p className="text-2xl font-bold text-amber-700">{dashboard.lowStockCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Out of stock</p>
            <p className="text-2xl font-bold text-red-600">{dashboard.outOfStockCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Open purchase orders</p>
            <p className="text-2xl font-bold">{dashboard.pendingPOCount}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">Suppliers / customers</p>
            <p className="text-2xl font-bold">
              {dashboard.totalSuppliers} / {dashboard.totalCustomers}
            </p>
          </div>
          <div className="col-span-2 lg:col-span-4 rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="text-sm font-semibold mb-2">Low-stock watchlist</h3>
            {(dashboard.lowStockItems ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No low-stock items.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {dashboard.lowStockItems.map((x) => (
                  <li key={x.id}>
                    {x.name} ({x.sku}) — value {String(x.value)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-2xl font-bold">{payload.summary?.totalItems ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Low stock</p>
              <p className="text-2xl font-bold text-amber-700">{payload.summary?.lowStockCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Out of stock</p>
              <p className="text-2xl font-bold text-red-600">{payload.summary?.outOfStockCount ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">Stock value</p>
              <p className="text-2xl font-bold">{String(payload.summary?.totalValue ?? 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Create category</h2>
              <p className="text-xs text-muted-foreground mb-2">The category code is generated automatically from the name.</p>
              <form onSubmit={createCategory} className="grid grid-cols-1 gap-3">
                <div>
                  <label>Name</label>
                  <input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <button type="submit" className="hms-btn-outline text-sm" disabled={savingCategory}>
                    {savingCategory ? "Creating..." : "Create category"}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Create product</h2>
              <p className="text-xs text-muted-foreground mb-2">SKU is assigned automatically when the product is saved.</p>
              <form onSubmit={createItem} className="grid grid-cols-2 gap-3">
                <div>
                  <label>Name</label>
                  <input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label>Category</label>
                  <select
                    value={itemForm.categoryId}
                    onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Unit</label>
                  <select
                    value={itemForm.unitOfMeasure}
                    onChange={(e) => setItemForm((f) => ({ ...f, unitOfMeasure: e.target.value }))}
                  >
                    {INVENTORY_PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Product type</label>
                  <select
                    value={itemForm.stockType}
                    onChange={(e) =>
                      setItemForm((f) => ({
                        ...f,
                        stockType: e.target.value as "STOCK" | "NON_STOCK",
                        currentStock: e.target.value === "NON_STOCK" ? "" : f.currentStock,
                        reorderPoint: e.target.value === "NON_STOCK" ? "" : f.reorderPoint,
                      }))
                    }
                  >
                    <option value="STOCK">STOCK (manage quantity)</option>
                    <option value="NON_STOCK">NON STOCK (no quantity)</option>
                  </select>
                </div>
                {itemForm.stockType === "STOCK" ? (
                  <>
                    <div>
                      <label>Opening stock</label>
                      <input
                        type="number"
                        value={itemForm.currentStock}
                        onChange={(e) => setItemForm((f) => ({ ...f, currentStock: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label>Reorder point</label>
                      <input
                        type="number"
                        value={itemForm.reorderPoint}
                        onChange={(e) => setItemForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                    Non-stock products do not need opening stock or reorder point. They can be sold without stock
                    quantity checks.
                  </div>
                )}
                <div>
                  <label>Unit cost</label>
                  <input
                    type="number"
                    value={itemForm.unitCost}
                    onChange={(e) => setItemForm((f) => ({ ...f, unitCost: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Selling price</label>
                  <input
                    type="number"
                    value={itemForm.sellingPrice}
                    onChange={(e) => setItemForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <label>Tax category</label>
                  <select
                    value={itemForm.taxCategory}
                    onChange={(e) => setItemForm((f) => ({ ...f, taxCategory: e.target.value as "A" | "B" }))}
                  >
                    <option value="A">A - 0% (not taxable)</option>
                    <option value="B">B - 18% (taxable)</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose A for products without VAT. Choose B for taxable products with 18% VAT on receipts.
                  </p>
                </div>
                <div className="col-span-2">
                  <label>Description</label>
                  <input
                    value={itemForm.description}
                    onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Barcode</label>
                  <input
                    value={itemForm.barcode}
                    onChange={(e) => setItemForm((f) => ({ ...f, barcode: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Expiry</label>
                  <input
                    type="date"
                    value={itemForm.expiryDate}
                    onChange={(e) => setItemForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
                <div className="col-span-2">
                  <ImageUpload
                    label="Product image (optional)"
                    value={itemForm.imageUrl}
                    onChange={(url) => setItemForm((f) => ({ ...f, imageUrl: url }))}
                    placeholder="Paste image URL or upload"
                  />
                </div>
                <div className="col-span-2">
                  <button type="submit" className="hms-btn-solid" disabled={savingItem}>
                    {savingItem ? "Creating..." : "Create product"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label>Search</label>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, SKU, barcode..." />
              </div>
              <div>
                <label>Category</label>
                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />{" "}
                  Low stock only
                </label>
                <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
          </div>

          <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p style={{ color: "var(--muted)", marginTop: 0 }}>{items.length} product(s)</p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Type</th>
                  <th>Tax</th>
                  <th>Warehouse</th>
                  <th>Qty</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.sku ?? "—"}</td>
                    <td className="text-xs">{r.barcode ?? "—"}</td>
                    <td>
                      <span className="badge badge-neutral">{r.stockType === "NON_STOCK" ? "NON STOCK" : "STOCK"}</span>
                    </td>
                    <td>
                      <span className={r.taxCategory === "A" || r.taxable === false ? "badge badge-neutral" : "badge badge-info"}>
                        {r.taxCategory === "A" || r.taxable === false ? "A - 0%" : "B - 18%"}
                      </span>
                    </td>
                    <td className="text-xs">{productWarehouseLabels.get(r.id) ?? "—"}</td>
                    <td>{r.stockType === "NON_STOCK" ? "—" : r.currentStock ?? "—"}</td>
                    <td>
                      <button type="button" className="hms-btn-outline text-xs" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={PAGE_SIZE}
              noun="items"
              onPageChange={setPage}
            />
          </div>

          {supplierDetails.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h3 className="text-base font-semibold mb-2">Supplier balances</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Outstanding</th>
                    <th>Credit limit</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierDetails.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{String(s.outstandingBalance ?? 0)}</td>
                      <td>{String(s.creditLimit ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Create supplier</h2>
              <form onSubmit={createSupplier} className="grid grid-cols-1 gap-3">
                <div>
                  <label>Name</label>
                  <input value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label>Contact person</label>
                  <input
                    value={supplierForm.contactPerson}
                    onChange={(e) => setSupplierForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Email</label>
                  <input value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label>Phone</label>
                  <input value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <button type="submit" className="hms-btn-solid" disabled={savingSupplier}>
                    {savingSupplier ? "Creating..." : "Create supplier"}
                  </button>
                </div>
              </form>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Supplier directory</h2>
              {suppliers.length === 0 ? (
                <p className="text-muted-foreground">No suppliers yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {editItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
              <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-lg">
                <h3 className="text-lg font-semibold mb-3">Edit product</h3>
                <form onSubmit={saveEdit} className="grid grid-cols-1 gap-3">
                  <div>
                    <label>SKU</label>
                    <input value={editItem.sku ?? "—"} readOnly className="bg-muted/50" />
                  </div>
                  <div>
                    <label>Name</label>
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label>Unit</label>
                    <select
                      value={editForm.unitOfMeasure}
                      onChange={(e) => setEditForm((f) => ({ ...f, unitOfMeasure: e.target.value }))}
                    >
                      {INVENTORY_PRODUCT_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Product type</label>
                    <select
                      value={editForm.stockType}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          stockType: e.target.value as "STOCK" | "NON_STOCK",
                          reorderPoint: e.target.value === "NON_STOCK" ? "" : f.reorderPoint,
                        }))
                      }
                    >
                      <option value="STOCK">STOCK (manage quantity)</option>
                      <option value="NON_STOCK">NON STOCK (no quantity)</option>
                    </select>
                    {editForm.stockType === "NON_STOCK" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Saving as non-stock will set inventory quantity and reorder point to 0.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label>Description</label>
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-foreground">Allergens</p>
                    <InventoryFlagChips
                      options={ALLERGEN_OPTS}
                      selected={editForm.allergens}
                      onChange={(allergens) => setEditForm((f) => ({ ...f, allergens }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-foreground">Dietary flags</p>
                    <InventoryFlagChips
                      options={DIETARY_OPTS}
                      selected={editForm.dietaryFlags}
                      onChange={(dietaryFlags) => setEditForm((f) => ({ ...f, dietaryFlags }))}
                    />
                  </div>
                  <div>
                    <label>Barcode</label>
                    <input
                      value={editForm.barcode}
                      onChange={(e) => setEditForm((f) => ({ ...f, barcode: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label>Unit cost</label>
                      <input
                        type="number"
                        value={editForm.unitCost}
                        onChange={(e) => setEditForm((f) => ({ ...f, unitCost: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label>Selling price</label>
                      <input
                        type="number"
                        value={editForm.sellingPrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label>Tax category</label>
                    <select
                      value={editForm.taxCategory}
                      onChange={(e) => setEditForm((f) => ({ ...f, taxCategory: e.target.value as "A" | "B" }))}
                    >
                      <option value="A">A - 0% (not taxable)</option>
                      <option value="B">B - 18% (taxable)</option>
                    </select>
                  </div>
                  {editForm.stockType === "STOCK" ? (
                    <div>
                      <label>Reorder point</label>
                      <input
                        type="number"
                        value={editForm.reorderPoint}
                        onChange={(e) => setEditForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                      />
                    </div>
                  ) : null}
                  <div>
                    <label>Expiry</label>
                    <input
                      type="date"
                      value={editForm.expiryDate}
                      onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                    />
                  </div>
                  <ImageUpload
                    label="Product image"
                    value={editForm.imageUrl}
                    onChange={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                    placeholder="Paste URL or upload"
                  />
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editForm.active}
                      onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Active
                  </label>
                  <div className="flex gap-2">
                    <button type="submit" className="hms-btn-solid text-sm">
                      Save
                    </button>
                    <button type="button" className="hms-btn-outline text-sm" onClick={() => setEditItem(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "stock" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Stock adjustment</h2>
            <form onSubmit={submitStockAdjust} className="grid grid-cols-1 gap-3">
              <div>
                <label>Item</label>
                <select value={adjust.itemId} onChange={(e) => setAdjust((a) => ({ ...a, itemId: e.target.value }))}>
                  <option value="">Select…</option>
                  {stockItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
                {stockItems.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No stock products available. Non-stock products are not shown here.
                  </p>
                ) : null}
              </div>
              <div>
                <label>Type</label>
                <select value={adjust.type} onChange={(e) => setAdjust((a) => ({ ...a, type: e.target.value }))}>
                  <option value="ADD">Add stock</option>
                  <option value="REMOVE">Remove stock</option>
                  <option value="SET">Set quantity</option>
                </select>
              </div>
              <div>
                <label>Quantity (ADD/REMOVE)</label>
                <input
                  type="number"
                  value={adjust.quantity}
                  onChange={(e) => setAdjust((a) => ({ ...a, quantity: e.target.value }))}
                />
              </div>
              <div>
                <label>New quantity (SET)</label>
                <input
                  type="number"
                  value={adjust.newQty}
                  onChange={(e) => setAdjust((a) => ({ ...a, newQty: e.target.value }))}
                />
              </div>
              <div>
                <label>Reason</label>
                <input value={adjust.reason} onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} />
              </div>
              <button type="submit" className="hms-btn-solid text-sm">
                Apply adjustment
              </button>
            </form>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Recent movements (hotel)</h2>
            <div className="max-h-80 overflow-auto text-sm">
              {movements.length === 0 ? (
                <p className="text-muted-foreground">No movements yet.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.slice(0, 40).map((m) => (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap text-xs">{new Date(m.timestamp).toLocaleString()}</td>
                        <td>{m.itemName}</td>
                        <td>{m.type}</td>
                        <td>{String(m.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "fabrication" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-2">Fabrication formula</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Define ingredients for one finished product. Example: one doughnut uses flour, eggs, sugar, milk,
              oil, and other ingredients.
            </p>
            <form onSubmit={createFabricationFormula} className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label>Formula name</label>
                  <input
                    value={formulaForm.name}
                    onChange={(e) => setFormulaForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Doughnut formula"
                  />
                </div>
                <div>
                  <label>Finished product</label>
                  <select
                    value={formulaForm.outputItemId}
                    onChange={(e) => setFormulaForm((f) => ({ ...f, outputItemId: e.target.value }))}
                  >
                    <option value="">Choose stock product...</option>
                    {stockItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Formula output qty</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={formulaForm.outputQuantity}
                    onChange={(e) => setFormulaForm((f) => ({ ...f, outputQuantity: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_1fr_auto]">
                <div>
                  <label>Ingredient</label>
                  <select
                    value={formulaLineDraft.componentItemId}
                    onChange={(e) => setFormulaLineDraft((d) => ({ ...d, componentItemId: e.target.value }))}
                  >
                    <option value="">Choose ingredient...</option>
                    {stockItems
                      .filter((item) => item.id !== formulaForm.outputItemId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.sku ?? "—"}) · Stock {fmtNum(item.currentStock, 4)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label>Qty per formula</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={formulaLineDraft.quantity}
                    onChange={(e) => setFormulaLineDraft((d) => ({ ...d, quantity: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Notes</label>
                  <input
                    value={formulaLineDraft.notes}
                    onChange={(e) => setFormulaLineDraft((d) => ({ ...d, notes: e.target.value }))}
                    placeholder="kg, litre, piece..."
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" className="hms-btn-outline w-full text-sm" onClick={addFormulaLine}>
                    Add ingredient
                  </button>
                </div>
              </div>
              {formulaLines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Qty</th>
                        <th>Stock now</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {formulaLines.map((line, idx) => (
                        <tr key={`${line.componentItemId}-${idx}`}>
                          <td>{line.componentName} ({line.componentSku ?? "—"})</td>
                          <td>{fmtNum(line.quantity, 4)} {line.unitOfMeasure ?? ""}</td>
                          <td>{fmtNum(line.currentStock, 4)}</td>
                          <td>
                            <button
                              type="button"
                              className="hms-btn-outline text-xs"
                              onClick={() => setFormulaLines((lines) => lines.filter((_, i) => i !== idx))}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <textarea
                rows={2}
                value={formulaForm.notes}
                onChange={(e) => setFormulaForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Formula notes (optional)"
              />
              <button type="submit" className="hms-btn-solid text-sm" disabled={savingFormula}>
                {savingFormula ? "Saving formula..." : "Save formula"}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Run fabrication</h2>
              <form onSubmit={submitFabricationRun} className="grid grid-cols-1 gap-3">
                <div>
                  <label>Formula</label>
                  <select
                    value={fabricationRunForm.formulaId}
                    onChange={(e) => setFabricationRunForm((f) => ({ ...f, formulaId: e.target.value }))}
                  >
                    <option value="">Choose formula...</option>
                    {fabricationFormulas.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} → {f.outputItemName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quantity to make</label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={fabricationRunForm.quantityProduced}
                    onChange={(e) => setFabricationRunForm((f) => ({ ...f, quantityProduced: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                {fabricationPreview.length > 0 ? (
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-semibold">Ingredients needed</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Needed</th>
                          <th>Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fabricationPreview.map((line) => (
                          <tr key={line.componentItemId}>
                            <td>{line.componentName}</td>
                            <td>{fmtNum(line.required, 4)}</td>
                            <td>{fmtNum(line.currentStock, 4)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <input
                  value={fabricationRunForm.referenceNo}
                  onChange={(e) => setFabricationRunForm((f) => ({ ...f, referenceNo: e.target.value }))}
                  placeholder="Reference no. (optional)"
                />
                <textarea
                  rows={2}
                  value={fabricationRunForm.notes}
                  onChange={(e) => setFabricationRunForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Run notes (optional)"
                />
                <button type="submit" className="hms-btn-solid text-sm" disabled={runningFabrication}>
                  {runningFabrication ? "Producing..." : "Complete fabrication"}
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h2 className="text-lg font-semibold mb-3">Recent fabrication runs</h2>
              {fabricationRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fabrication runs yet.</p>
              ) : (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Output</th>
                        <th>Qty</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fabricationRuns.map((run) => (
                        <tr key={run.id}>
                          <td className="whitespace-nowrap text-xs">{new Date(run.createdAt).toLocaleString()}</td>
                          <td>{run.outputItemName}</td>
                          <td>{fmtNum(run.quantityProduced, 4)}</td>
                          <td>{run.createdBy ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Saved formulas</h2>
            {fabricationFormulas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No formulas yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Formula</th>
                      <th>Finished product</th>
                      <th>Output qty</th>
                      <th>Ingredients</th>
                      <th>Notes</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fabricationFormulas.map((f) => (
                      <tr key={f.id} className="align-top">
                        <td className="font-semibold">{f.name}</td>
                        <td>
                          {f.outputItemName}
                          <br />
                          <span className="text-xs text-muted-foreground">{f.outputSku ?? "—"}</span>
                        </td>
                        <td className="tabular-nums">{fmtNum(f.outputQuantity, 4)}</td>
                        <td className="min-w-[320px]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                <th>Ingredient</th>
                                <th>Qty</th>
                                <th>Stock</th>
                              </tr>
                            </thead>
                            <tbody>
                              {f.lines.map((line) => (
                                <tr key={line.id ?? line.componentItemId}>
                                  <td>
                                    {line.componentName}
                                    <br />
                                    <span className="text-[11px] text-muted-foreground">
                                      {line.componentSku ?? "—"}
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap tabular-nums">
                                    {fmtNum(line.quantity, 4)} {line.unitOfMeasure ?? ""}
                                  </td>
                                  <td className="whitespace-nowrap tabular-nums">{fmtNum(line.currentStock, 4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                        <td className="max-w-xs text-muted-foreground">{f.notes || "—"}</td>
                        <td>
                          <span className={f.active ? "badge badge-success" : "badge badge-neutral"}>
                            {f.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "purchasing" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Purchase orders</h2>
            {poList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>PO</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {poList.map((p) => (
                    <tr key={p.poId}>
                      <td>{p.poNumber}</td>
                      <td>{p.supplierName}</td>
                      <td>{p.status}</td>
                      <td>{String(p.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="text-base font-semibold mb-2">Record purchase return (vendor return)</h3>
            <form onSubmit={submitPurchaseReturn} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
              <div>
                <label>PO id (UUID)</label>
                <input value={returnPoId} onChange={(e) => setReturnPoId(e.target.value)} placeholder="from list/API" />
              </div>
              <div>
                <label>PO line id</label>
                <input value={returnLineId} onChange={(e) => setReturnLineId(e.target.value)} />
              </div>
              <div>
                <label>Qty</label>
                <input value={returnQty} onChange={(e) => setReturnQty(e.target.value)} type="number" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="hms-btn-outline w-full text-sm">
                  Post return
                </button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Create purchase order</h2>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label>Supplier</label>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  <option value="">Choose supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Expected delivery</label>
                <input type="date" value={poExpectedDelivery} onChange={(e) => setPoExpectedDelivery(e.target.value)} />
              </div>
              <div>
                <label>Payment terms</label>
                <select value={poPaymentTerms} onChange={(e) => setPoPaymentTerms(e.target.value)}>
                  {["NET_7", "NET_15", "NET_30", "NET_60", "COD", "PREPAID"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label>Delivery instructions</label>
                <input value={poDeliveryInstructions} onChange={(e) => setPoDeliveryInstructions(e.target.value)} />
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="text-base font-semibold mb-2">PO line items</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label>Item</label>
                <select
                  value={poLineDraft.itemId}
                  onChange={(e) => setPoLineDraft((d) => ({ ...d, itemId: e.target.value }))}
                >
                  <option value="">Choose item...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku ?? "—"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Quantity</label>
                <input type="number" value={poLineDraft.quantity} onChange={(e) => setPoLineDraft((d) => ({ ...d, quantity: e.target.value }))} />
              </div>
              <div>
                <label>Unit price</label>
                <input type="number" value={poLineDraft.unitPrice} onChange={(e) => setPoLineDraft((d) => ({ ...d, unitPrice: e.target.value }))} />
              </div>
              <div className="flex items-end">
                <button type="button" className="hms-btn-outline w-full" onClick={addPoLine}>
                  Add line
                </button>
              </div>
            </div>
            {poLinePreview.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poLinePreview.map((l, idx) => (
                      <tr key={`${l.itemId}-${idx}`} className="border-t border-border/50">
                        <td>{l.itemName}</td>
                        <td>{l.sku}</td>
                        <td>{l.quantity}</td>
                        <td>{l.unitPrice}</td>
                        <td>{l.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3">
              <button
                type="button"
                className="hms-btn-solid"
                disabled={savingPo || poLines.length === 0 || !poSupplierId}
                onClick={() => void submitPurchaseOrder()}
              >
                {savingPo ? "Creating PO..." : "Create purchase order"}
              </button>
            </div>
          </div>

          {latestPo && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h3 className="text-base font-semibold">Latest PO: {latestPo.poNumber}</h3>
              <p className="text-sm text-muted-foreground">
                Status: {latestPo.status} · Total: {latestPo.totalAmount}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Ordered</th>
                      <th>Receive now</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {latestPo.lines.map((line, idx) => {
                      const inLine = latestPoInputLines[idx];
                      return (
                        <tr key={line.lineId} className="border-t border-border/50">
                          <td>
                            {line.itemName} ({line.sku})
                          </td>
                          <td>{line.quantity}</td>
                          <td style={{ maxWidth: 160 }}>
                            <input
                              type="number"
                              min="0"
                              max={Number(line.quantity) || undefined}
                              value={receiveLines[line.lineId] ?? ""}
                              onChange={(e) => setReceiveLines((m) => ({ ...m, [line.lineId]: e.target.value }))}
                            />
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Max: {fmtNum(line.quantity, 4)}
                            </p>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="hms-btn-outline text-xs"
                              disabled={receivingItemId === inLine?.itemId}
                              onClick={() => void receiveForLine(idx)}
                            >
                              {receivingItemId === inLine?.itemId ? "Receiving..." : "Receive"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "branches" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Warehouses / stores</h2>
            <div className="mb-3 max-h-80 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left">Name</th>
                    <th className="px-2 py-2 text-left">Code</th>
                    <th className="px-2 py-2 text-left">Address</th>
                    <th className="px-2 py-2 text-left">Default</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((w) => (
                    <tr key={w.id} className="border-t border-border/40">
                      <td className="px-2 py-2 font-medium">{w.name}</td>
                      <td className="px-2 py-2">{w.code}</td>
                      <td className="px-2 py-2 text-muted-foreground">{w.address?.trim() || "—"}</td>
                      <td className="px-2 py-2">{w.isDefault ? "Yes" : "—"}</td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            className="hms-btn-outline text-xs"
                            onClick={() => openEditWarehouse(w)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="hms-btn-outline text-xs text-red-700 disabled:opacity-40"
                            disabled={w.isDefault}
                            title={w.isDefault ? "Cannot delete the default warehouse" : "Delete warehouse"}
                            onClick={() => void deleteWarehouse(w)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {warehouses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                        No warehouses yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <form onSubmit={createWarehouse} className="grid grid-cols-1 gap-2">
              <input placeholder="Name" value={whForm.name} onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))} />
              <input placeholder="Code" value={whForm.code} onChange={(e) => setWhForm((f) => ({ ...f, code: e.target.value }))} />
              <input placeholder="Address" value={whForm.address} onChange={(e) => setWhForm((f) => ({ ...f, address: e.target.value }))} />
              <button type="submit" className="hms-btn-outline text-sm">
                Add warehouse
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Warehouses match menu outlets (Principal depot ↔ <strong>PRINCIPAL</strong> store). New stock products are
              added to Principal automatically. Completing a transfer reduces the source outlet stock and increases
              destination outlet stock. Deleting a warehouse also deactivates its linked outlet when one exists.
            </p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Stock transfer</h2>
            <form onSubmit={createTransfer} className="grid grid-cols-1 gap-2 text-sm">
              <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)}>
                <option value="">From…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select value={trTo} onChange={(e) => setTrTo(e.target.value)}>
                <option value="">To…</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select value={trItem} onChange={(e) => setTrItem(e.target.value)}>
                <option value="">Item…</option>
                {stockItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.sku ?? "—"})
                  </option>
                ))}
              </select>
              <input type="number" min="0.001" step="0.001" placeholder="Qty" value={trQty} onChange={(e) => setTrQty(e.target.value)} />
              {selectedTransferItem && (
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Current outlet stock for {selectedTransferItem.name}
                  </p>
                  {selectedTransferOutletBalances.length === 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      This product is not currently published to any outlet.
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedTransferOutletBalances.map((row) => (
                        <div key={row.depotId} className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                          <span className="text-muted-foreground">{row.depotName}</span>
                          <span className="font-semibold tabular-nums">{fmtNum(row.stockQty)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Example: if Principal has 100 and you transfer 40 to Bar, after completion this shows Principal 60
                    and Bar 40.
                  </p>
                </div>
              )}
              <button type="submit" className="hms-btn-solid text-sm">
                Create pending transfer
              </button>
            </form>
            <div className="mt-3 flex gap-2">
              <input placeholder="Transfer id to complete" value={trPendingId} onChange={(e) => setTrPendingId(e.target.value)} />
              <button type="button" className="hms-btn-outline text-sm" onClick={() => void completeTransfer()}>
                Complete transfer
              </button>
            </div>
            <h3 className="text-sm font-semibold mt-4 mb-1">Stock transfer report</h3>
            <div className="max-h-72 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-2 text-left">Transfer</th>
                    <th className="px-2 py-2 text-left">From</th>
                    <th className="px-2 py-2 text-left">To</th>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-right">Qty moved</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.flatMap((t) =>
                    (t.items ?? []).map((line, idx) => (
                      <tr key={`${t.id}-${line.itemId}-${idx}`} className="border-t border-border/40">
                        <td className="px-2 py-2 font-medium">{t.transferNumber}</td>
                        <td className="px-2 py-2">{t.fromWarehouse}</td>
                        <td className="px-2 py-2">{t.toWarehouse}</td>
                        <td className="px-2 py-2">
                          {line.itemName}
                          <span className="block text-muted-foreground">{line.sku}</span>
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtNum(line.quantity)}</td>
                        <td className="px-2 py-2">{t.status}</td>
                        <td className="px-2 py-2">
                          {t.completedAt ? new Date(t.completedAt).toLocaleString() : "Pending"}
                        </td>
                      </tr>
                    )),
                  )}
                  {transfers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                        No stock transfers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Edit warehouse</h3>
            <form onSubmit={saveEditWarehouse} className="grid grid-cols-1 gap-3 text-sm">
              <div>
                <label>Name</label>
                <input
                  value={editWhForm.name}
                  onChange={(e) => setEditWhForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Code</label>
                <input
                  value={editWhForm.code}
                  onChange={(e) => setEditWhForm((f) => ({ ...f, code: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Address</label>
                <input
                  value={editWhForm.address}
                  onChange={(e) => setEditWhForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editWhForm.isDefault}
                  disabled={editWarehouse.isDefault}
                  onChange={(e) => setEditWhForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Default warehouse
              </label>
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  onClick={() => setEditWarehouse(null)}
                  disabled={whSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="hms-btn-solid text-sm" disabled={whSaving}>
                  {whSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          {!alerts ? (
            <p className="text-sm text-muted-foreground">Loading alerts…</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-2">
                Low: {alerts.lowStockCount} · Out: {alerts.outOfStockCount} · Rows include expiry/overstock flags.
              </p>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Item</th>
                      <th>SKU</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(alerts.items ?? []).map((a, idx) => (
                      <tr key={`${a.itemId}-${a.alertType}-${idx}`}>
                        <td>{a.alertType}</td>
                        <td>{a.name}</td>
                        <td>{a.sku}</td>
                        <td>{String(a.currentStock)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "reports" && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-4">
          <p className="text-sm text-muted-foreground">
            Supplier directory: use the Products tab. Low-stock overlaps with Alerts.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["sales", "Sales (invoices)"],
                ["purchases", "Purchases"],
                ["stock", "Stock value"],
                ["profit", "Profit"],
                ["expired", "Expired products"],
                ["users", "User activity (movements)"],
                ["menu-sales", "Menu / POS sales"],
                ["valuation", "Valuation settings"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className="hms-btn-outline text-sm" onClick={() => void fetchReport(k)}>
                {label}
              </button>
            ))}
          </div>

          {!reportKind && <p className="text-sm text-muted-foreground">Choose a report above.</p>}

          {reportKind === "sales" && salesReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Period</p>
                  <p className="font-medium">
                    {salesReport.fromDate} → {salesReport.toDate}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Total revenue</p>
                  <p className="text-xl font-semibold">{fmtNum(salesReport.totalRevenue)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Total paid</p>
                  <p className="text-xl font-semibold">{fmtNum(salesReport.totalPaid)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Invoices</p>
                  <p className="text-xl font-semibold">{salesReport.invoiceCount}</p>
                </div>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Invoice</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Customer</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesReport.lines ?? []).map((r) => (
                      <tr key={r.invoiceId} className="border-t border-border/40">
                        <td>{r.invoiceNumber}</td>
                        <td>{r.invoiceDate}</td>
                        <td>{r.customerName}</td>
                        <td className="text-right">{fmtNum(r.totalAmount)}</td>
                        <td className="text-right">{fmtNum(r.amountPaid)}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportKind === "purchases" && purchaseReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Period</p>
                  <p className="font-medium">
                    {purchaseReport.fromDate} → {purchaseReport.toDate}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Total purchases</p>
                  <p className="text-xl font-semibold">{fmtNum(purchaseReport.totalPurchases)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">PO count</p>
                  <p className="text-xl font-semibold">{purchaseReport.poCount}</p>
                </div>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">PO</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Supplier</th>
                      <th className="text-right">Amount</th>
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(purchaseReport.lines ?? []).map((r) => (
                      <tr key={r.poId} className="border-t border-border/40">
                        <td>{r.poNumber}</td>
                        <td>{r.orderDate}</td>
                        <td>{r.supplierName}</td>
                        <td className="text-right">{fmtNum(r.totalAmount)}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportKind === "stock" && stockReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Grand total value</p>
                  <p className="text-2xl font-bold">{fmtNum(stockReport.grandTotal)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Line items</p>
                  <p className="text-2xl font-bold">{stockReport.itemCount}</p>
                </div>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Product</th>
                      <th className="text-left">SKU</th>
                      <th className="text-left">Category</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit cost</th>
                      <th className="text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stockReport.items ?? []).map((r) => (
                      <tr key={r.id} className="border-t border-border/40">
                        <td>{r.name}</td>
                        <td>{r.sku}</td>
                        <td>{r.category ?? "—"}</td>
                        <td className="text-right">{fmtNum(r.currentStock, 4)}</td>
                        <td className="text-right">{fmtNum(r.unitCost)}</td>
                        <td className="text-right font-medium">{fmtNum(r.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportKind === "profit" && profitReport && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Period</p>
                  <p className="font-medium">
                    {profitReport.fromDate} → {profitReport.toDate}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Revenue</p>
                  <p className="text-xl font-semibold">{fmtNum(profitReport.totalRevenue)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Est. cost</p>
                  <p className="text-xl font-semibold">{fmtNum(profitReport.totalCost)}</p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-muted-foreground text-xs">Profit</p>
                  <p className="text-xl font-semibold text-emerald-700">{fmtNum(profitReport.totalProfit)}</p>
                </div>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Invoice</th>
                      <th className="text-left">Date</th>
                      <th className="text-left">Customer</th>
                      <th className="text-right">Revenue</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profitReport.lines ?? []).map((r) => (
                      <tr key={r.invoiceId} className="border-t border-border/40">
                        <td>{r.invoiceNumber}</td>
                        <td>{r.invoiceDate}</td>
                        <td>{r.customerName}</td>
                        <td className="text-right">{fmtNum(r.revenue)}</td>
                        <td className="text-right">{fmtNum(r.estimatedCost)}</td>
                        <td className="text-right font-medium">{fmtNum(r.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportKind === "expired" && expiredReport && (
            <div className="max-h-96 overflow-auto">
              {expiredReport.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expired products in stock.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Product</th>
                      <th className="text-left">SKU</th>
                      <th className="text-left">Expiry</th>
                      <th className="text-right">Qty on hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiredReport.map((r) => (
                      <tr key={r.itemId} className="border-t border-border/40">
                        <td>{r.name}</td>
                        <td>{r.sku}</td>
                        <td>{r.expiryDate}</td>
                        <td className="text-right">{fmtNum(r.currentStock, 4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {reportKind === "users" && userActivityReport && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">User</th>
                    <th className="text-right">Movement rows (sample)</th>
                  </tr>
                </thead>
                <tbody>
                  {userActivityReport.map((r) => (
                    <tr key={r.username} className="border-t border-border/40">
                      <td>{r.username}</td>
                      <td className="text-right">{r.movementCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportKind === "menu-sales" && menuSalesReport && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end gap-2 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Outlet (depot)</label>
                  <select
                    className="min-w-[200px]"
                    value={menuSalesDepotId}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMenuSalesDepotId(v);
                      void fetchReport("menu-sales", { menuDepotId: v });
                    }}
                  >
                    <option value="">All outlets</option>
                    {menuOutlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.warehouseCode ? ` (${o.warehouseCode})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground pb-1">
                  From{" "}
                  <Link href={staffAppPath("menu")} className="underline">
                    Menu
                  </Link>{" "}
                  / self-order POS sales.
                </p>
              </div>
              <div className="max-h-96 overflow-auto">
                {menuSalesReport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No menu sales loaded.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="text-left">Sale #</th>
                        <th className="text-left">Outlet</th>
                        <th className="text-left">Customer</th>
                        <th className="text-right">Total</th>
                        <th className="text-left">Sold at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuSalesReport.map((r) => (
                        <tr key={r.saleId} className="border-t border-border/40">
                          <td>{r.saleNumber}</td>
                          <td>{r.depotName}</td>
                          <td>{r.customerName?.trim() || "Walk-in"}</td>
                          <td className="text-right">{fmtNum(r.totalAmount)}</td>
                          <td>{new Date(r.soldAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {reportKind === "valuation" && valuationReport && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {Object.entries(valuationReport).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border/60 p-3">
                  <dt className="text-muted-foreground text-xs capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="font-medium mt-1">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {tab === "waste" && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Waste / consumption log</h2>
          <p className="text-sm text-muted-foreground mb-3">Session log from consumptions in this workspace.</p>
          {wasteLog.length === 0 ? (
            <p className="text-muted-foreground">No events yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {wasteLog.map((w) => (
                  <tr key={w.id}>
                    <td>{new Date(w.at).toLocaleString()}</td>
                    <td>{w.itemName}</td>
                    <td>{w.sku}</td>
                    <td>{w.quantity}</td>
                    <td>{w.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
  );
}
