import type { CreatePurchaseInput, Purchase, PurchaseItem } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { getNextNumber, recordStockMovement } from './helpers';
import { roundMoney } from '../utils/calculations';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type PurchaseRow = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
};

type PurchaseItemRow = {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  unit_cost: number;
  quantity: number;
  line_total: number;
};

function mapPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    poNumber: row.po_number,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    subtotal: row.subtotal,
    taxAmount: row.tax_amount,
    total: row.total,
    amountPaid: row.amount_paid,
    status: row.status as Purchase['status'],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPurchaseItem(row: PurchaseItemRow): PurchaseItem {
  return {
    id: row.id,
    purchaseId: row.purchase_id,
    productId: row.product_id,
    productName: row.product_name,
    unitCost: row.unit_cost,
    quantity: row.quantity,
    lineTotal: row.line_total,
  };
}

const SELECT_PURCHASE = `
  SELECT p.*, s.name AS supplier_name
  FROM purchases p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

export type PurchaseListFilters = {
  status?: string;
  unpaidOnly?: boolean;
  supplierId?: string;
};

export async function listPurchasesPaginated(
  query: ListQuery & PurchaseListFilters = {},
): Promise<PaginatedResult<Purchase>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.search?.trim()) {
    conditions.push('(p.po_number LIKE ? OR s.name LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like);
  }
  if (query.status) {
    conditions.push('p.status = ?');
    params.push(query.status);
  }
  if (query.unpaidOnly) {
    conditions.push('p.total > p.amount_paid');
  }
  if (query.supplierId) {
    conditions.push('p.supplier_id = ?');
    params.push(query.supplierId);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<PurchaseRow>(
    `${SELECT_PURCHASE} ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapPurchase),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listPurchases(limit = 100): Promise<Purchase[]> {
  return (await listPurchasesPaginated({ limit })).items;
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  const db = getDb();
  const row = await db.getFirstAsync<PurchaseRow>(`${SELECT_PURCHASE} WHERE p.id = ?`, [id]);
  return row ? mapPurchase(row) : null;
}

export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  const db = getDb();
  const rows = await db.getAllAsync<PurchaseItemRow>(
    'SELECT * FROM purchase_items WHERE purchase_id = ?',
    [purchaseId],
  );
  return rows.map(mapPurchaseItem);
}

export async function getPurchaseWithItems(id: string): Promise<Purchase | null> {
  const purchase = await getPurchaseById(id);
  if (!purchase) return null;
  purchase.items = await getPurchaseItems(id);
  return purchase;
}

export async function createPurchase(input: CreatePurchaseInput): Promise<Purchase> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const poNumber = await getNextNumber('PO-');

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO purchases (
        id, po_number, supplier_id, subtotal, tax_amount, total,
        amount_paid, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      [
        id,
        poNumber,
        input.supplierId ?? null,
        input.subtotal,
        input.taxAmount,
        input.total,
        input.amountPaid,
        input.notes ?? null,
        now,
        now,
      ],
    );

    for (const item of input.items) {
      await db.runAsync(
        `INSERT INTO purchase_items (
          id, purchase_id, product_id, product_name, unit_cost, quantity, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), id, item.productId, item.productName, item.unitCost, item.quantity, item.lineTotal],
      );

      await db.runAsync(
        'UPDATE products SET cost_price = ?, updated_at = ? WHERE id = ?',
        [item.unitCost, now, item.productId],
      );

      await recordStockMovement(db, {
        productId: item.productId,
        movementType: 'purchase',
        referenceType: 'purchase',
        referenceId: id,
        quantityChange: item.quantity,
        notes: `Purchase ${poNumber}`,
      });
    }
  });

  const created = await getPurchaseWithItems(id);
  if (!created) throw new Error('Failed to create purchase');
  return created;
}

export async function getLastSupplierUnitCost(
  supplierId: string | null,
  productId: string,
): Promise<number | null> {
  if (!supplierId) return null;
  const db = getDb();
  const row = await db.getFirstAsync<{ unit_cost: number }>(
    `SELECT pi.unit_cost
     FROM purchase_items pi
     JOIN purchases p ON p.id = pi.purchase_id
     WHERE pi.product_id = ? AND p.supplier_id = ? AND p.status = 'completed'
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [productId, supplierId],
  );
  return row?.unit_cost ?? null;
}

export async function recordPurchasePayment(
  purchaseId: string,
  amount: number,
  notes?: string | null,
): Promise<Purchase> {
  if (amount <= 0) throw new Error('Payment amount must be positive');

  const db = getDb();
  const purchase = await getPurchaseById(purchaseId);
  if (!purchase) throw new Error('Purchase not found');

  const balance = roundMoney(purchase.total - purchase.amountPaid);
  if (amount > balance + 0.001) {
    throw new Error(`Payment exceeds remaining balance of ${balance}`);
  }

  const newPaid = roundMoney(purchase.amountPaid + amount);
  const now = nowIso();
  const status = newPaid >= purchase.total ? 'completed' : 'pending';
  const noteAppend = notes?.trim() ? `\nPayment: ${notes.trim()}` : null;

  await db.runAsync(
    `UPDATE purchases SET
      amount_paid = ?, status = ?,
      notes = CASE WHEN ? IS NOT NULL THEN COALESCE(notes, '') || ? ELSE notes END,
      updated_at = ?
    WHERE id = ?`,
    [newPaid, status, noteAppend, noteAppend, now, purchaseId],
  );

  const updated = await getPurchaseById(purchaseId);
  if (!updated) throw new Error('Failed to update purchase');
  return updated;
}
