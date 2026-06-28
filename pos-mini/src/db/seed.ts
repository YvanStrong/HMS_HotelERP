import type { SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_CATEGORIES = [
  { name: 'General', color: '#1d4ed8', sortOrder: 0 },
  { name: 'Food & Drinks', color: '#b45309', sortOrder: 1 },
  { name: 'Electronics', color: '#7c3aed', sortOrder: 2 },
  { name: 'Clothing', color: '#db2777', sortOrder: 3 },
  { name: 'Services', color: '#0891b2', sortOrder: 4 },
  { name: 'Other', color: '#64748b', sortOrder: 5 },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function seedDefaultData(db: SQLiteDatabase): Promise<void> {
  const now = nowIso();

  await db.runAsync(
    `INSERT OR IGNORE INTO business_settings (
      id, business_name, business_logo, tax_name, address, phone, email, currency, currency_symbol,
      tax_enabled, tax_rate, tax_inclusive, receipt_header, receipt_footer,
      pin_enabled, low_stock_alert, created_at, updated_at
    ) VALUES (1, '', NULL, 'Tax', '', '', '', 'USD', '$', 0, 0, 0, '', 'Thank you!', 0, 1, ?, ?)`,
    [now, now],
  );

  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO categories (id, name, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)',
      [newId(), cat.name, cat.color, cat.sortOrder, now],
    );
  }

  const sequences = ['INV-', 'PO-', 'REF-'];
  for (const prefix of sequences) {
    await db.runAsync(
      'INSERT OR IGNORE INTO number_sequences (prefix, last_number) VALUES (?, 0)',
      [prefix],
    );
  }
}
