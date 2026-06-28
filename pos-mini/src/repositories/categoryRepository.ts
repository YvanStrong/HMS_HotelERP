import type { Category } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listCategories(): Promise<Category[]> {
  const db = getDb();
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
  );
  return rows.map(mapCategory);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = getDb();
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
  return row ? mapCategory(row) : null;
}

export async function createCategory(input: { name: string; color?: string; sortOrder?: number }): Promise<Category> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    'INSERT INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, input.name, input.color ?? '#22c55e', input.sortOrder ?? 0, now],
  );
  const created = await getCategoryById(id);
  if (!created) throw new Error('Failed to create category');
  return created;
}

export async function updateCategory(
  id: string,
  input: Partial<{ name: string; color: string; sortOrder: number }>,
): Promise<Category> {
  const db = getDb();
  const existing = await getCategoryById(id);
  if (!existing) throw new Error('Category not found');

  await db.runAsync(
    'UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
    [
      input.name ?? existing.name,
      input.color ?? existing.color,
      input.sortOrder ?? existing.sortOrder,
      id,
    ],
  );
  const updated = await getCategoryById(id);
  if (!updated) throw new Error('Failed to update category');
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('UPDATE products SET category_id = NULL WHERE category_id = ?', [id]);
  await db.runAsync('DELETE FROM categories WHERE id = ?', [id]);
}
