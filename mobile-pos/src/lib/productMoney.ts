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

function asStringList(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const list = v.filter((x): x is string => typeof x === "string");
  return list.length > 0 ? list : undefined;
}

function normalizePhotoUrl(raw: Record<string, unknown>): string | null {
  const url = String(raw.photoUrl ?? raw.photo_url ?? raw.imageUrl ?? raw.image_url ?? "").trim();
  return url || null;
}

export function normalizeDepotProduct(raw: Record<string, unknown>): DepotProduct {
  const stockType = String(raw.stockType ?? raw.stock_type ?? "STOCK");
  const isTracked = stockType.toUpperCase() !== "NON_STOCK";
  return {
    id: String(raw.id ?? ""),
    depotId: String(raw.depotId ?? raw.depot_id ?? ""),
    productName: String(raw.productName ?? raw.product_name ?? ""),
    productCode: String(raw.productCode ?? raw.product_code ?? ""),
    sellingPrice: parseMoney(raw.sellingPrice ?? raw.selling_price),
    stockQty: (raw.stockQty ?? raw.stock_qty) as number | string | null | undefined,
    stockType,
    isTracked,
    photoUrl: normalizePhotoUrl(raw),
    menuName: String(raw.menuName ?? raw.menu_name ?? "General"),
    taxable: Boolean(raw.taxable ?? true),
    active: Boolean(raw.active ?? true),
    inventoryItemId: (raw.inventoryItemId ?? raw.inventory_item_id ?? null) as string | null,
    allergens: asStringList(raw.allergens),
    dietaryFlags: asStringList(raw.dietaryFlags ?? raw.dietary_flags),
    nameTranslations: (raw.nameTranslations ?? raw.name_translations ?? null) as
      | Record<string, string>
      | null
      | undefined,
  };
}
