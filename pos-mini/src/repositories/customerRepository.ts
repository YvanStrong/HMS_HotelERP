import type { Customer } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  total_debt: number;
  created_at: string;
  updated_at: string;
};

function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    totalDebt: row.total_debt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type CustomerListFilters = {
  withDebtOnly?: boolean;
};

export async function listCustomersPaginated(
  query: ListQuery & CustomerListFilters = {},
): Promise<PaginatedResult<Customer>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.withDebtOnly) conditions.push('total_debt > 0');
  if (query.search?.trim()) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like, like);
  }

  const where = buildWhere(conditions);
  const order = query.withDebtOnly ? 'ORDER BY total_debt DESC' : 'ORDER BY name ASC';

  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM customers ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<CustomerRow>(
    `SELECT * FROM customers ${where} ${order} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapCustomer),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listCustomers(): Promise<Customer[]> {
  return (await listCustomersPaginated({ limit: 500 })).items;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  return (await listCustomersPaginated({ search: query, limit: 100 })).items;
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const db = getDb();
  const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ?', [id]);
  return row ? mapCustomer(row) : null;
}

export async function createCustomer(
  input: Omit<Customer, 'id' | 'totalDebt' | 'createdAt' | 'updatedAt'>,
): Promise<Customer> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO customers (id, name, phone, email, address, notes, total_debt, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [id, input.name, input.phone, input.email, input.address, input.notes, now, now],
  );
  const created = await getCustomerById(id);
  if (!created) throw new Error('Failed to create customer');
  return created;
}

export async function updateCustomer(
  id: string,
  input: Partial<Omit<Customer, 'id' | 'totalDebt' | 'createdAt' | 'updatedAt'>>,
): Promise<Customer> {
  const db = getDb();
  const existing = await getCustomerById(id);
  if (!existing) throw new Error('Customer not found');
  const now = nowIso();

  await db.runAsync(
    `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    [
      input.name ?? existing.name,
      input.phone !== undefined ? input.phone : existing.phone,
      input.email !== undefined ? input.email : existing.email,
      input.address !== undefined ? input.address : existing.address,
      input.notes !== undefined ? input.notes : existing.notes,
      now,
      id,
    ],
  );
  const updated = await getCustomerById(id);
  if (!updated) throw new Error('Failed to update customer');
  return updated;
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM customers WHERE id = ?', [id]);
}
