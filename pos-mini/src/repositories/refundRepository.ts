import type { CreateRefundInput, Refund, RefundItem } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { getNextNumber, recordStockMovement } from './helpers';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type RefundRow = {
  id: string;
  refund_number: string;
  sale_id: string | null;
  subtotal: number;
  total: number;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sale_invoice_number?: string | null;
};

type RefundItemRow = {
  id: string;
  refund_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  restock?: number;
};

function mapRefund(row: RefundRow): Refund {
  return {
    id: row.id,
    refundNumber: row.refund_number,
    saleId: row.sale_id,
    saleInvoiceNumber: row.sale_invoice_number,
    subtotal: row.subtotal,
    total: row.total,
    reason: row.reason,
    status: row.status as Refund['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRefundItem(row: RefundItemRow): RefundItem {
  return {
    id: row.id,
    refundId: row.refund_id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    lineTotal: row.line_total,
    restock: row.restock === undefined ? true : row.restock === 1,
  };
}

const SELECT_REFUND = `
  SELECT r.*, s.invoice_number AS sale_invoice_number
  FROM refunds r
  LEFT JOIN sales s ON s.id = r.sale_id
`;

export async function listRefundsPaginated(query: ListQuery = {}): Promise<PaginatedResult<Refund>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.search?.trim()) {
    conditions.push('(r.refund_number LIKE ? OR s.invoice_number LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM refunds r LEFT JOIN sales s ON s.id = r.sale_id ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<RefundRow>(
    `${SELECT_REFUND} ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapRefund),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listRefunds(limit = 100): Promise<Refund[]> {
  return (await listRefundsPaginated({ limit })).items;
}

export async function getRefundById(id: string): Promise<Refund | null> {
  const db = getDb();
  const row = await db.getFirstAsync<RefundRow>(`${SELECT_REFUND} WHERE r.id = ?`, [id]);
  return row ? mapRefund(row) : null;
}

export async function getRefundItems(refundId: string): Promise<RefundItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<RefundItemRow>(
    'SELECT * FROM refund_items WHERE refund_id = ?',
    [refundId],
  );
  return rows.map(mapRefundItem);
}

export async function getRefundWithItems(id: string): Promise<Refund | null> {
  const refund = await getRefundById(id);
  if (!refund) return null;
  refund.items = await getRefundItems(id);
  return refund;
}

export async function getRefundableQuantities(saleId: string): Promise<Record<string, number>> {
  const db = getDb();
  const saleItems = await db.getAllAsync<{ product_id: string; quantity: number }>(
    'SELECT product_id, quantity FROM sale_items WHERE sale_id = ?',
    [saleId],
  );
  const refunded = await db.getAllAsync<{ product_id: string; qty: number }>(
    `SELECT ri.product_id, SUM(ri.quantity) AS qty
     FROM refund_items ri
     JOIN refunds r ON r.id = ri.refund_id
     WHERE r.sale_id = ? AND r.status = 'completed'
     GROUP BY ri.product_id`,
    [saleId],
  );
  const refundedMap = new Map(refunded.map((r) => [r.product_id, r.qty]));
  const result: Record<string, number> = {};
  for (const item of saleItems) {
    const already = refundedMap.get(item.product_id) ?? 0;
    result[item.product_id] = Math.max(0, item.quantity - already);
  }
  return result;
}

export async function createRefund(input: CreateRefundInput): Promise<Refund> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const refundNumber = await getNextNumber('REF-');

  if (input.saleId) {
    const refundable = await getRefundableQuantities(input.saleId);
    for (const item of input.items) {
      const remaining = refundable[item.productId] ?? 0;
      if (item.quantity > remaining) {
        throw new Error(
          `Cannot refund ${item.quantity} of "${item.productName}". Only ${remaining} remaining.`,
        );
      }
    }
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO refunds (
        id, refund_number, sale_id, subtotal, total, reason, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      [id, refundNumber, input.saleId ?? null, input.subtotal, input.total, input.reason ?? null, now, now],
    );

    for (const item of input.items) {
      const shouldRestock = item.restock !== false;
      await db.runAsync(
        `INSERT INTO refund_items (
          id, refund_id, product_id, product_name, unit_price, quantity, line_total, restock
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          id,
          item.productId,
          item.productName,
          item.unitPrice,
          item.quantity,
          item.lineTotal,
          shouldRestock ? 1 : 0,
        ],
      );

      const product = await db.getFirstAsync<{ track_stock: number }>(
        'SELECT track_stock FROM products WHERE id = ?',
        [item.productId],
      );
      if (shouldRestock && product?.track_stock === 1) {
        await recordStockMovement(db, {
          productId: item.productId,
          movementType: 'refund',
          referenceType: 'refund',
          referenceId: id,
          quantityChange: item.quantity,
          notes: `Refund ${refundNumber}`,
        });
      }
    }
  });

  const created = await getRefundWithItems(id);
  if (!created) throw new Error('Failed to create refund');
  return created;
}
