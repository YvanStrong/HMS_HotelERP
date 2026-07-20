import type { CreateProductVariantInput, ProductVariant, UpdateProductVariantInput } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sell_price: number;
  cost_price: number;
  stock_qty: number;
  is_active: number;
  created_at: string;
};

function mapVariant(row: VariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    sellPrice: row.sell_price,
    costPrice: row.cost_price,
    stockQty: row.stock_qty,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export async function listVariantsByProduct(
  productId: string,
  activeOnly = true,
): Promise<ProductVariant[]> {
  const db = getDb();
  const rows = await db.getAllAsync<VariantRow>(
    activeOnly
      ? 'SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM product_variants WHERE product_id = ? ORDER BY name ASC',
    [productId],
  );
  return rows.map(mapVariant);
}

export async function getVariantById(id: string): Promise<ProductVariant | null> {
  const db = getDb();
  const row = await db.getFirstAsync<VariantRow>('SELECT * FROM product_variants WHERE id = ?', [id]);
  return row ? mapVariant(row) : null;
}

export async function createVariant(input: CreateProductVariantInput): Promise<ProductVariant> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO product_variants (
      id, product_id, name, sku, barcode, sell_price, cost_price, stock_qty, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.productId,
      input.name.trim(),
      input.sku ?? null,
      input.barcode ?? null,
      input.sellPrice,
      input.costPrice,
      input.stockQty,
      input.isActive === false ? 0 : 1,
      now,
    ],
  );
  const created = await getVariantById(id);
  if (!created) throw new Error('Failed to create variant');
  return created;
}

export async function updateVariant(
  id: string,
  input: UpdateProductVariantInput,
): Promise<ProductVariant> {
  const db = getDb();
  const existing = await getVariantById(id);
  if (!existing) throw new Error('Variant not found');
  await db.runAsync(
    `UPDATE product_variants SET
      name = ?, sku = ?, barcode = ?, sell_price = ?, cost_price = ?, stock_qty = ?, is_active = ?
     WHERE id = ?`,
    [
      input.name?.trim() ?? existing.name,
      input.sku !== undefined ? input.sku : existing.sku,
      input.barcode !== undefined ? input.barcode : existing.barcode,
      input.sellPrice ?? existing.sellPrice,
      input.costPrice ?? existing.costPrice,
      input.stockQty ?? existing.stockQty,
      input.isActive === undefined ? (existing.isActive ? 1 : 0) : input.isActive ? 1 : 0,
      id,
    ],
  );
  const updated = await getVariantById(id);
  if (!updated) throw new Error('Failed to update variant');
  return updated;
}

export async function deleteVariant(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE product_variants SET is_active = 0 WHERE id = ?', [id]);
}

export async function countActiveVariants(productId: string): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM product_variants WHERE product_id = ? AND is_active = 1',
    [productId],
  );
  return row?.count ?? 0;
}
