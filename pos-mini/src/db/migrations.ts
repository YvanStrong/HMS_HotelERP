import type { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_V1, SCHEMA_VERSION } from './schema';
import { seedDefaultData } from './seed';

const META_VERSION_KEY = 'schema_version';

export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      [META_VERSION_KEY],
    );
    return row ? Number(row.value) : 0;
  } catch {
    return 0;
  }
}

async function setSchemaVersion(db: SQLiteDatabase, version: number): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    [META_VERSION_KEY, String(version)],
  );
}

async function safeAlter(db: SQLiteDatabase, sql: string): Promise<void> {
  try {
    await db.execAsync(sql);
  } catch {
    // Column or table may already exist on partially migrated DBs.
  }
}

async function migrateToV2(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE business_settings ADD COLUMN business_logo TEXT');
  await safeAlter(db, "ALTER TABLE business_settings ADD COLUMN tax_name TEXT NOT NULL DEFAULT 'Tax'");
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN description TEXT');
}

async function migrateToV3(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE refund_items ADD COLUMN restock INTEGER NOT NULL DEFAULT 1');

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS sale_payments (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash REAL NOT NULL DEFAULT 0,
      closing_cash REAL,
      expected_cash REAL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'open'
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      pin_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS held_carts (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT,
      cart_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );

  await safeAlter(db, 'CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id)');
}

async function migrateToV4(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE sales ADD COLUMN staff_id TEXT');
  await safeAlter(db, 'ALTER TABLE sales ADD COLUMN shift_id TEXT');
  await safeAlter(db, 'ALTER TABLE sale_items ADD COLUMN variant_id TEXT');
  await safeAlter(db, 'ALTER TABLE sale_items ADD COLUMN variant_name TEXT');
  await safeAlter(db, 'ALTER TABLE sale_items ADD COLUMN modifiers_json TEXT');

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      sell_price REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      stock_qty REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS modifier_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      min_select INTEGER NOT NULL DEFAULT 0,
      max_select INTEGER NOT NULL DEFAULT 1,
      required INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS modifier_options (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price_delta REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS product_modifier_groups (
      product_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      PRIMARY KEY (product_id, group_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
    )`,
  );

  await safeAlter(
    db,
    `CREATE TABLE IF NOT EXISTS kitchen_tickets (
      id TEXT PRIMARY KEY NOT NULL,
      sale_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      items_json TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    )`,
  );

  await safeAlter(db, 'CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id)');
  await safeAlter(db, 'CREATE INDEX IF NOT EXISTS idx_kitchen_tickets_status ON kitchen_tickets(status)');
}

async function migrateToV5(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN is_taxable INTEGER NOT NULL DEFAULT 0');
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0');
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN tax_inclusive INTEGER NOT NULL DEFAULT 0');
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  let current = await getSchemaVersion(db);

  if (current < 1) {
    await db.execAsync(CREATE_TABLES_V1);
    await seedDefaultData(db);
    current = 1;
    await setSchemaVersion(db, 1);
  }

  if (current < 2) {
    await migrateToV2(db);
    current = 2;
    await setSchemaVersion(db, 2);
  }

  if (current < 3) {
    await migrateToV3(db);
    current = 3;
    await setSchemaVersion(db, 3);
  }

  if (current < 4) {
    await migrateToV4(db);
    current = 4;
    await setSchemaVersion(db, 4);
  }

  if (current < 5) {
    await migrateToV5(db);
    current = 5;
    await setSchemaVersion(db, 5);
  }

  if (current < SCHEMA_VERSION) {
    await setSchemaVersion(db, SCHEMA_VERSION);
  }
}

