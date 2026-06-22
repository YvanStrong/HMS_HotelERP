import type { DepotProduct } from "../types";

type ProductLike = DepotProduct & {
  selling_price?: number | string | null;
  unit_price?: number | string | null;
  unitPrice?: number | string | null;
};

export function parseMoney(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function productPrice(p: DepotProduct): number {
  const raw = p as ProductLike;
  return parseMoney(raw.sellingPrice ?? raw.selling_price ?? raw.unitPrice ?? raw.unit_price);
}

export function normalizeDepotProduct(raw: Record<string, unknown>): DepotProduct {
  return {
    id: String(raw.id ?? ""),
    depotId: String(raw.depotId ?? raw.depot_id ?? ""),
    productName: String(raw.productName ?? raw.product_name ?? ""),
    productCode: String(raw.productCode ?? raw.product_code ?? ""),
    sellingPrice: parseMoney(raw.sellingPrice ?? raw.selling_price),
    stockQty: (raw.stockQty ?? raw.stock_qty) as number | string | undefined,
    photoUrl: (raw.photoUrl ?? raw.photo_url ?? null) as string | null,
    menuName: String(raw.menuName ?? raw.menu_name ?? "General"),
    taxable: Boolean(raw.taxable ?? true),
    active: Boolean(raw.active ?? true),
    inventoryItemId: (raw.inventoryItemId ?? raw.inventory_item_id ?? null) as string | null,
  };
}
