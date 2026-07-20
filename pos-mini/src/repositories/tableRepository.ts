import type { PosTable, TableStatus } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type TableRow = {
  id: string;
  name: string;
  seats: number;
  status: string;
  merged_into_id: string | null;
  created_at: string;
  updated_at: string;
  open_bill_total?: number | null;
  open_bill_id?: string | null;
};

function mapTable(row: TableRow): PosTable {
  return {
    id: row.id,
    name: row.name,
    seats: row.seats,
    status: row.status as TableStatus,
    mergedIntoId: row.merged_into_id,
    openBillTotal: row.open_bill_total ?? undefined,
    openBillId: row.open_bill_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_TABLE = `
  SELECT t.*,
    s.id AS open_bill_id,
    s.total AS open_bill_total
  FROM pos_tables t
  LEFT JOIN sales s ON s.table_id = t.id AND s.status = 'pending'
`;

export async function listTables(): Promise<PosTable[]> {
  const db = getDb();
  const rows = await db.getAllAsync<TableRow>(
    `${SELECT_TABLE} WHERE t.merged_into_id IS NULL ORDER BY t.name ASC`,
  );
  return rows.map(mapTable);
}

export async function getTableById(id: string): Promise<PosTable | null> {
  const db = getDb();
  const row = await db.getFirstAsync<TableRow>(`${SELECT_TABLE} WHERE t.id = ?`, [id]);
  return row ? mapTable(row) : null;
}

export async function createTable(name: string, seats = 4): Promise<PosTable> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO pos_tables (id, name, seats, status, merged_into_id, created_at, updated_at)
     VALUES (?, ?, ?, 'available', NULL, ?, ?)`,
    [id, name.trim(), seats, now, now],
  );
  const created = await getTableById(id);
  if (!created) throw new Error('Failed to create table');
  return created;
}

export async function setTableStatus(id: string, status: TableStatus): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE pos_tables SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    nowIso(),
    id,
  ]);
}

export async function mergeTables(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) throw new Error('Cannot merge a table with itself');
  const db = getDb();
  const sourceSale = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM sales WHERE table_id = ? AND status = 'pending' LIMIT 1`,
    [sourceId],
  );
  const targetSale = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM sales WHERE table_id = ? AND status = 'pending' LIMIT 1`,
    [targetId],
  );

  await db.withTransactionAsync(async () => {
    if (sourceSale && targetSale) {
      const items = await db.getAllAsync<{
        product_id: string;
        product_name: string;
        variant_id: string | null;
        variant_name: string | null;
        modifiers_json: string | null;
        unit_price: number;
        cost_price: number;
        quantity: number;
        line_total: number;
        discount_amount: number;
      }>('SELECT * FROM sale_items WHERE sale_id = ?', [sourceSale.id]);

      for (const item of items) {
        await db.runAsync(
          `INSERT INTO sale_items (
            id, sale_id, product_id, product_name, variant_id, variant_name, modifiers_json,
            unit_price, cost_price, quantity, line_total, discount_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            generateId(),
            targetSale.id,
            item.product_id,
            item.product_name,
            item.variant_id,
            item.variant_name,
            item.modifiers_json,
            item.unit_price,
            item.cost_price,
            item.quantity,
            item.line_total,
            item.discount_amount,
          ],
        );
      }

      const totals = await db.getFirstAsync<{ subtotal: number; total: number }>(
        `SELECT COALESCE(SUM(line_total), 0) AS subtotal, COALESCE(SUM(line_total), 0) AS total
         FROM sale_items WHERE sale_id = ?`,
        [targetSale.id],
      );
      const subtotal = totals?.subtotal ?? 0;
      await db.runAsync(
        `UPDATE sales SET subtotal = ?, total = ?, updated_at = ? WHERE id = ?`,
        [subtotal, subtotal, nowIso(), targetSale.id],
      );
      await db.runAsync('DELETE FROM sale_items WHERE sale_id = ?', [sourceSale.id]);
      await db.runAsync('DELETE FROM sales WHERE id = ?', [sourceSale.id]);
    } else if (sourceSale && !targetSale) {
      await db.runAsync('UPDATE sales SET table_id = ?, updated_at = ? WHERE id = ?', [
        targetId,
        nowIso(),
        sourceSale.id,
      ]);
    }

    const now = nowIso();
    await db.runAsync(
      `UPDATE pos_tables SET status = 'merged', merged_into_id = ?, updated_at = ? WHERE id = ?`,
      [targetId, now, sourceId],
    );
    await db.runAsync(`UPDATE pos_tables SET status = 'occupied', updated_at = ? WHERE id = ?`, [
      now,
      targetId,
    ]);
  });
}
