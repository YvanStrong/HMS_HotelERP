import type { CreateModifierGroupInput, CreateModifierOptionInput, ModifierGroup, ModifierOption } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type GroupRow = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  required: number;
  sort_order: number;
  is_active: number;
  created_at: string;
};

type OptionRow = {
  id: string;
  group_id: string;
  name: string;
  price_delta: number;
  sort_order: number;
  is_active: number;
};

function mapGroup(row: GroupRow): ModifierGroup {
  return {
    id: row.id,
    name: row.name,
    minSelect: row.min_select,
    maxSelect: row.max_select,
    required: row.required === 1,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

function mapOption(row: OptionRow): ModifierOption {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    priceDelta: row.price_delta,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
  };
}

export async function listModifierGroups(activeOnly = true): Promise<ModifierGroup[]> {
  const db = getDb();
  const rows = await db.getAllAsync<GroupRow>(
    activeOnly
      ? 'SELECT * FROM modifier_groups WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
      : 'SELECT * FROM modifier_groups ORDER BY sort_order ASC, name ASC',
  );
  return rows.map(mapGroup);
}

export async function getModifierGroupById(id: string): Promise<ModifierGroup | null> {
  const db = getDb();
  const row = await db.getFirstAsync<GroupRow>('SELECT * FROM modifier_groups WHERE id = ?', [id]);
  return row ? mapGroup(row) : null;
}

export async function listModifierOptions(groupId: string, activeOnly = true): Promise<ModifierOption[]> {
  const db = getDb();
  const rows = await db.getAllAsync<OptionRow>(
    activeOnly
      ? 'SELECT * FROM modifier_options WHERE group_id = ? AND is_active = 1 ORDER BY sort_order ASC, name ASC'
      : 'SELECT * FROM modifier_options WHERE group_id = ? ORDER BY sort_order ASC, name ASC',
    [groupId],
  );
  return rows.map(mapOption);
}

export async function getModifierGroupWithOptions(id: string): Promise<ModifierGroup | null> {
  const group = await getModifierGroupById(id);
  if (!group) return null;
  group.options = await listModifierOptions(id);
  return group;
}

export async function listProductModifierGroups(productId: string): Promise<ModifierGroup[]> {
  const db = getDb();
  const rows = await db.getAllAsync<GroupRow>(
    `SELECT g.* FROM modifier_groups g
     INNER JOIN product_modifier_groups pmg ON pmg.group_id = g.id
     WHERE pmg.product_id = ? AND g.is_active = 1
     ORDER BY g.sort_order ASC, g.name ASC`,
    [productId],
  );
  const groups = rows.map(mapGroup);
  for (const group of groups) {
    group.options = await listModifierOptions(group.id);
  }
  return groups;
}

export async function createModifierGroup(input: CreateModifierGroupInput): Promise<ModifierGroup> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO modifier_groups (id, name, min_select, max_select, required, sort_order, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      id,
      input.name.trim(),
      input.minSelect,
      input.maxSelect,
      input.required ? 1 : 0,
      input.sortOrder,
      now,
    ],
  );
  const created = await getModifierGroupById(id);
  if (!created) throw new Error('Failed to create modifier group');
  return created;
}

export async function updateModifierGroup(
  id: string,
  input: Partial<CreateModifierGroupInput & { isActive: boolean }>,
): Promise<ModifierGroup> {
  const db = getDb();
  const existing = await getModifierGroupById(id);
  if (!existing) throw new Error('Modifier group not found');
  await db.runAsync(
    `UPDATE modifier_groups SET name = ?, min_select = ?, max_select = ?, required = ?, sort_order = ?, is_active = ?
     WHERE id = ?`,
    [
      input.name?.trim() ?? existing.name,
      input.minSelect ?? existing.minSelect,
      input.maxSelect ?? existing.maxSelect,
      input.required === undefined ? (existing.required ? 1 : 0) : input.required ? 1 : 0,
      input.sortOrder ?? existing.sortOrder,
      input.isActive === undefined ? (existing.isActive ? 1 : 0) : input.isActive ? 1 : 0,
      id,
    ],
  );
  const updated = await getModifierGroupById(id);
  if (!updated) throw new Error('Failed to update modifier group');
  return updated;
}

export async function createModifierOption(input: CreateModifierOptionInput): Promise<ModifierOption> {
  const db = getDb();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO modifier_options (id, group_id, name, price_delta, sort_order, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, input.groupId, input.name.trim(), input.priceDelta, input.sortOrder],
  );
  const row = await db.getFirstAsync<OptionRow>('SELECT * FROM modifier_options WHERE id = ?', [id]);
  if (!row) throw new Error('Failed to create modifier option');
  return mapOption(row);
}

export async function updateModifierOption(
  id: string,
  input: Partial<Omit<ModifierOption, 'id' | 'groupId'>>,
): Promise<ModifierOption> {
  const db = getDb();
  const row = await db.getFirstAsync<OptionRow>('SELECT * FROM modifier_options WHERE id = ?', [id]);
  if (!row) throw new Error('Modifier option not found');
  await db.runAsync(
    `UPDATE modifier_options SET name = ?, price_delta = ?, sort_order = ?, is_active = ? WHERE id = ?`,
    [
      input.name?.trim() ?? row.name,
      input.priceDelta ?? row.price_delta,
      input.sortOrder ?? row.sort_order,
      input.isActive === undefined ? row.is_active : input.isActive ? 1 : 0,
      id,
    ],
  );
  const updated = await db.getFirstAsync<OptionRow>('SELECT * FROM modifier_options WHERE id = ?', [id]);
  if (!updated) throw new Error('Failed to update modifier option');
  return mapOption(updated);
}

export async function setProductModifierGroups(productId: string, groupIds: string[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM product_modifier_groups WHERE product_id = ?', [productId]);
    for (const groupId of groupIds) {
      await db.runAsync(
        'INSERT INTO product_modifier_groups (product_id, group_id) VALUES (?, ?)',
        [productId, groupId],
      );
    }
  });
}

export async function getProductModifierGroupIds(productId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ group_id: string }>(
    'SELECT group_id FROM product_modifier_groups WHERE product_id = ?',
    [productId],
  );
  return rows.map((r) => r.group_id);
}
