import { fetchDepotProducts } from "./depots";
import { fetchInventoryImageMap } from "./inventory";
import type { DepotProduct } from "../types";
import { productPrice } from "../lib/productMoney";

export { productPrice };

function isBlankUrl(url: string | null | undefined): boolean {
  return url == null || url.trim() === "";
}

function mergeProductImages(products: DepotProduct[], inventoryImages: Map<string, string>): DepotProduct[] {
  return products.map((p) => {
    const depotPhoto = p.photoUrl?.trim() || null;
    const invKey = p.inventoryItemId?.trim().toLowerCase() ?? "";
    const fromInventory =
      invKey && isBlankUrl(depotPhoto) ? inventoryImages.get(invKey)?.trim() || null : null;
    const photoUrl = depotPhoto || fromInventory || null;
    return photoUrl !== (p.photoUrl?.trim() || null) ? { ...p, photoUrl } : p;
  });
}

export async function fetchMenuForDepot(hotelId: string, depotId: string): Promise<DepotProduct[]> {
  const [products, inventoryImages] = await Promise.all([
    fetchDepotProducts(hotelId, depotId),
    fetchInventoryImageMap(hotelId).catch(() => new Map<string, string>()),
  ]);
  return mergeProductImages(products, inventoryImages);
}

export function groupProductsByCategory(products: DepotProduct[]): Record<string, DepotProduct[]> {
  const groups: Record<string, DepotProduct[]> = {};
  for (const p of products) {
    const cat = (p.menuName?.trim() || "General").replace(/_/g, " ");
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(p);
  }
  return groups;
}
