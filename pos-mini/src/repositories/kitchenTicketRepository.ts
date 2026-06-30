import type { KitchenTicket, KitchenTicketStatus, SelectedModifier } from '../types';
import { getDb } from '../db/database';
import { generateId, nowIso } from '../utils/ids';

type TicketRow = {
  id: string;
  sale_id: string;
  invoice_number: string;
  status: string;
  items_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type KitchenTicketItem = {
  productId: string;
  productName: string;
  variantName?: string | null;
  quantity: number;
  modifiers?: SelectedModifier[];
  notes?: string | null;
};

function mapTicket(row: TicketRow): KitchenTicket {
  return {
    id: row.id,
    saleId: row.sale_id,
    invoiceNumber: row.invoice_number,
    status: row.status as KitchenTicketStatus,
    itemsJson: row.items_json,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseKitchenItems(json: string): KitchenTicketItem[] {
  try {
    return JSON.parse(json) as KitchenTicketItem[];
  } catch {
    return [];
  }
}

export async function createKitchenTicket(input: {
  saleId: string;
  invoiceNumber: string;
  items: KitchenTicketItem[];
  notes?: string | null;
}): Promise<KitchenTicket> {
  const db = getDb();
  const id = generateId();
  const now = nowIso();
  await db.runAsync(
    `INSERT INTO kitchen_tickets (id, sale_id, invoice_number, status, items_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    [id, input.saleId, input.invoiceNumber, JSON.stringify(input.items), input.notes ?? null, now, now],
  );
  const row = await db.getFirstAsync<TicketRow>('SELECT * FROM kitchen_tickets WHERE id = ?', [id]);
  if (!row) throw new Error('Failed to create kitchen ticket');
  return mapTicket(row);
}

export async function listKitchenTickets(status?: KitchenTicketStatus): Promise<KitchenTicket[]> {
  const db = getDb();
  const rows = status
    ? await db.getAllAsync<TicketRow>(
        'SELECT * FROM kitchen_tickets WHERE status = ? ORDER BY created_at ASC',
        [status],
      )
    : await db.getAllAsync<TicketRow>(
        "SELECT * FROM kitchen_tickets WHERE status != 'done' ORDER BY created_at ASC",
      );
  return rows.map(mapTicket);
}

export async function updateKitchenTicketStatus(
  id: string,
  status: KitchenTicketStatus,
): Promise<KitchenTicket> {
  const db = getDb();
  const now = nowIso();
  await db.runAsync('UPDATE kitchen_tickets SET status = ?, updated_at = ? WHERE id = ?', [
    status,
    now,
    id,
  ]);
  const row = await db.getFirstAsync<TicketRow>('SELECT * FROM kitchen_tickets WHERE id = ?', [id]);
  if (!row) throw new Error('Kitchen ticket not found');
  return mapTicket(row);
}

export async function countPendingKitchenTickets(): Promise<number> {
  const db = getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM kitchen_tickets WHERE status IN ('pending', 'preparing')",
  );
  return row?.count ?? 0;
}
