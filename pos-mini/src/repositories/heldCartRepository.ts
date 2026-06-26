import type { HeldCart } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type HeldCartRow = {
  id: string;
  label: string | null;
  cart_json: string;
  created_at: string;
};

function mapRow(row: HeldCartRow): HeldCart {
  return {
    id: row.id,
    label: row.label,
    cartJson: row.cart_json,
    createdAt: row.created_at,
  };
}

export async function listHeldCarts(): Promise<HeldCart[]> {
  const db = getDb();
  const rows = await db.getAllAsync<HeldCartRow>(
    'SELECT * FROM held_carts ORDER BY created_at DESC',
  );
  return rows.map(mapRow);
}

export async function saveHeldCart(cartJson: string, label?: string | null): Promise<HeldCart> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    'INSERT INTO held_carts (id, label, cart_json, created_at) VALUES (?, ?, ?, ?)',
    [id, label ?? null, cartJson, now],
  );
  return { id, label: label ?? null, cartJson, createdAt: now };
}

export async function deleteHeldCart(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync('DELETE FROM held_carts WHERE id = ?', [id]);
}

export async function getHeldCart(id: string): Promise<HeldCart | null> {
  const db = getDb();
  const row = await db.getFirstAsync<HeldCartRow>('SELECT * FROM held_carts WHERE id = ?', [id]);
  return row ? mapRow(row) : null;
}
