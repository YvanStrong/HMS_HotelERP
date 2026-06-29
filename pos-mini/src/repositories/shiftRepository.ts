import type { Shift } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type ShiftRow = {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  closing_cash: number | null;
  expected_cash: number | null;
  notes: string | null;
  status: string;
};

function mapShift(row: ShiftRow): Shift {
  return {
    id: row.id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingCash: row.opening_cash,
    closingCash: row.closing_cash,
    expectedCash: row.expected_cash,
    notes: row.notes,
    status: row.status as Shift['status'],
  };
}

export async function getOpenShift(): Promise<Shift | null> {
  const db = getDb();
  const row = await db.getFirstAsync<ShiftRow>(
    "SELECT * FROM shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1",
  );
  return row ? mapShift(row) : null;
}

export async function openShift(openingCash: number): Promise<Shift> {
  const existing = await getOpenShift();
  if (existing) throw new Error('A shift is already open');
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO shifts (id, opened_at, opening_cash, status) VALUES (?, ?, ?, 'open')`,
    [id, now, openingCash],
  );
  const shift = await db.getFirstAsync<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [id]);
  if (!shift) throw new Error('Failed to open shift');
  return mapShift(shift);
}

export type ZReportSummary = {
  salesTotal: number;
  salesCount: number;
  cashSales: number;
  refundsTotal: number;
  openingCash: number;
  expectedCash: number;
};

export async function getZReportForShift(shift: Shift): Promise<ZReportSummary> {
  const db = getDb();
  const end = shift.closedAt ?? nowIso();
  const sales = await db.getFirstAsync<{ total: number; count: number; cash: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) AS cash
     FROM sales WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [shift.openedAt, end],
  );
  const refunds = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total FROM refunds
     WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [shift.openedAt, end],
  );
  const salesTotal = sales?.total ?? 0;
  const cashSales = sales?.cash ?? 0;
  const refundsTotal = refunds?.total ?? 0;
  const expectedCash = shift.openingCash + cashSales - refundsTotal;
  return {
    salesTotal,
    salesCount: sales?.count ?? 0,
    cashSales,
    refundsTotal,
    openingCash: shift.openingCash,
    expectedCash,
  };
}

export async function closeShift(
  shiftId: string,
  closingCash: number,
  notes?: string | null,
): Promise<Shift> {
  const db = getDb();
  const shift = await db.getFirstAsync<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  if (!shift || shift.status !== 'open') throw new Error('Shift not found or already closed');
  const mapped = mapShift(shift);
  const z = await getZReportForShift(mapped);
  const now = nowIso();
  await db.runAsync(
    `UPDATE shifts SET closed_at = ?, closing_cash = ?, expected_cash = ?, notes = ?, status = 'closed'
     WHERE id = ?`,
    [now, closingCash, z.expectedCash, notes ?? null, shiftId],
  );
  const updated = await db.getFirstAsync<ShiftRow>('SELECT * FROM shifts WHERE id = ?', [shiftId]);
  if (!updated) throw new Error('Failed to close shift');
  return mapShift(updated);
}

export async function listShifts(limit = 20): Promise<Shift[]> {
  const db = getDb();
  const rows = await db.getAllAsync<ShiftRow>(
    'SELECT * FROM shifts ORDER BY opened_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(mapShift);
}
