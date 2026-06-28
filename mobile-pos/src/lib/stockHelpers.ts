import type { DepotProduct } from "../types";
import { parseMoney } from "./productMoney";

export function parseStockQty(product: DepotProduct): number | null {
  if (!product.isTracked) return null;
  if (product.stockQty == null) return null;
  return parseMoney(product.stockQty);
}

export function isOutOfStock(product: DepotProduct): boolean {
  const qty = parseStockQty(product);
  if (qty == null) return false;
  return qty <= 0;
}

export function isLowStock(product: DepotProduct, threshold: number): boolean {
  const qty = parseStockQty(product);
  if (qty == null) return false;
  return qty > 0 && qty <= threshold;
}

export function menuCategoryLabel(product: DepotProduct): string {
  return (product.menuName?.trim() || "General").replace(/_/g, " ");
}
