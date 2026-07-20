import type { Staff, StaffRole } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { hashPin } from '../utils/pin';
import { getCurrentStaffId, setCurrentStaffId } from './metaRepository';

type StaffRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  pin_hash: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function fallbackUsername(name: string, id: string): string {
  return `${slugifyUsername(name)}.${id.slice(0, 4)}`;
}

function mapStaff(row: StaffRow): Staff {
  const username = row.username?.trim() ? row.username.trim() : fallbackUsername(row.name, row.id);
  return {
    id: row.id,
    name: row.name,
    username,
    role: row.role as StaffRole,
    pinHash: row.pin_hash,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slugifyUsername(value: string | null | undefined): string {
  return (
    (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'user'
  );
}

async function ensureUniqueUsername(base: string, excludeId?: string): Promise<string> {
  const db = getDb();
  let candidate = base;
  let suffix = 1;
  while (true) {
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM staff WHERE username = ? AND is_active = 1' + (excludeId ? ' AND id != ?' : ''),
      excludeId ? [candidate, excludeId] : [candidate],
    );
    if (!row) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

export async function listStaff(activeOnly = true): Promise<Staff[]> {
  const db = getDb();
  const rows = await db.getAllAsync<StaffRow>(
    activeOnly
      ? 'SELECT * FROM staff WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM staff ORDER BY name ASC',
  );
  for (const row of rows) {
    if (!row.username?.trim()) {
      const username = fallbackUsername(row.name, row.id);
      await db.runAsync('UPDATE staff SET username = ? WHERE id = ?', [username, row.id]);
      row.username = username;
    }
  }
  return rows.map(mapStaff);
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const db = getDb();
  const row = await db.getFirstAsync<StaffRow>('SELECT * FROM staff WHERE id = ?', [id]);
  if (!row) return null;
  if (!row.username?.trim()) {
    const generated = fallbackUsername(row.name, row.id);
    await db.runAsync('UPDATE staff SET username = ? WHERE id = ?', [generated, row.id]);
    row.username = generated;
  }
  return mapStaff(row);
}

export async function getStaffByUsername(username: string): Promise<Staff | null> {
  const db = getDb();
  const normalized = (username ?? '').trim().toLowerCase();
  if (!normalized) return null;
  const row = await db.getFirstAsync<StaffRow>(
    'SELECT * FROM staff WHERE LOWER(username) = ? AND is_active = 1',
    [normalized],
  );
  return row ? mapStaff(row) : null;
}

export async function createStaff(input: {
  name: string;
  username?: string;
  role: StaffRole;
  pin: string;
}): Promise<Staff> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const pinHash = await hashPin(input.pin);
  const username = await ensureUniqueUsername(
    slugifyUsername(input.username?.trim() || input.name),
  );
  await db.runAsync(
    `INSERT INTO staff (id, name, username, role, pin_hash, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, input.name.trim(), username, input.role, pinHash, now, now],
  );
  const created = await getStaffById(id);
  if (!created) throw new Error('Failed to create staff');
  return created;
}

export async function updateStaff(
  id: string,
  input: Partial<{ name: string; username: string; role: StaffRole; pin: string; isActive: boolean }>,
): Promise<Staff> {
  const db = getDb();
  const existing = await getStaffById(id);
  if (!existing) throw new Error('Staff not found');
  const now = nowIso();
  const pinHash = input.pin ? await hashPin(input.pin) : existing.pinHash;
  const username = input.username
    ? await ensureUniqueUsername(slugifyUsername(input.username), id)
    : existing.username;
  await db.runAsync(
    `UPDATE staff SET name = ?, username = ?, role = ?, pin_hash = ?, is_active = ?, updated_at = ? WHERE id = ?`,
    [
      input.name?.trim() ?? existing.name,
      username,
      input.role ?? existing.role,
      pinHash,
      input.isActive === undefined ? (existing.isActive ? 1 : 0) : input.isActive ? 1 : 0,
      now,
      id,
    ],
  );
  const updated = await getStaffById(id);
  if (!updated) throw new Error('Failed to update staff');
  return updated;
}

export async function deactivateStaff(id: string): Promise<void> {
  const currentId = await getCurrentStaffId();
  if (currentId === id) {
    await setCurrentStaffId(null);
  }
  await updateStaff(id, { isActive: false });
}

export async function verifyStaffPin(id: string, pin: string): Promise<boolean> {
  const staff = await getStaffById(id);
  if (!staff || !staff.isActive) return false;
  const hash = await hashPin(pin);
  return staff.pinHash === hash;
}

export async function verifyStaffLogin(username: string, pin: string): Promise<Staff | null> {
  const staff = await getStaffByUsername(username);
  if (!staff) return null;
  const ok = await verifyStaffPin(staff.id, pin);
  return ok ? staff : null;
}

export async function verifyManagerPin(pin: string): Promise<Staff | null> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM staff WHERE is_active = 1 AND role = ?',
    ['manager'],
  );
  for (const row of rows) {
    const ok = await verifyStaffPin(row.id, pin);
    if (ok) return getStaffById(row.id);
  }
  return null;
}

export async function staffCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM staff WHERE is_active = 1',
  );
  return row?.count ?? 0;
}
