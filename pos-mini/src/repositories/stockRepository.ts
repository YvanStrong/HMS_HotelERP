import type { StockAdjustmentInput, StockMovement } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { recordStockMovement } from './helpers';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type MovementRow = {
  id: string;
  product_id: string;
  movement_type: string;
  reference_type: string | null;
  reference_id: string | null;
  quantity_change: number;
  qty_before: number;
  qty_after: number;
  notes: string | null;
  created_at: string;
  product_name?: string | null;
};

function mapMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name ?? undefined,
    movementType: row.movement_type as StockMovement['movementType'],
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    quantityChange: row.quantity_change,
    qtyBefore: row.qty_before,
    qtyAfter: row.qty_after,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export type StockMovementFilters = {
  productId?: string;
  movementType?: string;
};

export async function listStockMovementsPaginated(
  query: ListQuery & StockMovementFilters = {},
): Promise<PaginatedResult<StockMovement>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.productId) {
    conditions.push('sm.product_id = ?');
    params.push(query.productId);
  }
  if (query.movementType) {
    conditions.push('sm.movement_type = ?');
    params.push(query.movementType);
  }
  if (query.search?.trim()) {
    conditions.push('(p.name LIKE ? OR sm.notes LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM stock_movements sm JOIN products p ON p.id = sm.product_id ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<MovementRow>(
    `SELECT sm.*, p.name AS product_name FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapMovement),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listStockMovements(productId?: string, limit = 100): Promise<StockMovement[]> {
  return (
    await listStockMovementsPaginated({
      productId,
      limit,
    })
  ).items;
}

export async function adjustStock(input: StockAdjustmentInput): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await recordStockMovement(db, {
      productId: input.productId,
      movementType: 'adjustment',
      referenceType: 'adjustment',
      referenceId: null,
      quantityChange: input.quantityChange,
      notes: input.notes ?? null,
    });
  });
}

export async function getProductStock(productId: string): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ stock_qty: number }>(
    'SELECT stock_qty FROM products WHERE id = ?',
    [productId],
  );
  return row?.stock_qty ?? 0;
}
