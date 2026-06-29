import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { cardStyle } from '../../../src/constants/theme';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getExpensesReport, getPresetRange, type ReportDateRange } from '../../../src/utils/reports';

export default function ExpensesReportScreen() {
  const settings = useAppStore((s) => s.settings);
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const initialPreset = (preset === 'week' || preset === 'month' ? preset : 'today') as 'today' | 'week' | 'month';
  const [range, setRange] = useState<ReportDateRange>(getPresetRange(initialPreset));
  const [report, setReport] = useState({ total: 0, count: 0, byCategory: [] as { category: string; total: number; count: number }[] });

  useFocusEffect(
    useCallback(() => {
      void getExpensesReport(range).then(setReport);
    }, [range]),
  );

  return (
    <ScreenContainer scroll>
      <DateRangePicker range={range} onChange={setRange} />
      <View className="mb-4 flex-row flex-wrap gap-3">
        <SummaryCard label="Total expenses" value={formatMoney(report.total, settings)} />
        <SummaryCard label="Entries" value={String(report.count)} />
      </View>
      <Text className="mb-2 font-bold text-app-text">By category</Text>
      {report.byCategory.length === 0 ? (
        <Text className="text-app-muted">No expenses in this period.</Text>
      ) : (
        report.byCategory.map((row) => (
          <View key={row.category} style={cardStyle} className="mb-2 flex-row justify-between p-3">
            <Text className="font-semibold text-app-text">{row.category}</Text>
            <Text className="font-bold text-app-text">{formatMoney(row.total, settings)}</Text>
          </View>
        ))
      )}
    </ScreenContainer>
  );
}
