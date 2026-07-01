import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useCardStyle } from '../../../src/hooks/useTheme';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getPresetRange, getRefundsReport, type ReportDateRange } from '../../../src/utils/reports';

export default function RefundsReportScreen() {
  const cardStyle = useCardStyle();
  const settings = useAppStore((s) => s.settings);
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const initialPreset = (preset === 'week' || preset === 'month' ? preset : 'today') as 'today' | 'week' | 'month';
  const [range, setRange] = useState<ReportDateRange>(getPresetRange(initialPreset));
  const [report, setReport] = useState({ total: 0, count: 0, avgTransaction: 0 });

  useFocusEffect(
    useCallback(() => {
      void getRefundsReport(range).then(setReport);
    }, [range]),
  );

  return (
    <ScreenContainer scroll>
      <DateRangePicker range={range} onChange={setRange} />
      <View className="mb-4 flex-row flex-wrap gap-3">
        <SummaryCard label="Refund total" value={formatMoney(report.total, settings)} />
        <SummaryCard label="Refunds" value={String(report.count)} />
        <SummaryCard label="Avg refund" value={formatMoney(report.avgTransaction, settings)} />
      </View>
      <View style={cardStyle} className="p-4">
        <Text className="text-app-muted">Completed refunds in selected period.</Text>
      </View>
    </ScreenContainer>
  );
}
