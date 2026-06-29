import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

export async function getNextNumber(prefix: string): Promise<string> {
  const db = getDb();
  let num = 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR IGNORE INTO number_sequences (prefix, last_number) VALUES (?, 0)', [
      prefix,
    ]);
    await db.runAsync(
      'UPDATE number_sequences SET last_number = last_number + 1 WHERE prefix = ?',
      [prefix],
    );
    const row = await db.getFirstAsync<{ last_number: number }>(
      'SELECT last_number FROM number_sequences WHERE prefix = ?',
      [prefix],
    );
    num = row?.last_number ?? 1;
  });

  return `${prefix}${String(num).padStart(5, '0')}`;
}

export async function recordStockMovement(
  db: SQLiteDatabase,
  params: {
    productId: string;
    movementType: string;
    referenceType: string | null;
    referenceId: string | null;
    quantityChange: number;
    notes?: string | null;
  },
): Promise<void> {
  const product = await db.getFirstAsync<{ stock_qty: number }>(
    'SELECT stock_qty FROM products WHERE id = ?',
    [params.productId],
  );
  if (!product) throw new Error('Product not found');

  const qtyBefore = product.stock_qty;
  const qtyAfter = qtyBefore + params.quantityChange;

  await db.runAsync(
    `UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ?`,
    [qtyAfter, nowIso(), params.productId],
  );

  await db.runAsync(
    `INSERT INTO stock_movements (
      id, product_id, movement_type, reference_type, reference_id,
      quantity_change, qty_before, qty_after, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      params.productId,
      params.movementType,
      params.referenceType,
      params.referenceId,
      params.quantityChange,
      qtyBefore,
      qtyAfter,
      params.notes ?? null,
      nowIso(),
    ],
  );
}
