import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/database';
import { nowIso } from './ids';
import { setLastBackupAt, setLastBackupSize } from '../repositories/metaRepository';
import { encryptBackupPayload, decryptBackupPayload } from './backupCrypto';

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
  'pos_tables',
  'product_bundles',
] as const;

export async function exportJsonBackup(): Promise<{ path: string; sizeBytes: number }> {
  const db = getDb();
  const data: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
    data[table] = rows;
  }

  const payload = { version: 1, exportedAt: nowIso(), data };
  const content = JSON.stringify(payload);
  const path = `${FileSystem.cacheDirectory}pos-mini-backup-${Date.now()}.json`;
  await FileSystem.writeAsStringAsync(path, content);
  const info = await FileSystem.getInfoAsync(path);
  const sizeBytes =
    info.exists && 'size' in info && typeof info.size === 'number' ? info.size : content.length;
  return { path, sizeBytes };
}

async function finalizeBackupExport(path: string, sizeBytes: number): Promise<void> {
  await setLastBackupAt(nowIso());
  await setLastBackupSize(sizeBytes);
}

export async function exportAndShareJsonBackup(password?: string): Promise<number> {
  const { path, sizeBytes } = await exportJsonBackup();
  if (password?.trim()) {
    const raw = await FileSystem.readAsStringAsync(path);
    const encrypted = await encryptBackupPayload(raw, password.trim());
    const encPath = `${FileSystem.cacheDirectory}pos-mini-backup-enc-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(encPath, encrypted);
    await finalizeBackupExport(encPath, encrypted.length);
    await shareFile(encPath);
    return encrypted.length;
  }
  await finalizeBackupExport(path, sizeBytes);
  await shareFile(path);
  return sizeBytes;
}

/** Opens the system share sheet so the user can pick Google Drive (or any cloud app). */
export async function uploadBackupToGoogleDrive(): Promise<number> {
  const { path, sizeBytes } = await exportJsonBackup();
  await finalizeBackupExport(path, sizeBytes);
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Save backup to Google Drive',
    UTI: 'public.json',
  });
  return sizeBytes;
}

export async function estimateJsonBackupSize(): Promise<number> {
  const { sizeBytes } = await exportJsonBackup();
  return sizeBytes;
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
  const info = await FileSystem.getInfoAsync(path);
  const sizeBytes =
    info.exists && 'size' in info && typeof info.size === 'number' ? info.size : 0;
  await finalizeBackupExport(path, sizeBytes);
  await shareFile(path);
}

export async function importJsonBackup(jsonContent: string, password?: string): Promise<void> {
  let content = jsonContent;
  try {
    const wrapper = JSON.parse(jsonContent) as { encrypted?: boolean };
    if (wrapper.encrypted) {
      if (!password?.trim()) throw new Error('Password required for encrypted backup');
      content = await decryptBackupPayload(jsonContent, password.trim());
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('Password')) throw e;
  }

  const payload = JSON.parse(content) as {
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
