import type { ProductBundleItem } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type BundleRow = {
  id: string;
  parent_product_id: string;
  child_product_id: string;
  quantity: number;
  created_at: string;
  child_name?: string | null;
};

function mapBundle(row: BundleRow): ProductBundleItem {
  return {
    id: row.id,
    parentProductId: row.parent_product_id,
    childProductId: row.child_product_id,
    childProductName: row.child_name ?? undefined,
    quantity: row.quantity,
    createdAt: row.created_at,
  };
}

export async function listBundleItems(parentProductId: string): Promise<ProductBundleItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<BundleRow>(
    `SELECT b.*, p.name AS child_name
     FROM product_bundles b
     JOIN products p ON p.id = b.child_product_id
     WHERE b.parent_product_id = ?
     ORDER BY p.name ASC`,
    [parentProductId],
  );
  return rows.map(mapBundle);
}

export async function isBundleProduct(productId: string): Promise<boolean> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM product_bundles WHERE parent_product_id = ?',
    [productId],
  );
  return (row?.count ?? 0) > 0;
}

export async function addBundleItem(
  parentProductId: string,
  childProductId: string,
  quantity: number,
): Promise<ProductBundleItem> {
  const db = getDb();
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM product_bundles WHERE parent_product_id = ? AND child_product_id = ?',
    [parentProductId, childProductId],
  );
  if (existing) throw new Error('Product already in bundle');

  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO product_bundles (id, parent_product_id, child_product_id, quantity, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, parentProductId, childProductId, quantity, now],
  );
  const items = await listBundleItems(parentProductId);
  const created = items.find((i) => i.id === id);
  if (!created) throw new Error('Failed to add bundle item');
  return created;
}

export async function removeBundleItem(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM product_bundles WHERE id = ?', [id]);
}

export async function updateBundleItemQuantity(id: string, quantity: number): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE product_bundles SET quantity = ? WHERE id = ?', [quantity, id]);
}

export type BundleStockLine = {
  productId: string;
  productName: string;
  quantity: number;
};

/** Expand bundle parent into child stock lines (parent qty × child bundle qty). */
export async function expandBundleForStock(
  parentProductId: string,
  parentQty: number,
): Promise<BundleStockLine[]> {
  const items = await listBundleItems(parentProductId);
  if (items.length === 0) return [];
  return items.map((item) => ({
    productId: item.childProductId,
    productName: item.childProductName ?? 'Item',
    quantity: parentQty * item.quantity,
  }));
}
