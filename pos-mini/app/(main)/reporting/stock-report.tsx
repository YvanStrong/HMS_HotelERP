import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getStockValuationReport, type StockValuationReport } from '../../../src/utils/reports';

export default function StockReportScreen() {
  const settings = useAppStore((s) => s.settings);
  const [report, setReport] = useState<StockValuationReport | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getStockValuationReport().then(setReport);
    }, []),
  );

  if (!report) {
    return (
      <ScreenContainer>
        <Text className="text-app-muted">Loading stock report...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
        <View className="mb-4 flex-row flex-wrap gap-3">
          <SummaryCard label="Products" value={String(report.productCount)} />
          <SummaryCard label="Total units" value={String(Math.round(report.totalUnits))} />
          <SummaryCard label="Cost value" value={formatMoney(report.costValue, settings)} />
          <SummaryCard label="Retail value" value={formatMoney(report.retailValue, settings)} />
          <SummaryCard
            label="Potential profit"
            value={formatMoney(report.potentialProfit, settings)}
          />
        </View>
        <Text className="mb-2 font-semibold text-app-text">By category</Text>
        {report.byCategory.map((row) => (
          <View
            key={row.category}
            className="mb-2 rounded-xl border border-app-border bg-app-surface p-3"
          >
            <Text className="font-semibold text-app-text">{row.category}</Text>
            <Text className="text-sm text-app-muted">
              {row.products} products · {Math.round(row.units)} units
            </Text>
            <Text className="text-sm text-app-text">
              Cost {formatMoney(row.costValue, settings)} · Retail{' '}
              {formatMoney(row.retailValue, settings)}
            </Text>
          </View>
        ))}
    </ScreenContainer>
  );
}
