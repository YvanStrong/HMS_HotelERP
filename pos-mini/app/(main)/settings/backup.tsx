import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import { getLastBackupAt } from '../../../src/repositories/metaRepository';
import { createProduct } from '../../../src/repositories/productRepository';
import {
  exportAndShareCsv,
  exportAndShareDatabase,
  exportAndShareJsonBackup,
  importJsonBackup,
  uploadBackupToGoogleDrive,
} from '../../../src/utils/export';
import { useAppStore } from '../../../src/store/appStore';
import { listProducts } from '../../../src/repositories/productRepository';
import { listSales } from '../../../src/repositories/saleRepository';
import { useThemeColors } from '../../../src/hooks/useTheme';

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function BackupSettingsScreen() {
  const colors = useThemeColors();
  const init = useAppStore((s) => s.init);
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getLastBackupAt().then(setLastBackup);
    }, []),
  );

  const backupDays = daysSince(lastBackup);
  const backupWarning = backupDays !== null && backupDays > 7;

  const exportProductsCsv = async () => {
    setBusy(true);
    try {
      const products = await listProducts(false);
      await exportAndShareCsv(
        'products.csv',
        ['Name', 'SKU', 'Barcode', 'Cost', 'Sell', 'Stock', 'Unit', 'Tax Class'],
        products.map((p) => [
          p.name, p.sku ?? '', p.barcode ?? '', String(p.costPrice), String(p.sellPrice), String(p.stockQty), p.unit, p.taxClass,
        ]),
      );
      Toast.show({ type: 'success', text1: 'Products exported' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setBusy(false);
    }
  };

  const exportSalesCsv = async () => {
    setBusy(true);
    try {
      const sales = await listSales(500);
      await exportAndShareCsv(
        'sales.csv',
        ['Invoice', 'Date', 'Total', 'Paid', 'Method', 'Status'],
        sales.map((s) => [s.invoiceNumber, s.createdAt, String(s.total), String(s.amountPaid), s.paymentMethod, s.status]),
      );
      Toast.show({ type: 'success', text1: 'Sales exported' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setBusy(false);
    }
  };

  const shareJson = async () => {
    setBusy(true);
    try {
      await exportAndShareJsonBackup();
      setLastBackup(await getLastBackupAt());
      Toast.show({ type: 'success', text1: 'JSON backup shared' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Backup failed' });
    } finally {
      setBusy(false);
    }
  };

  const uploadToDrive = async () => {
    setBusy(true);
    try {
      await uploadBackupToGoogleDrive();
      setLastBackup(await getLastBackupAt());
      Toast.show({
        type: 'success',
        text1: 'Choose Google Drive',
        text2: 'Pick Google Drive from the share menu to upload',
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Upload failed' });
    } finally {
      setBusy(false);
    }
  };

  const shareDb = async () => {
    setBusy(true);
    try {
      await exportAndShareDatabase();
      setLastBackup(await getLastBackupAt());
      Toast.show({ type: 'success', text1: 'Database file shared' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setBusy(false);
    }
  };

  const importProductsCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const lines = content.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        Toast.show({ type: 'error', text1: 'CSV is empty' });
        return;
      }
      let imported = 0;
      for (const line of lines.slice(1)) {
        const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
        const [name, sku, barcode, cost, sell, stock, unit, taxClass] = cols;
        if (!name?.trim()) continue;
        await createProduct({
          name: name.trim(),
          description: null,
          sku: sku || null,
          barcode: barcode || null,
          categoryId: null,
          costPrice: Number(cost) || 0,
          sellPrice: Number(sell) || 0,
          stockQty: Number(stock) || 0,
          minStock: 0,
          unit: unit || 'pcs',
          taxClass: taxClass === 'B' ? 'B' : 'A',
          isTaxable: taxClass === 'B',
          taxRate: taxClass === 'B' ? 18 : 0,
          taxInclusive: false,
          imageUri: null,
          trackStock: true,
          isActive: true,
        });
        imported += 1;
      }
      Toast.show({ type: 'success', text1: `${imported} products imported` });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Import failed' });
    }
  };

  const pickImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled || !result.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      setPendingImport(content);
      setImportConfirm(true);
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Import failed' });
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setBusy(true);
    try {
      await importJsonBackup(pendingImport);
      await init();
      Toast.show({ type: 'success', text1: 'Backup restored' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Restore failed' });
    } finally {
      setBusy(false);
      setImportConfirm(false);
      setPendingImport(null);
    }
  };

  return (
    <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <Text className="mb-2 text-xl font-bold text-app-text">Backup & Export</Text>
      {lastBackup ? (
        <Text className={`mb-2 text-sm ${backupWarning ? 'text-red-600' : 'text-gray-600'}`}>
          Last backup: {new Date(lastBackup).toLocaleString()}
          {backupWarning ? ` (${backupDays} days ago — consider backing up)` : ''}
        </Text>
      ) : (
        <Text className="mb-2 text-sm text-amber-700">No backup recorded yet.</Text>
      )}

      <Pressable disabled={busy} onPress={() => void shareJson()} className="mb-2 rounded-xl p-4" style={{ backgroundColor: colors.primary }}>
        <Text className="font-bold text-white">Export JSON Backup</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void uploadToDrive()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Upload to Google Drive</Text>
        <Text className="mt-1 text-sm text-app-muted">Creates a backup and opens share — choose Google Drive</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void shareDb()} className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Export SQLite Database</Text>
      </Pressable>

      <Pressable disabled={busy} onPress={() => void exportProductsCsv()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Export Products CSV</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void exportSalesCsv()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Export Sales CSV</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={() => void importProductsCsv()} className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Import Products CSV</Text>
        <Text className="text-sm text-app-muted">Columns: Name, SKU, Barcode, Cost, Sell, Stock, Unit, Tax Class (A or B)</Text>
      </Pressable>

      <Pressable disabled={busy} onPress={() => void pickImport()} className="rounded-xl border border-app-border bg-app-surface p-4">
        <Text className="font-bold text-app-text">Import JSON Backup</Text>
        <Text className="text-sm text-red-600">Replaces all current data</Text>
      </Pressable>

      <ConfirmModal
        visible={importConfirm}
        title="Restore backup?"
        message="This will replace all current data with the backup."
        confirmLabel="Restore"
        destructive
        onConfirm={() => void confirmImport()}
        onCancel={() => { setImportConfirm(false); setPendingImport(null); }}
      />
    </KeyboardFormScroll>
  );
}
