import type { DebtRecord, DiscountRule } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type DiscountRow = {
  id: string;
  name: string;
  type: string;
  value: number;
  min_purchase: number;
  is_active: number;
  created_at: string;
};

type DebtRow = {
  id: string;
  customer_id: string;
  sale_id: string | null;
  amount: number;
  type: string;
  notes: string | null;
  created_at: string;
};

function mapDiscount(row: DiscountRow): DiscountRule {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DiscountRule['type'],
    value: row.value,
    minPurchase: row.min_purchase,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapDebt(row: DebtRow): DebtRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    saleId: row.sale_id,
    amount: row.amount,
    type: row.type as DebtRecord['type'],
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listDiscountRules(activeOnly = true): Promise<DiscountRule[]> {
  const db = getDb();
  const sql = activeOnly
    ? 'SELECT * FROM discount_rules WHERE is_active = 1 ORDER BY name ASC'
    : 'SELECT * FROM discount_rules ORDER BY name ASC';
  const rows = await db.getAllAsync<DiscountRow>(sql);
  return rows.map(mapDiscount);
}

export async function createDiscountRule(
  input: Omit<DiscountRule, 'id' | 'createdAt'>,
): Promise<DiscountRule> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO discount_rules (id, name, type, value, min_purchase, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.type, input.value, input.minPurchase, input.isActive ? 1 : 0, now],
  );
  const row = await db.getFirstAsync<DiscountRow>('SELECT * FROM discount_rules WHERE id = ?', [id]);
  if (!row) throw new Error('Failed to create discount rule');
  return mapDiscount(row);
}

export async function deleteDiscountRule(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM discount_rules WHERE id = ?', [id]);
}

export function findBestDiscountRule(
  rules: DiscountRule[],
  subtotal: number,
): { percent: number; fixed: number; ruleName?: string } | null {
  const applicable = rules.filter((r) => r.isActive && subtotal >= r.minPurchase);
  if (applicable.length === 0) return null;

  let best: DiscountRule | null = null;
  let bestAmount = 0;

  for (const rule of applicable) {
    const amount = rule.type === 'percent' ? subtotal * (rule.value / 100) : rule.value;
    if (amount > bestAmount) {
      bestAmount = amount;
      best = rule;
    }
  }

  if (!best) return null;
  return {
    percent: best.type === 'percent' ? best.value : 0,
    fixed: best.type === 'fixed' ? best.value : 0,
    ruleName: best.name,
  };
}

export async function listCustomerDebts(customerId: string): Promise<DebtRecord[]> {
  const db = getDb();
  const rows = await db.getAllAsync<DebtRow>(
    'SELECT * FROM debts WHERE customer_id = ? ORDER BY created_at DESC',
    [customerId],
  );
  return rows.map(mapDebt);
}

export async function recordDebtPayment(
  customerId: string,
  amount: number,
  notes?: string | null,
): Promise<void> {
  const db = getDb();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO debts (id, customer_id, sale_id, amount, type, notes, created_at)
       VALUES (?, ?, NULL, ?, 'payment', ?, ?)`,
      [generateId(), customerId, amount, notes ?? null, now],
    );
    await db.runAsync(
      `UPDATE customers SET
        total_debt = CASE WHEN total_debt - ? < 0 THEN 0 ELSE total_debt - ? END,
        updated_at = ?
      WHERE id = ?`,
      [amount, amount, now, customerId],
    );
  });
}
