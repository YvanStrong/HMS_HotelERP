import type { Expense } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type ExpenseRow = {
  id: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  date: string;
  notes: string | null;
  created_at: string;
};

function mapExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    category: row.category,
    description: row.description,
    amount: row.amount,
    paymentMethod: row.payment_method as Expense['paymentMethod'],
    date: row.date,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export type ExpenseListFilters = {
  category?: string;
};

export async function listExpensesPaginated(
  query: ListQuery & ExpenseListFilters = {},
): Promise<PaginatedResult<Expense>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.category) {
    conditions.push('category = ?');
    params.push(query.category);
  }
  if (query.search?.trim()) {
    conditions.push('(description LIKE ? OR notes LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM expenses ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT * FROM expenses ${where} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapExpense),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listExpenses(limit = 100): Promise<Expense[]> {
  return (await listExpensesPaginated({ limit })).items;
}

export async function createExpense(
  input: Omit<Expense, 'id' | 'createdAt'>,
): Promise<Expense> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO expenses (id, category, description, amount, payment_method, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.category, input.description, input.amount, input.paymentMethod, input.date, input.notes, now],
  );
  const row = await db.getFirstAsync<ExpenseRow>('SELECT * FROM expenses WHERE id = ?', [id]);
  if (!row) throw new Error('Failed to create expense');
  return mapExpense(row);
}

export async function deleteExpense(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}
