"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

type DepotRow = { id: string; name: string; code: string; depotType: string; active: boolean };
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
  taxable: boolean;
  active: boolean;
};
type CreateProductResponse = {
  id: string;
  autoProductNumber: number;
  autoProductCode: string;
  message: string;
  product: DepotProductRow;
};
type PatchProductPayload = {
  productName?: string;
  batchNo?: string;
  expiryDate?: string | null;
  costPrice?: number;
  sellingPrice?: number;
  stockQty?: number;
  stockType?: "STOCK" | "NON_STOCK";
  photoUrl?: string | null;
  menuName?: string;
  taxable?: boolean;
  active?: boolean;
};

const DEFAULT_DEPOT_TYPES = ["RESTAURANT", "BAR", "CUISINE", "PRINCIPAL", "BARISTA", "PATISSERIE", "OTHER"] as const;

type ProductForm = {
  depotId: string;
  productName: string;
  batchNo: string;
  expiryDate: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  stockType: "STOCK" | "NON_STOCK";
  photoUrl: string;
  menuName: string;
  taxable: boolean;
};
type EditProductForm = {
  productName: string;
  batchNo: string;
  expiryDate: string;
  costPrice: string;
  sellingPrice: string;
  stockQty: string;
  stockType: "STOCK" | "NON_STOCK";
  photoUrl: string;
  menuName: string;
  taxable: boolean;
};

