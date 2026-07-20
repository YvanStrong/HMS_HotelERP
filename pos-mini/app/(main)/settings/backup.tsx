import { useCallback, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { ConfirmModal } from '../../../src/components/ConfirmModal';
import { BackupProgressOverlay } from '../../../src/components/BackupProgressOverlay';
import { KeyboardFormScroll } from '../../../src/components/KeyboardFormScroll';
import {
  getBackupSettings,
  getLastBackupAt,
  getLastBackupSize,
  getBackupEncryptionEnabled,
  saveBackupEncryptionEnabled,
  saveBackupSettings,
  type BackupFrequency,
} from '../../../src/repositories/metaRepository';
import { countProducts } from '../../../src/repositories/productRepository';
import { createProduct } from '../../../src/repositories/productRepository';
import {
  exportAndShareCsv,
  exportAndShareDatabase,
  exportAndShareJsonBackup,
  estimateJsonBackupSize,
  importJsonBackup,
  uploadBackupToGoogleDrive,
} from '../../../src/utils/export';
import {
  backupReminderMessage,
  formatBackupSize,
  isBackupReminderDue,
} from '../../../src/utils/backup';
import { useAppStore } from '../../../src/store/appStore';
import { listProducts } from '../../../src/repositories/productRepository';
import { listSales } from '../../../src/repositories/saleRepository';
import { useThemeColors } from '../../../src/hooks/useTheme';

const FREQUENCIES: { id: BackupFrequency; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function BackupSettingsScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const init = useAppStore((s) => s.init);
  const [importConfirm, setImportConfirm] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('Creating backup…');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [lastSize, setLastSize] = useState<number | null>(null);
  const [estimateSize, setEstimateSize] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<BackupFrequency>('weekly');
  const [reminderDue, setReminderDue] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [encryptBackups, setEncryptBackups] = useState(false);
  const [backupPassword, setBackupPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');

  const refresh = useCallback(async () => {
    const [backupAt, backupSize, settings, productCount, encrypt] = await Promise.all([
      getLastBackupAt(),
      getLastBackupSize(),
      getBackupSettings(),
      countProducts(),
      getBackupEncryptionEnabled(),
    ]);
    setLastBackup(backupAt);
    setLastSize(backupSize);
    setFrequency(settings.reminderFrequency);
    setHasData(productCount > 0);
    setEncryptBackups(encrypt);
    setReminderDue(isBackupReminderDue(backupAt, settings.reminderFrequency, productCount > 0));
    try {
      const size = await estimateJsonBackupSize();
      setEstimateSize(size);
    } catch {
      setEstimateSize(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const setReminderFrequency = async (next: BackupFrequency) => {
    setFrequency(next);
    await saveBackupSettings({ reminderFrequency: next });
    setReminderDue(isBackupReminderDue(lastBackup, next, hasData));
    Toast.show({ type: 'success', text1: 'Reminder schedule saved' });
  };

  const runBackup = async (
    action: () => Promise<number>,
    label: string,
    successTitle: string,
    successDetail?: string,
  ) => {
    setBusyLabel(label);
    setBusy(true);
    try {
      const sizeBytes = await action();
      setLastBackup(await getLastBackupAt());
      setLastSize(sizeBytes);
      setEstimateSize(sizeBytes);
      setReminderDue(isBackupReminderDue(await getLastBackupAt(), frequency, hasData));
      Toast.show({ type: 'success', text1: successTitle, text2: successDetail ?? formatBackupSize(sizeBytes) });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Backup failed' });
    } finally {
      setBusy(false);
    }
  };

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
          expiryDate: null,
          batchLot: null,
          trackStock: true,
          isActive: true,
        });
        imported += 1;
      }
      Toast.show({ type: 'success', text1: `${imported} products imported` });
      void refresh();
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
    setBusyLabel('Restoring backup…');
    setBusy(true);
    try {
      await importJsonBackup(pendingImport, importPassword || undefined);
      await init();
      Toast.show({ type: 'success', text1: 'Backup restored' });
      void refresh();
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Restore failed' });
    } finally {
      setBusy(false);
      setImportConfirm(false);
      setPendingImport(null);
    }
  };

  return (
    <>
      <KeyboardFormScroll contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text className="mb-2 text-xl font-bold text-app-text">Backup & Restore</Text>

        {reminderDue && frequency !== 'off' ? (
          <View className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
            <View className="mb-1 flex-row items-center gap-2">
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text className="font-bold text-app-text">Backup reminder</Text>
            </View>
            <Text className="text-sm text-app-muted">{backupReminderMessage(lastBackup, frequency)}</Text>
          </View>
        ) : null}

        <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="mb-2 font-semibold text-app-text">Backup status</Text>
          <Text className="text-sm text-app-muted">
            Last backup: {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never'}
          </Text>
          <Text className="mt-1 text-sm text-app-muted">
            Last backup size: {formatBackupSize(lastSize)}
          </Text>
          <Text className="mt-1 text-sm text-app-muted">
            Current data size (estimate): {formatBackupSize(estimateSize)}
          </Text>
        </View>

        <Text className="mb-2 text-sm font-semibold text-app-text">Reminder frequency</Text>
        <Text className="mb-3 text-xs text-app-muted">
          Shows a reminder banner on this page when a backup is due. Does not pop up on the home screen.
        </Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {FREQUENCIES.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => void setReminderFrequency(f.id)}
              className="rounded-lg border px-4 py-2"
              style={{
                borderColor: frequency === f.id ? colors.primary : colors.border,
                backgroundColor: frequency === f.id ? colors.primarySoft : colors.surface,
              }}
            >
              <Text className="font-semibold text-app-text">{f.label}</Text>
            </Pressable>
          ))}
        </View>

        <View className="mb-4 flex-row items-center justify-between rounded-xl border border-app-border bg-app-surface px-4 py-3">
          <View className="mr-3 flex-1">
            <Text className="font-semibold text-app-text">Encrypt JSON backups</Text>
            <Text className="mt-1 text-xs text-app-muted">Optional password protection on export (not full DB file).</Text>
          </View>
          <Switch
            value={encryptBackups}
            onValueChange={(v) => {
              setEncryptBackups(v);
              void saveBackupEncryptionEnabled(v);
            }}
            trackColor={{ true: colors.primary }}
          />
        </View>
        {encryptBackups ? (
          <TextInput
            value={backupPassword}
            onChangeText={setBackupPassword}
            placeholder="Backup password"
            secureTextEntry
            className="mb-4 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-app-text"
          />
        ) : null}

        <Pressable
          disabled={busy}
          onPress={() =>
            void runBackup(
              uploadBackupToGoogleDrive,
              'Preparing Google Drive upload…',
              'Backup ready',
              'Choose Google Drive from the share menu',
            )
          }
          className="mb-2 rounded-xl p-4"
          style={{ backgroundColor: colors.primary }}
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="logo-google" size={24} color="#fff" />
            <View className="flex-1">
              <Text className="font-bold text-white">Save to Google Drive</Text>
              <Text className="mt-1 text-sm text-white/80">Creates JSON backup · opens share sheet</Text>
            </View>
          </View>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={() =>
            void runBackup(
              () => exportAndShareJsonBackup(encryptBackups ? backupPassword : undefined),
              'Creating JSON backup…',
              'JSON backup shared',
            )
          }
          className="mb-2 rounded-xl border border-app-border bg-app-surface p-4"
        >
          <Text className="font-bold text-app-text">Export JSON backup</Text>
          <Text className="mt-1 text-sm text-app-muted">Share via any app (email, files, cloud)</Text>
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={() => {
            setBusyLabel('Exporting database…');
            setBusy(true);
            void exportAndShareDatabase()
              .then(() => {
                Toast.show({ type: 'success', text1: 'Database file shared' });
                void refresh();
              })
              .catch((e) => Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Export failed' }))
              .finally(() => setBusy(false));
          }}
          className="mb-4 rounded-xl border border-app-border bg-app-surface p-4"
        >
          <Text className="font-bold text-app-text">Export SQLite database</Text>
        </Pressable>

        <Text className="mb-2 text-sm font-semibold text-app-text">CSV tools</Text>
        <Pressable disabled={busy} onPress={() => void exportProductsCsv()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Export products CSV</Text>
          <Text className="mt-1 text-sm text-app-muted">Includes Tax Class (A or B)</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void exportSalesCsv()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Export sales CSV</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void importProductsCsv()} className="mb-2 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Import Products CSV</Text>
          <Text className="text-sm text-app-muted">Columns: Name, SKU, Barcode, Cost, Sell, Stock, Unit, Tax Class (A or B)</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => router.push('/(main)/settings/import-csv')} className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Import products CSV (preview)</Text>
          <Text className="mt-1 text-sm text-app-muted">Validate rows before importing</Text>
        </Pressable>

        <TextInput
          value={importPassword}
          onChangeText={setImportPassword}
          placeholder="Import password (if backup was encrypted)"
          secureTextEntry
          className="mb-2 rounded-xl border border-app-border bg-app-surface px-4 py-3 text-app-text"
        />
        <Pressable disabled={busy} onPress={() => void pickImport()} className="mb-8 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="font-bold text-app-text">Import JSON backup</Text>
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

      <BackupProgressOverlay visible={busy} label={busyLabel} detail={estimateSize ? `~${formatBackupSize(estimateSize)}` : undefined} />
    </>
  );
}
