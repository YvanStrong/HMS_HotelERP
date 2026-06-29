import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { getDb } from '../../../src/db/database';
import {
  exportAndShareCsv,
  exportAndShareJsonBackup,
} from '../../../src/utils/export';
import { colors } from '../../../src/constants/theme';

type ExportKind = 'sales' | 'products' | 'stock' | 'backup';

export default function ExportReportScreen() {
  const [busy, setBusy] = useState<ExportKind | null>(null);

  const exportSales = async () => {
    const db = getDb();
    const rows = await db.getAllAsync<{
      invoice_number: string;
      created_at: string;
      total: number;
      payment_method: string;
      status: string;
    }>('SELECT invoice_number, created_at, total, payment_method, status FROM sales ORDER BY created_at DESC LIMIT 5000');
    await exportAndShareCsv(
      `sales-export-${Date.now()}.csv`,
      ['Invoice', 'Date', 'Total', 'Payment', 'Status'],
      rows.map((r) => [r.invoice_number, r.created_at, String(r.total), r.payment_method, r.status]),
    );
  };

  const exportProducts = async () => {
    const db = getDb();
    const rows = await db.getAllAsync<{
      name: string;
      sku: string | null;
      sell_price: number;
      stock_qty: number;
      unit: string;
    }>('SELECT name, sku, sell_price, stock_qty, unit FROM products WHERE is_active = 1');
    await exportAndShareCsv(
      `products-export-${Date.now()}.csv`,
      ['Name', 'SKU', 'Price', 'Stock', 'Unit'],
      rows.map((r) => [r.name, r.sku ?? '', String(r.sell_price), String(r.stock_qty), r.unit]),
    );
  };

  const exportStock = async () => {
    const db = getDb();
    const rows = await db.getAllAsync<{
      product_name: string;
      movement_type: string;
      quantity_change: number;
      created_at: string;
    }>('SELECT product_name, movement_type, quantity_change, created_at FROM stock_movements ORDER BY created_at DESC LIMIT 5000');
    await exportAndShareCsv(
      `stock-movements-${Date.now()}.csv`,
      ['Product', 'Type', 'Change', 'Date'],
      rows.map((r) => [r.product_name, r.movement_type, String(r.quantity_change), r.created_at]),
    );
  };

  const run = async (kind: ExportKind) => {
    setBusy(kind);
    try {
      if (kind === 'sales') await exportSales();
      if (kind === 'products') await exportProducts();
      if (kind === 'stock') await exportStock();
      if (kind === 'backup') await exportAndShareJsonBackup();
      Toast.show({ type: 'success', text1: 'Export ready to share' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Export failed' });
    } finally {
      setBusy(null);
    }
  };

  const btn = (kind: ExportKind, label: string, subtitle: string) => (
    <Pressable
      key={kind}
      disabled={busy !== null}
      onPress={() => void run(kind)}
      className="mb-3 rounded-xl border border-app-border bg-app-surface p-4 active:opacity-90"
    >
      <Text className="font-semibold text-app-text">{label}</Text>
      <Text className="text-sm text-app-muted">{subtitle}</Text>
      {busy === kind ? <Text className="mt-1 text-xs text-app-primary">Exporting...</Text> : null}
    </Pressable>
  );

  return (
    <ScreenContainer>
      {btn('sales', 'Sales data (CSV)', 'Up to 5,000 recent sales')}
      {btn('products', 'Products list (CSV)', 'All active products')}
      {btn('stock', 'Stock movements (CSV)', 'Recent inventory changes')}
      <Pressable
        disabled={busy !== null}
        onPress={() => void run('backup')}
        className="rounded-xl p-4"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="font-semibold text-white">Full backup (JSON)</Text>
        <Text className="text-sm text-white/80">Complete database export</Text>
      </Pressable>
    </ScreenContainer>
  );
}
