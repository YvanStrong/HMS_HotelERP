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

async function migrateToV6(db: SQLiteDatabase): Promise<void> {
  await safeAlter(
    db,
    "ALTER TABLE business_settings ADD COLUMN business_type TEXT NOT NULL DEFAULT 'retail_store'",
  );
}

async function ensureStaffUsernameColumn(db: SQLiteDatabase): Promise<void> {
  const table = await db.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'staff'",
  );
  if (!table) return;

  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(staff)');
  const hasUsername = cols.some((c) => c.name === 'username');
  if (!hasUsername) {
    await db.execAsync("ALTER TABLE staff ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  }

  const rows = await db.getAllAsync<{ id: string; name: string; username: string | null }>(
    'SELECT id, name, username FROM staff',
  );
  for (const row of rows) {
    if (row.username?.trim()) continue;
    const base =
      row.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'user';
    const username = `${base}.${row.id.slice(0, 4)}`;
    await db.runAsync('UPDATE staff SET username = ? WHERE id = ?', [username, row.id]);
  }
}

async function ensureBusinessTypeColumn(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(business_settings)');
  if (!cols.some((c) => c.name === 'business_type')) {
    await db.execAsync(
      "ALTER TABLE business_settings ADD COLUMN business_type TEXT NOT NULL DEFAULT 'retail_store'",
    );
  }
}

async function ensureTaxClassColumn(db: SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(products)');
  if (!cols.some((c) => c.name === 'tax_class')) {
    await db.execAsync("ALTER TABLE products ADD COLUMN tax_class TEXT NOT NULL DEFAULT 'A'");
  }
}

/** Idempotent fixes when schema_version advanced before a column migration ran. */
async function repairSchema(db: SQLiteDatabase): Promise<void> {
  await ensureBusinessTypeColumn(db);
  await ensureStaffUsernameColumn(db);
  await ensureTaxClassColumn(db);
}

async function migrateToV7(db: SQLiteDatabase): Promise<void> {
  await ensureStaffUsernameColumn(db);
}

/** Product tax_class (HEAD); was v8 on GILBERT_ERP before cherry-pick. */
async function migrateToV8(db: SQLiteDatabase): Promise<void> {
  await ensureTaxClassColumn(db);
  // Sync legacy is_taxable rows into tax_class where still at default A.
  await safeAlter(
    db,
    `UPDATE products SET tax_class = 'B' WHERE is_taxable = 1 AND (tax_class IS NULL OR tax_class = 'A')`,
  );
}

/** e8dbad3 v8: default tax-inclusive for taxable products. */
async function migrateToV9(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('UPDATE products SET tax_inclusive = 1 WHERE is_taxable = 1');
}

/** e8dbad3 v9: expiry/batch, tips, credit limit, refund reason codes. */
async function migrateToV10(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN expiry_date TEXT');
  await safeAlter(db, 'ALTER TABLE products ADD COLUMN batch_lot TEXT');
  await safeAlter(db, 'ALTER TABLE customers ADD COLUMN credit_limit REAL NOT NULL DEFAULT 0');
  await safeAlter(db, 'ALTER TABLE sales ADD COLUMN tip_amount REAL NOT NULL DEFAULT 0');
  await safeAlter(db, 'ALTER TABLE sales ADD COLUMN service_charge REAL NOT NULL DEFAULT 0');
  await safeAlter(db, 'ALTER TABLE refund_items ADD COLUMN reason_code TEXT');
  await db.runAsync(
    'INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)',
    ['require_shift', '0'],
  );
}

/** e8dbad3 v10: tables service + product bundles. */
async function migrateToV11(db: SQLiteDatabase): Promise<void> {
  await safeAlter(db, 'ALTER TABLE sales ADD COLUMN table_id TEXT');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pos_tables (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      seats INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available',
      merged_into_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (merged_into_id) REFERENCES pos_tables(id)
    );
    CREATE TABLE IF NOT EXISTS product_bundles (
      id TEXT PRIMARY KEY NOT NULL,
      parent_product_id TEXT NOT NULL,
      child_product_id TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY (parent_product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (child_product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_table ON sales(table_id);
    CREATE INDEX IF NOT EXISTS idx_pos_tables_status ON pos_tables(status);
    CREATE INDEX IF NOT EXISTS idx_product_bundles_parent ON product_bundles(parent_product_id);
  `);
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM pos_tables');
  if ((count?.count ?? 0) === 0) {
    const now = new Date().toISOString();
    for (let i = 1; i <= 8; i += 1) {
      const id = `table-seed-${i}`;
      await db.runAsync(
        `INSERT INTO pos_tables (id, name, seats, status, merged_into_id, created_at, updated_at)
         VALUES (?, ?, 4, 'available', NULL, ?, ?)`,
        [id, `Table ${i}`, now, now],
      );
    }
  }
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

  if (current < 6) {
    await migrateToV6(db);
    current = 6;
    await setSchemaVersion(db, 6);
  }

  if (current < 7) {
    await migrateToV7(db);
    current = 7;
    await setSchemaVersion(db, 7);
  }

  if (current < 8) {
    await migrateToV8(db);
    current = 8;
    await setSchemaVersion(db, 8);
  }

  if (current < 9) {
    await migrateToV9(db);
    current = 9;
    await setSchemaVersion(db, 9);
  }

  if (current < 10) {
    await migrateToV10(db);
    current = 10;
    await setSchemaVersion(db, 10);
  }

  if (current < 11) {
    await migrateToV11(db);
    current = 11;
    await setSchemaVersion(db, 11);
  }

  await repairSchema(db);

  if (current < SCHEMA_VERSION) {
    await setSchemaVersion(db, SCHEMA_VERSION);
  }
}
