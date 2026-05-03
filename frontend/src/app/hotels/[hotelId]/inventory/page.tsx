"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type ItemRow = {
  id: string;
  name: string;
  sku?: string;
  currentStock?: number | string;
  category?: string;
  reorderPoint?: number | string;
  unitCost?: number | string;
  status?: string;
};

type ItemsSummary = {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number | string;
};
type ItemsPayload = { data?: ItemRow[]; summary?: ItemsSummary };
type CategoryRow = { id: string; name: string; code: string };
type SupplierRow = { id: string; name: string };
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

const PAGE_SIZE = 12;

export default function InventoryPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [tab, setTab] = useState<"stock" | "po" | "suppliers" | "waste">("stock");
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
  const [categoryForm, setCategoryForm] = useState({ name: "", code: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", contactPerson: "", email: "", phone: "" });
  const [itemForm, setItemForm] = useState({
    name: "",
    sku: "",
    categoryId: "",
    currentStock: "",
    reorderPoint: "",
    unitCost: "",
    unitOfMeasure: "piece",
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

  useEffect(() => {
    void load();
  }, [load]);

  const items = payload?.data ?? [];
  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(items, page, PAGE_SIZE),
    [items, page],
  );

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.code.trim()) {
      setError("Category name and code are required.");
      return;
    }
    setSavingCategory(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/categories`, {
        method: "POST",
        body: JSON.stringify({ name: categoryForm.name.trim(), code: categoryForm.code.trim().toUpperCase() }),
      });
      setMsg("Category created.");
      setCategoryForm({ name: "", code: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create category failed");
    } finally {
      setSavingCategory(false);
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.name.trim() || !itemForm.sku.trim() || !itemForm.categoryId) {
      setError("Item name, SKU, and category are required.");
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
          sku: itemForm.sku.trim().toUpperCase(),
          categoryId: itemForm.categoryId,
          currentStock: itemForm.currentStock ? Number(itemForm.currentStock) : 0,
          reorderPoint: itemForm.reorderPoint ? Number(itemForm.reorderPoint) : 0,
          unitCost: itemForm.unitCost ? Number(itemForm.unitCost) : 0,
          unitOfMeasure: itemForm.unitOfMeasure || "piece",
          isMinibarItem: false,
        }),
      });
      setMsg("Inventory item created.");
      setItemForm((f) => ({ ...f, name: "", sku: "", currentStock: "", reorderPoint: "", unitCost: "" }));
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
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground mt-1">Stock, purchase orders, suppliers, and waste in one workspace</p>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={tab === "stock" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("stock")}>
            Stock Levels
          </button>
          <button type="button" className={tab === "po" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("po")}>
            Purchase Orders
          </button>
          <button type="button" className={tab === "suppliers" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("suppliers")}>
            Suppliers
          </button>
          <button type="button" className={tab === "waste" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"} onClick={() => setTab("waste")}>
            Waste Log
          </button>
        </div>
      </div>

      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      {tab === "stock" && (
      <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Items</p><p className="text-2xl font-bold">{payload.summary?.totalItems ?? 0}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Low stock</p><p className="text-2xl font-bold text-amber-700">{payload.summary?.lowStockCount ?? 0}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Out of stock</p><p className="text-2xl font-bold text-red-600">{payload.summary?.outOfStockCount ?? 0}</p></div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">Stock value</p><p className="text-2xl font-bold">{String(payload.summary?.totalValue ?? 0)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Create category</h2>
          <form onSubmit={createCategory} className="grid grid-cols-2 gap-3">
            <div><label>Name</label><input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label>Code</label><input value={categoryForm.code} onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))} /></div>
            <div className="col-span-2"><button type="submit" className="hms-btn-outline text-sm" disabled={savingCategory}>{savingCategory ? "Creating..." : "Create category"}</button></div>
          </form>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Create item</h2>
          <form onSubmit={createItem} className="grid grid-cols-2 gap-3">
            <div><label>Name</label><input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><label>SKU</label><input value={itemForm.sku} onChange={(e) => setItemForm((f) => ({ ...f, sku: e.target.value }))} /></div>
            <div><label>Category</label><select value={itemForm.categoryId} onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}</select></div>
            <div><label>Unit</label><input value={itemForm.unitOfMeasure} onChange={(e) => setItemForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} /></div>
            <div><label>Opening stock</label><input type="number" value={itemForm.currentStock} onChange={(e) => setItemForm((f) => ({ ...f, currentStock: e.target.value }))} /></div>
            <div><label>Reorder point</label><input type="number" value={itemForm.reorderPoint} onChange={(e) => setItemForm((f) => ({ ...f, reorderPoint: e.target.value }))} /></div>
            <div><label>Unit cost</label><input type="number" value={itemForm.unitCost} onChange={(e) => setItemForm((f) => ({ ...f, unitCost: e.target.value }))} /></div>
            <div className="col-span-2"><button type="submit" className="hms-btn-solid" disabled={savingItem}>{savingItem ? "Creating..." : "Create item"}</button></div>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2"><label>Search</label><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, SKU..." /></div>
          <div><label>Category</label><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}</select></div>
          <div className="flex items-end gap-2">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} /> Low stock only</label>
            <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>
      </div>

      {payload && (
        <div className="panel rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p style={{ color: "var(--muted)", marginTop: 0 }}>{items.length} item(s)</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Qty</th>
                <th>Consume</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.sku ?? "—"}</td>
                  <td>{r.category ?? "—"}</td>
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
      )}
      </>
      )}

      {tab === "suppliers" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Create supplier</h2>
            <form onSubmit={createSupplier} className="grid grid-cols-1 gap-3">
              <div><label>Name</label><input value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><label>Contact person</label><input value={supplierForm.contactPerson} onChange={(e) => setSupplierForm((f) => ({ ...f, contactPerson: e.target.value }))} /></div>
              <div><label>Email</label><input value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div><label>Phone</label><input value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div><button type="submit" className="hms-btn-solid" disabled={savingSupplier}>{savingSupplier ? "Creating..." : "Create supplier"}</button></div>
            </form>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Supplier directory</h2>
            {suppliers.length === 0 ? (
              <p className="text-muted-foreground">No suppliers created yet.</p>
            ) : (
              <table>
                <thead><tr><th>Name</th></tr></thead>
                <tbody>
                  {suppliers.map((s) => <tr key={s.id}><td>{s.name}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "po" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold mb-3">Create purchase order</h2>
            <form className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label>Supplier</label>
                <select value={poSupplierId} onChange={(e) => setPoSupplierId(e.target.value)}>
                  <option value="">Choose supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label>Expected delivery</label><input type="date" value={poExpectedDelivery} onChange={(e) => setPoExpectedDelivery(e.target.value)} /></div>
              <div>
                <label>Payment terms</label>
                <select value={poPaymentTerms} onChange={(e) => setPoPaymentTerms(e.target.value)}>
                  {["NET_7","NET_15","NET_30","NET_60","COD","PREPAID"].map((t)=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="md:col-span-3"><label>Delivery instructions</label><input value={poDeliveryInstructions} onChange={(e) => setPoDeliveryInstructions(e.target.value)} /></div>
            </form>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <h3 className="text-base font-semibold mb-2">PO line items</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label>Item</label>
                <select value={poLineDraft.itemId} onChange={(e) => setPoLineDraft((d) => ({ ...d, itemId: e.target.value }))}>
                  <option value="">Choose item...</option>
                  {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.sku ?? "—"})</option>)}
                </select>
              </div>
              <div><label>Quantity</label><input type="number" value={poLineDraft.quantity} onChange={(e) => setPoLineDraft((d) => ({ ...d, quantity: e.target.value }))} /></div>
              <div><label>Unit price</label><input type="number" value={poLineDraft.unitPrice} onChange={(e) => setPoLineDraft((d) => ({ ...d, unitPrice: e.target.value }))} /></div>
              <div className="flex items-end"><button type="button" className="hms-btn-outline w-full" onClick={addPoLine}>Add line</button></div>
            </div>
            {poLinePreview.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
                  <tbody>
                    {poLinePreview.map((l, idx) => (
                      <tr key={`${l.itemId}-${idx}`} className="border-t border-border/50">
                        <td>{l.itemName}</td><td>{l.sku}</td><td>{l.quantity}</td><td>{l.unitPrice}</td><td>{l.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-3">
              <button type="button" className="hms-btn-solid" disabled={savingPo || poLines.length === 0 || !poSupplierId} onClick={() => void submitPurchaseOrder()}>
                {savingPo ? "Creating PO..." : "Create purchase order"}
              </button>
            </div>
          </div>

          {latestPo && (
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <h3 className="text-base font-semibold">Latest PO: {latestPo.poNumber}</h3>
              <p className="text-sm text-muted-foreground">Status: {latestPo.status} · Total: {latestPo.totalAmount}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr><th>Item</th><th>Ordered</th><th>Receive now</th><th /></tr></thead>
                  <tbody>
                    {latestPo.lines.map((line, idx) => {
                      const inLine = latestPoInputLines[idx];
                      return (
                        <tr key={line.lineId} className="border-t border-border/50">
                          <td>{line.itemName} ({line.sku})</td>
                          <td>{line.quantity}</td>
                          <td style={{ maxWidth: 160 }}>
                            <input type="number" value={receiveLines[line.lineId] ?? ""} onChange={(e) => setReceiveLines((m) => ({ ...m, [line.lineId]: e.target.value }))} />
                          </td>
                          <td>
                            <button type="button" className="hms-btn-outline text-xs" disabled={receivingItemId === inLine?.itemId} onClick={() => void receiveForLine(idx)}>
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

      {tab === "waste" && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Waste / consumption log</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Tracks consumptions posted from this workspace session for operational review.
          </p>
          {wasteLog.length === 0 ? (
            <p className="text-muted-foreground">No waste/consumption events recorded yet.</p>
          ) : (
            <table>
              <thead><tr><th>When</th><th>Item</th><th>SKU</th><th>Qty</th><th>Reason</th></tr></thead>
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
