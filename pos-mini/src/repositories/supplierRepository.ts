import type { Supplier } from '../types';
import type { ListQuery, PaginatedResult } from '../types/pagination';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { buildWhere, clampLimit, clampOffset, likePattern } from './queryHelpers';

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSuppliersPaginated(query: ListQuery = {}): Promise<PaginatedResult<Supplier>> {
  const db = getDb();
  const limit = clampLimit(query.limit);
  const offset = clampOffset(query.offset);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.search?.trim()) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    const like = likePattern(query.search);
    params.push(like, like, like);
  }

  const where = buildWhere(conditions);
  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM suppliers ${where}`,
    params,
  );
  const total = countRow?.count ?? 0;

  const rows = await db.getAllAsync<SupplierRow>(
    `SELECT * FROM suppliers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(mapSupplier),
    total,
    hasMore: offset + rows.length < total,
  };
}

export async function listSuppliers(): Promise<Supplier[]> {
  return (await listSuppliersPaginated({ limit: 500 })).items;
}

export async function getSupplierById(id: string): Promise<Supplier | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SupplierRow>('SELECT * FROM suppliers WHERE id = ?', [id]);
  return row ? mapSupplier(row) : null;
}

export async function createSupplier(
  input: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Supplier> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO suppliers (id, name, phone, email, address, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.phone, input.email, input.address, input.notes, now, now],
  );
  const created = await getSupplierById(id);
  if (!created) throw new Error('Failed to create supplier');
  return created;
}

export async function updateSupplier(
  id: string,
  input: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Supplier> {
  const db = getDb();
  const existing = await getSupplierById(id);
  if (!existing) throw new Error('Supplier not found');
  const now = nowIso();

  await db.runAsync(
    `UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ?, updated_at = ?
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
  const updated = await getSupplierById(id);
  if (!updated) throw new Error('Failed to update supplier');
  return updated;
}

export async function deleteSupplier(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM suppliers WHERE id = ?', [id]);
}
