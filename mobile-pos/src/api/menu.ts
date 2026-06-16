import { fetchDepotProducts } from "./depots";
import { fetchInventoryImageMap } from "./inventory";
import type { DepotProduct } from "../types";
import { productPrice } from "../lib/productMoney";

export { productPrice };

function mergeProductImages(products: DepotProduct[], inventoryImages: Map<string, string>): DepotProduct[] {
  return products.map((p) => {
    const fromInventory =
      p.inventoryItemId && !p.photoUrl ? inventoryImages.get(p.inventoryItemId) ?? null : null;
    const photoUrl = p.photoUrl ?? fromInventory ?? null;
    return photoUrl && photoUrl !== p.photoUrl ? { ...p, photoUrl } : p;
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
