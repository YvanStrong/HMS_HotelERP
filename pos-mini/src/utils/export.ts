import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/database';
import { nowIso } from './ids';
import { setLastBackupAt } from '../repositories/metaRepository';

export async function exportToCsv(filename: string, headers: string[], rows: string[][]): Promise<string> {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map((cell) => escape(String(cell ?? ''))).join(','));
  }

  const content = lines.join('\n');
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content);
  return path;
}

export async function shareFile(path: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path);
  }
}

export async function exportAndShareCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): Promise<void> {
  const path = await exportToCsv(filename, headers, rows);
  await shareFile(path);
}

const BACKUP_TABLES = [
  'app_meta',
  'business_settings',
  'categories',
  'products',
  'customers',
  'suppliers',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'refunds',
  'refund_items',
  'stock_movements',
  'expenses',
  'debts',
  'discount_rules',
  'number_sequences',
  'sale_payments',
  'shifts',
  'staff',
  'held_carts',
] as const;

export async function exportJsonBackup(): Promise<string> {
  const db = getDb();
  const data: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
    data[table] = rows;
  }

  const payload = { version: 1, exportedAt: nowIso(), data };
  const path = `${FileSystem.cacheDirectory}pos-mini-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload));
  return path;
}

export async function exportAndShareJsonBackup(): Promise<void> {
  const path = await exportJsonBackup();
  await setLastBackupAt(nowIso());
  await shareFile(path);
}

/** Opens the system share sheet so the user can pick Google Drive (or any cloud app). */
export async function uploadBackupToGoogleDrive(): Promise<void> {
  const path = await exportJsonBackup();
  await setLastBackupAt(nowIso());
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Save backup to Google Drive',
    UTI: 'public.json',
  });
}

export async function exportDatabaseFile(): Promise<string> {
  const sqliteDir = `${FileSystem.documentDirectory}SQLite/`;
  const dbPath = `${sqliteDir}posmini.db`;
  const info = await FileSystem.getInfoAsync(dbPath);
  if (!info.exists) {
    throw new Error('Database file not found');
  }
  const dest = `${FileSystem.cacheDirectory}posmini-${Date.now()}.db`;
  await FileSystem.copyAsync({ from: dbPath, to: dest });
  return dest;
}

export async function exportAndShareDatabase(): Promise<void> {
  const path = await exportDatabaseFile();
  await setLastBackupAt(nowIso());
  await shareFile(path);
}

export async function importJsonBackup(jsonContent: string): Promise<void> {
  const payload = JSON.parse(jsonContent) as {
    version: number;
    data: Record<string, Record<string, unknown>[]>;
  };

  if (!payload.data) throw new Error('Invalid backup file');

  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await db.runAsync(`DELETE FROM ${table}`);
    }

    for (const table of BACKUP_TABLES) {
      const rows = payload.data[table] ?? [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map((k) => row[k]);
        await db.runAsync(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
          values as (string | number | null)[],
        );
      }
    }
  });
}