export default function InventoryPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [error, setError] = useState<string | null>(null);
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [products, setProducts] = useState<DepotProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [newDepotName, setNewDepotName] = useState("");
  const [newDepotType, setNewDepotType] = useState<string>("RESTAURANT");

  const [productForm, setProductForm] = useState<ProductForm>({
    depotId: "",
    productName: "",
    batchNo: "NA",
    expiryDate: "",
    costPrice: "",
    sellingPrice: "",
    stockQty: "0",
    stockType: "STOCK",
    photoUrl: "",
    menuName: "GENERAL",
    taxable: true,
  });

  const [createdInfo, setCreatedInfo] = useState<{ number: number; code: string } | null>(null);
  const [patchingProductId, setPatchingProductId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<DepotProductRow | null>(null);
  const [editForm, setEditForm] = useState<EditProductForm>({
    productName: "",
    batchNo: "NA",
    expiryDate: "",
    costPrice: "",
    sellingPrice: "",
    stockQty: "0",
    stockType: "STOCK",
    photoUrl: "",
    menuName: "GENERAL",
    taxable: true,
  });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([
        apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots`),
        apiFetch<DepotProductRow[]>(`/api/v1/hotels/${hotelId}/inventory/depot-products`),
      ]);
      setDepots(d);
      setProducts(p);
      if (!productForm.depotId && d.length > 0) {
        setProductForm((prev) => ({ ...prev, depotId: d[0].id }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory");
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

  async function bootstrapDepots() {
    setError(null);
    try {
      await apiFetch<DepotRow[]>(`/api/v1/hotels/${hotelId}/inventory/depots/bootstrap`, { method: "POST" });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to bootstrap depots");
    }
  }

  async function createDepot() {
    if (!newDepotName.trim()) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/depots`, {
        method: "POST",
        body: JSON.stringify({ name: newDepotName.trim(), depotType: newDepotType }),
      });
      setNewDepotName("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create depot");
    }
  }

  async function createProduct() {
    if (!productForm.depotId || !productForm.productName.trim()) return;
    setError(null);
    setCreatedInfo(null);
    const desiredStockType = productForm.stockType;
    try {
      const res = await apiFetch<CreateProductResponse>(`/api/v1/hotels/${hotelId}/inventory/depot-products`, {
        method: "POST",
        body: JSON.stringify({
          depotId: productForm.depotId,
          productName: productForm.productName.trim(),
          batchNo: productForm.batchNo.trim() || "NA",
          expiryDate: productForm.expiryDate || null,
          costPrice: Number(productForm.costPrice || "0"),
          sellingPrice: Number(productForm.sellingPrice || "0"),
          stockQty: productForm.stockType === "NON_STOCK" ? 0 : Number(productForm.stockQty || "0"),
          stockType: productForm.stockType,
          photoUrl: productForm.photoUrl || null,
          menuName: productForm.menuName.trim() || "GENERAL",
          taxable: productForm.taxable,
        }),
      });
      // Safety fallback: if backend persisted STOCK unexpectedly, force requested type immediately.
      if (desiredStockType === "NON_STOCK" && res.product?.stockType !== "NON_STOCK") {
        await apiFetch<DepotProductRow>(`/api/v1/hotels/${hotelId}/inventory/depot-products/${res.id}`, {
          method: "PATCH",
          body: JSON.stringify({ stockType: "NON_STOCK" }),
        });
      }
      setCreatedInfo({ number: res.autoProductNumber, code: res.autoProductCode });
      setProductForm((prev) => ({
        ...prev,
        productName: "",
        batchNo: "NA",
        expiryDate: "",
        costPrice: "",
        sellingPrice: "",
        stockQty: "0",
        stockType: "STOCK",
        photoUrl: "",
        taxable: true,
      }));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product");
    }
  }

  async function patchProductStockType(productId: string, stockType: "STOCK" | "NON_STOCK") {
    setPatchingProductId(productId);
    setError(null);
    try {
      await apiFetch<DepotProductRow>(`/api/v1/hotels/${hotelId}/inventory/depot-products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ stockType }),
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update product");
    } finally {
      setPatchingProductId(null);
    }
  }

  async function patchProduct(productId: string, payload: PatchProductPayload) {
    setPatchingProductId(productId);
    setError(null);
    try {
      await apiFetch<DepotProductRow>(`/api/v1/hotels/${hotelId}/inventory/depot-products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update product");
    } finally {
      setPatchingProductId(null);
    }
  }

  async function onAddQty(p: DepotProductRow) {
    if (p.stockType !== "STOCK") {
      setError("Add Qty works only for STOCK products.");
      return;
    }
    const raw = window.prompt(`Add quantity to ${p.productName}`, "1");
    if (!raw) return;
    const inc = Number(raw);
    if (!Number.isFinite(inc) || inc <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }
    await patchProduct(p.id, { stockQty: Number((Number(p.stockQty) + inc).toFixed(3)) });
  }

  async function onEditProduct(p: DepotProductRow) {
    setEditingProduct(p);
    setEditForm({
      productName: p.productName,
      batchNo: p.batchNo || "NA",
      expiryDate: p.expiryDate || "",
      costPrice: String(p.costPrice),
      sellingPrice: String(p.sellingPrice),
      stockQty: String(p.stockQty),
      stockType: p.stockType,
      photoUrl: p.photoUrl || "",
      menuName: p.menuName,
      taxable: p.taxable !== false,
    });
  }

  async function onSleepProduct(p: DepotProductRow) {
    const confirmed = window.confirm(`Sleep product "${p.productName}"? It will become inactive.`);
    if (!confirmed) return;
    await patchProduct(p.id, { active: false });
  }

  async function onActivateProduct(p: DepotProductRow) {
    const confirmed = window.confirm(`Activate product "${p.productName}"?`);
    if (!confirmed) return;
    await patchProduct(p.id, { active: true });
  }

  async function saveEditProduct() {
    if (!editingProduct) return;
    const cost = Number(editForm.costPrice);
    const selling = Number(editForm.sellingPrice);
    const stockQty = Number(editForm.stockQty || "0");
    if (!editForm.productName.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!Number.isFinite(cost) || !Number.isFinite(selling)) {
      setError("Cost and selling price must be valid numbers.");
      return;
    }
    if (editForm.stockType === "STOCK" && (!Number.isFinite(stockQty) || stockQty < 0)) {
      setError("Stock quantity must be a valid number.");
      return;
    }
    await patchProduct(editingProduct.id, {
      productName: editForm.productName.trim(),
      batchNo: editForm.batchNo.trim() || "NA",
      expiryDate: editForm.expiryDate || null,
      costPrice: cost,
      sellingPrice: selling,
      stockType: editForm.stockType,
      ...(editForm.stockType === "STOCK" ? { stockQty } : {}),
      photoUrl: editForm.photoUrl.trim() || null,
      menuName: editForm.menuName.trim() || "GENERAL",
      taxable: editForm.taxable,
    });
    setEditingProduct(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Management</h1>
          <p className="text-muted-foreground text-sm">
            Manage depots and products. Use Services {'>'} Menu to sell products to client.
          </p>
        </div>
        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void loadAll()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="hms-section-card space-y-4">
        <div className="hms-section-head">
          <h2 className="hms-section-title">Depots</h2>
          <button type="button" className="hms-btn-solid hms-btn-sm" onClick={bootstrapDepots}>
            Bootstrap default depots
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <input value={newDepotName} onChange={(e) => setNewDepotName(e.target.value)} placeholder="Depot name" />
          <select value={newDepotType} onChange={(e) => setNewDepotType(e.target.value)}>
            {DEFAULT_DEPOT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="button" className="hms-btn-solid" onClick={createDepot}>Add depot</button>
        </div>

        <div className="hms-table-wrap">
          <table className="hms-table">
            <thead>
              <tr><th>Name</th><th>Code</th><th>Type</th><th>Status</th></tr>
            </thead>
            <tbody>
              {depots.map((d) => (
                <tr key={d.id}><td>{d.name}</td><td>{d.code}</td><td>{d.depotType}</td><td>{d.active ? "Active" : "Inactive"}</td></tr>
              ))}
              {depots.length === 0 && <tr><td colSpan={4} className="text-muted-foreground text-center">No depots yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hms-section-card space-y-4">
        <h2 className="hms-section-title">Add Product</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <select value={productForm.depotId} onChange={(e) => setProductForm((p) => ({ ...p, depotId: e.target.value }))}>
            <option value="">Select depot</option>
            {depots.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input value={productForm.productName} onChange={(e) => setProductForm((p) => ({ ...p, productName: e.target.value }))} placeholder="ProductName e.g. FANTA" />
          <input value={productForm.menuName} onChange={(e) => setProductForm((p) => ({ ...p, menuName: e.target.value }))} placeholder="Menu e.g. DRINKS" />
          <input value={productForm.batchNo} onChange={(e) => setProductForm((p) => ({ ...p, batchNo: e.target.value }))} placeholder="BatchNo (NA default)" />
          <input type="date" value={productForm.expiryDate} onChange={(e) => setProductForm((p) => ({ ...p, expiryDate: e.target.value }))} />
          <input type="number" step="0.01" value={productForm.costPrice} onChange={(e) => setProductForm((p) => ({ ...p, costPrice: e.target.value }))} placeholder="CostPrice" />
          <input type="number" step="0.01" value={productForm.sellingPrice} onChange={(e) => setProductForm((p) => ({ ...p, sellingPrice: e.target.value }))} placeholder="SellingPrice" />
          <select
            value={productForm.stockType}
            onChange={(e) =>
              setProductForm((p) => ({
                ...p,
                stockType: e.target.value as "STOCK" | "NON_STOCK",
                stockQty: e.target.value === "NON_STOCK" ? "0" : p.stockQty,
              }))
            }
          >
            <option value="STOCK">STOCK</option>
            <option value="NON_STOCK">NON STOCK</option>
          </select>
          {productForm.stockType === "STOCK" ? (
            <input type="number" step="0.001" value={productForm.stockQty} onChange={(e) => setProductForm((p) => ({ ...p, stockQty: e.target.value }))} placeholder="Initial stock" />
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Non stock product: stock field hidden
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm md:col-span-1">
            <input
              type="checkbox"
              checked={productForm.taxable}
              onChange={(e) => setProductForm((p) => ({ ...p, taxable: e.target.checked }))}
            />
            <span>Taxable (18% VAT on receipt)</span>
          </label>
          <button type="button" className="hms-btn-solid" onClick={createProduct}>Save product</button>
        </div>

        <ImageUpload value={productForm.photoUrl} onChange={(url) => setProductForm((p) => ({ ...p, photoUrl: url }))} label="Photo" placeholder="Paste photo URL or upload" />

        {createdInfo && (
          <p className="text-sm text-green-700">
            Auto Product Number: <strong>{createdInfo.number}</strong> | Auto Code: <strong>{createdInfo.code}</strong>
          </p>
        )}
      </section>

      <section className="hms-section-card">
        <h2 className="hms-section-title mb-3">Products</h2>
        <p className="text-xs text-muted-foreground mb-2">
          If Menu shows &quot;Stock 0&quot; but the item is prepared to order (no stock count), set Stock type to NON STOCK here so it can be sold.
        </p>
        <div className="hms-table-wrap">
          <table className="hms-table">
            <thead>
              <tr>
                <th>Name</th><th>Code</th><th>Depot</th><th>Menu</th><th>Batch</th><th>Expiry</th><th>Cost</th><th>Selling</th><th>VAT</th><th>Stock type</th><th>Stock</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.productName}</td><td>{p.productCode}</td><td>{p.depotName}</td><td>{p.menuName}</td><td>{p.batchNo}</td>
                  <td>{p.expiryDate || "-"}</td><td>{Number(p.costPrice).toFixed(2)}</td><td>{Number(p.sellingPrice).toFixed(2)}</td>
                  <td className="text-muted-foreground text-sm">{p.taxable !== false ? "18%" : "0%"}</td>
                  <td>
                    <select
                      className="max-w-[140px] bg-background text-sm"
                      value={p.stockType}
                      disabled={patchingProductId === p.id}
                      onChange={(e) => void patchProductStockType(p.id, e.target.value as "STOCK" | "NON_STOCK")}
                    >
                      <option value="STOCK">STOCK</option>
                      <option value="NON_STOCK">NON STOCK</option>
                    </select>
                  </td>
                  <td>{p.stockType === "NON_STOCK" ? "—" : Number(p.stockQty).toFixed(3)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="hms-btn-outline hms-btn-sm" disabled={patchingProductId === p.id} onClick={() => void onAddQty(p)}>
                        Add Qty
                      </button>
                      <button type="button" className="hms-btn-outline hms-btn-sm" disabled={patchingProductId === p.id} onClick={() => void onEditProduct(p)}>
                        Edit
                      </button>
                      {p.active ? (
                        <button type="button" className="hms-btn-outline hms-btn-sm" disabled={patchingProductId === p.id} onClick={() => void onSleepProduct(p)}>
                          Sleep
                        </button>
                      ) : (
                        <button type="button" className="hms-btn-outline hms-btn-sm" disabled={patchingProductId === p.id} onClick={() => void onActivateProduct(p)}>
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && <tr><td colSpan={12} className="text-center text-muted-foreground">No products yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Product</h3>
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setEditingProduct(null)}>
                Close
              </button>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              Code: {editingProduct.productCode} | Depot: {editingProduct.depotName}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <input value={editForm.productName} onChange={(e) => setEditForm((s) => ({ ...s, productName: e.target.value }))} placeholder="Product name" />
              <input value={editForm.menuName} onChange={(e) => setEditForm((s) => ({ ...s, menuName: e.target.value }))} placeholder="Menu name" />
              <input value={editForm.batchNo} onChange={(e) => setEditForm((s) => ({ ...s, batchNo: e.target.value }))} placeholder="Batch no" />
              <input type="date" value={editForm.expiryDate} onChange={(e) => setEditForm((s) => ({ ...s, expiryDate: e.target.value }))} />
              <input type="number" step="0.01" value={editForm.costPrice} onChange={(e) => setEditForm((s) => ({ ...s, costPrice: e.target.value }))} placeholder="Cost price" />
              <input type="number" step="0.01" value={editForm.sellingPrice} onChange={(e) => setEditForm((s) => ({ ...s, sellingPrice: e.target.value }))} placeholder="Selling price" />
              <select
                value={editForm.stockType}
                onChange={(e) =>
                  setEditForm((s) => ({
                    ...s,
                    stockType: e.target.value as "STOCK" | "NON_STOCK",
                    stockQty: e.target.value === "NON_STOCK" ? "0" : s.stockQty,
                  }))
                }
              >
                <option value="STOCK">STOCK</option>
                <option value="NON_STOCK">NON STOCK</option>
              </select>
              {editForm.stockType === "STOCK" ? (
                <input
                  type="number"
                  step="0.001"
                  value={editForm.stockQty}
                  onChange={(e) => setEditForm((s) => ({ ...s, stockQty: e.target.value }))}
                  placeholder="Stock qty"
                />
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  Non stock product
                </div>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-sm md:col-span-3">
                <input
                  type="checkbox"
                  checked={editForm.taxable}
                  onChange={(e) => setEditForm((s) => ({ ...s, taxable: e.target.checked }))}
                />
                <span>Taxable (18% VAT on receipt; unchecked = 0%)</span>
              </label>
            </div>
            <div className="mt-4">
              <ImageUpload value={editForm.photoUrl} onChange={(url) => setEditForm((s) => ({ ...s, photoUrl: url }))} label="Photo" placeholder="Paste photo URL or upload" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setEditingProduct(null)}>
                Cancel
              </button>
              <button type="button" className="hms-btn-solid hms-btn-sm" onClick={() => void saveEditProduct()} disabled={patchingProductId === editingProduct.id}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
