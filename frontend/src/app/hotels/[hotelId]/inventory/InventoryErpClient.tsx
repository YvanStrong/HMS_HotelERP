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
};

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

type DepotMenuSaleRow = {
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName?: string | null;
  totalAmount: number | string;
  soldAt: string;
};

const PAGE_SIZE = 12;

type Tab =
  | "overview"
  | "catalog"
  | "stock"
  | "purchasing"
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
  const [consumeId, setConsumeId] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", contactPerson: "", email: "", phone: "" });
  const [itemForm, setItemForm] = useState({
    name: "",
    categoryId: "",
    currentStock: "",
    reorderPoint: "",
    unitCost: "",
    unitOfMeasure: "piece",
    description: "",
    barcode: "",
    sellingPrice: "",
    imageUrl: "",
    expiryDate: "",
  });
  const [consume, setConsume] = useState<Record<string, string>>({});
  const [wasteLog, setWasteLog] = useState<
    { id: string; itemName: string; sku: string; quantity: number; reason: string; at: string }[]
  >([]);

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
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [supplierDetails, setSupplierDetails] = useState<SupplierDetail[]>([]);

  const [adjust, setAdjust] = useState({ itemId: "", type: "ADD", quantity: "", newQty: "", reason: "" });
  const [returnPoId, setReturnPoId] = useState("");
  const [returnLineId, setReturnLineId] = useState("");
  const [returnQty, setReturnQty] = useState("");

  const [whForm, setWhForm] = useState({ name: "", code: "", address: "" });
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
  const [editItem, setEditItem] = useState<ItemRow | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    barcode: "",
    sellingPrice: "",
    unitCost: "",
    reorderPoint: "",
    imageUrl: "",
    expiryDate: "",
    active: true,
    unitOfMeasure: "piece",
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
      const [dash, mov, pos, wh, outlets, trf, supD] = await Promise.all([
        apiFetch<DashboardPayload>(`/api/v1/hotels/${hotelId}/inventory/dashboard`),
        apiFetch<MovementRow[]>(`/api/v1/hotels/${hotelId}/inventory/movements?limit=150`),
        apiFetch<PoSummary[]>(`/api/v1/hotels/${hotelId}/inventory/purchase-orders`),
        apiFetch<WarehouseRow[]>(`/api/v1/hotels/${hotelId}/inventory/warehouses`),
        apiFetch<MenuOutletRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`).catch(() => []),
        apiFetch<TransferRow[]>(`/api/v1/hotels/${hotelId}/inventory/stock-transfers`),
        apiFetch<SupplierDetail[]>(`/api/v1/hotels/${hotelId}/inventory/suppliers/detail`).catch(() => []),
      ]);
      setDashboard(dash);
      setMovements(mov ?? []);
      setPoList(pos ?? []);
      setWarehouses(wh ?? []);
      setMenuOutlets(Array.isArray(outlets) ? outlets : []);
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
      tab === "waste"
    ) {
      void loadExtensions();
    }
    if (tab === "alerts") void loadAlerts();
  }, [tab, loadExtensions, loadAlerts]);

  const items = useMemo(() => payload?.data ?? [], [payload?.data]);
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
          currentStock: itemForm.currentStock ? Number(itemForm.currentStock) : 0,
          reorderPoint: itemForm.reorderPoint ? Number(itemForm.reorderPoint) : 0,
          unitCost: itemForm.unitCost ? Number(itemForm.unitCost) : 0,
          unitOfMeasure: itemForm.unitOfMeasure || "piece",
          isMinibarItem: false,
          description: itemForm.description.trim() || null,
          barcode: itemForm.barcode.trim() || null,
          sellingPrice: itemForm.sellingPrice ? Number(itemForm.sellingPrice) : null,
          imageUrl: itemForm.imageUrl.trim() || null,
          expiryDate: itemForm.expiryDate || null,
          manufactureDate: null,
        }),
      });
      setMsg("Product created (SKU assigned automatically).");
      setItemForm((f) => ({
        ...f,
        name: "",
        currentStock: "",
        reorderPoint: "",
        unitCost: "",
        description: "",
        barcode: "",
        sellingPrice: "",
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

  async function consumeStock(itemId: string) {
    const raw = consume[itemId];
    const qty = Number(raw);
    if (!raw || Number.isNaN(qty) || qty <= 0) {
      setError("Enter a valid consume quantity.");
      return;
    }
    setConsumeId(itemId);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/items/${itemId}/consume`, {
        method: "POST",
        body: JSON.stringify({ quantity: qty, type: "CONSUMPTION", autoReorderCheck: true }),
      });
      setMsg("Stock consumed.");
      setConsume((m) => ({ ...m, [itemId]: "" }));
      const item = items.find((it) => it.id === itemId);
      if (item) {
        setWasteLog((w) => [
          {
            id: crypto.randomUUID(),
            itemName: item.name,
            sku: item.sku ?? "—",
            quantity: qty,
            reason: "Consumption/Waste recorded",
            at: new Date().toISOString(),
          },
          ...w,
        ]);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Consume failed");
    } finally {
      setConsumeId(null);
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
      setMsg("Transfer completed (logged; hotel-wide quantity unchanged).");
      void loadExtensions();
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
      imageUrl: (it.imageUrl as string) ?? "",
      expiryDate: (it.expiryDate as string) ?? "",
      active: it.active !== false,
      unitOfMeasure: it.unitOfMeasure?.trim() || "piece",
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
          unitCost: editForm.unitCost ? Number(editForm.unitCost) : null,
          reorderPoint: editForm.reorderPoint ? Number(editForm.reorderPoint) : null,
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
                  <th>Qty</th>
                  <th>Consume</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.sku ?? "—"}</td>
                    <td className="text-xs">{r.barcode ?? "—"}</td>
                    <td>{r.currentStock ?? "—"}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={consume[r.id] ?? ""}
                          onChange={(e) => setConsume((m) => ({ ...m, [r.id]: e.target.value }))}
                          style={{ width: 90 }}
                          placeholder="qty"
                        />
                        <button
                          type="button"
                          className="hms-btn-outline text-xs"
                          disabled={consumeId === r.id}
                          onClick={() => void consumeStock(r.id)}
                        >
                          {consumeId === r.id ? "..." : "Consume"}
                        </button>
                      </div>
                    </td>
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
                    <label>Description</label>
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
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
                    <label>Reorder point</label>
                    <input
                      type="number"
                      value={editForm.reorderPoint}
                      onChange={(e) => setEditForm((f) => ({ ...f, reorderPoint: e.target.value }))}
                    />
                  </div>
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
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.sku})
                    </option>
                  ))}
                </select>
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
                              value={receiveLines[line.lineId] ?? ""}
                              onChange={(e) => setReceiveLines((m) => ({ ...m, [line.lineId]: e.target.value }))}
                            />
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
            <ul className="text-sm space-y-1 mb-3">
              {warehouses.map((w) => (
                <li key={w.id}>
                  {w.name} ({w.code}){w.isDefault ? " · default" : ""}
                </li>
              ))}
            </ul>
            <form onSubmit={createWarehouse} className="grid grid-cols-1 gap-2">
              <input placeholder="Name" value={whForm.name} onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))} />
              <input placeholder="Code" value={whForm.code} onChange={(e) => setWhForm((f) => ({ ...f, code: e.target.value }))} />
              <input placeholder="Address" value={whForm.address} onChange={(e) => setWhForm((f) => ({ ...f, address: e.target.value }))} />
              <button type="submit" className="hms-btn-outline text-sm">
                Add warehouse
              </button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Warehouses match{" "}
              <Link href={staffAppPath("menu")} className="underline">
                Menu
              </Link>{" "}
              outlets (Principal depot ↔ <strong>PRINCIPAL</strong> store). Use <strong>Create default outlets</strong> on
              Menu if links are missing. Transfers log movement between branches; hotel-wide SKU quantity stays the same
              until per-location stock is modeled.
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
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <input type="number" placeholder="Qty" value={trQty} onChange={(e) => setTrQty(e.target.value)} />
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
            <h3 className="text-sm font-semibold mt-4 mb-1">History</h3>
            <div className="max-h-48 overflow-auto text-xs">
              {transfers.map((t) => (
                <div key={t.id} className="border-b border-border/40 py-1">
                  {t.transferNumber} {t.status} · {t.fromWarehouse} → {t.toWarehouse}
                </div>
              ))}
            </div>
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
