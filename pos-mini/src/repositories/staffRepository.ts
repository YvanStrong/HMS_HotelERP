import type { Staff, StaffRole } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';
import { hashPin } from '../utils/pin';

type StaffRow = {
  id: string;
  name: string;
  role: string;
  pin_hash: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function mapStaff(row: StaffRow): Staff {
  return {
    id: row.id,
    name: row.name,
    role: row.role as StaffRole,
    pinHash: row.pin_hash,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listStaff(activeOnly = true): Promise<Staff[]> {
  const db = getDb();
  const rows = await db.getAllAsync<StaffRow>(
    activeOnly
      ? 'SELECT * FROM staff WHERE is_active = 1 ORDER BY name ASC'
      : 'SELECT * FROM staff ORDER BY name ASC',
  );
  return rows.map(mapStaff);
}

export async function getStaffById(id: string): Promise<Staff | null> {
  const db = getDb();
  const row = await db.getFirstAsync<StaffRow>('SELECT * FROM staff WHERE id = ?', [id]);
  return row ? mapStaff(row) : null;
}

export async function createStaff(input: {
  name: string;
  role: StaffRole;
  pin: string;
}): Promise<Staff> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  const pinHash = await hashPin(input.pin);
  await db.runAsync(
    `INSERT INTO staff (id, name, role, pin_hash, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [id, input.name.trim(), input.role, pinHash, now, now],
  );
  const created = await getStaffById(id);
  if (!created) throw new Error('Failed to create staff');
  return created;
}

export async function updateStaff(
  id: string,
  input: Partial<{ name: string; role: StaffRole; pin: string; isActive: boolean }>,
): Promise<Staff> {
  const db = getDb();
  const existing = await getStaffById(id);
  if (!existing) throw new Error('Staff not found');
  const now = nowIso();
  const pinHash = input.pin ? await hashPin(input.pin) : existing.pinHash;
  await db.runAsync(
    `UPDATE staff SET name = ?, role = ?, pin_hash = ?, is_active = ?, updated_at = ? WHERE id = ?`,
    [
      input.name?.trim() ?? existing.name,
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

export async function verifyStaffPin(id: string, pin: string): Promise<boolean> {
  const staff = await getStaffById(id);
  if (!staff || !staff.isActive) return false;
  const hash = await hashPin(pin);
  return staff.pinHash === hash;
}

export async function staffCount(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM staff WHERE is_active = 1',
  );
  return row?.count ?? 0;
}
