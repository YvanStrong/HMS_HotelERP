import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { getDb } from '../../../src/db/database';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getPresetRange, getPurchasesReport, type ReportDateRange } from '../../../src/utils/reports';

type SupplierTotal = { name: string; total: number; count: number };

async function getPurchasesBySupplier(range: ReportDateRange): Promise<SupplierTotal[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ name: string | null; total: number; count: number }>(
    `SELECT COALESCE(s.name, 'No supplier') AS name,
            SUM(p.total) AS total, COUNT(*) AS count
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.status = 'completed' AND p.created_at >= ? AND p.created_at <= ?
     GROUP BY s.id ORDER BY total DESC`,
    [range.startIso, range.endIso],
  );
  return rows.map((r) => ({ name: r.name ?? 'No supplier', total: r.total, count: r.count }));
}

export default function PurchasesReportScreen() {
  const settings = useAppStore((s) => s.settings);
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const initialPreset = (preset === 'week' || preset === 'month' ? preset : 'today') as 'today' | 'week' | 'month';
  const [range, setRange] = useState<ReportDateRange>(getPresetRange(initialPreset));
  const [report, setReport] = useState({ total: 0, count: 0, avgTransaction: 0 });
  const [bySupplier, setBySupplier] = useState<SupplierTotal[]>([]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [r, suppliers] = await Promise.all([
          getPurchasesReport(range),
          getPurchasesBySupplier(range),
        ]);
        setReport(r);
        setBySupplier(suppliers);
      })();
    }, [range]),
  );

  return (
    <ScreenContainer scroll>
      <DateRangePicker range={range} onChange={setRange} />

      <View className="mb-4 flex-row flex-wrap gap-3">
        <SummaryCard label="Total Purchases" value={formatMoney(report.total, settings)} />
        <SummaryCard label="Orders" value={String(report.count)} />
        <SummaryCard label="Avg Order" value={formatMoney(report.avgTransaction, settings)} />
      </View>

      <Text className="mb-2 font-bold text-app-text">By Supplier</Text>
      {bySupplier.length === 0 ? (
        <Text className="text-app-muted">No purchases in this period.</Text>
      ) : (
        bySupplier.map((s) => (
          <View key={s.name} className="mb-2 rounded-xl border border-app-border bg-app-surface p-3">
            <View className="flex-row justify-between">
              <Text className="font-bold text-app-text">{s.name}</Text>
              <Text className="font-bold text-app-text">{formatMoney(s.total, settings)}</Text>
            </View>
            <Text className="text-sm text-app-muted">{s.count} order(s)</Text>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}
