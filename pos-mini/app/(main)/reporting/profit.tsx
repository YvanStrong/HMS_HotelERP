import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getPresetRange, getProfitReport, type ReportDateRange } from '../../../src/utils/reports';

export default function ProfitReportScreen() {
  const { cardStyle, colors } = useThemedStyles();
  const settings = useAppStore((s) => s.settings);
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const initialPreset = (preset === 'week' || preset === 'month' ? preset : 'today') as 'today' | 'week' | 'month';
  const [range, setRange] = useState<ReportDateRange>(getPresetRange(initialPreset));
  const [data, setData] = useState({
    sales: 0,
    cogs: 0,
    grossProfit: 0,
    purchases: 0,
    expenses: 0,
    profit: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void getProfitReport(range).then(setData);
    }, [range]),
  );

  const rows = [
    { label: 'Sales revenue', value: data.sales, positive: true },
    { label: 'Cost of goods sold (COGS)', value: -data.cogs, positive: false },
    { label: 'Gross profit', value: data.grossProfit, positive: data.grossProfit >= 0 },
    { label: 'Operating expenses', value: -data.expenses, positive: false },
  ];

  return (
    <ScreenContainer scroll>
        <DateRangePicker range={range} onChange={setRange} />

        <View className="mb-4" style={cardStyle}>
          <View className="p-4">
            <Text className="mb-3 text-xs font-semibold uppercase text-app-muted">Profit & loss</Text>
            {rows.map((row) => (
              <View key={row.label} className="mb-3 flex-row justify-between">
                <Text className="text-app-text">{row.label}</Text>
                <Text
                  className="font-bold"
                  style={{ color: row.positive ? colors.text : colors.danger }}
                >
                  {row.value < 0 ? '−' : ''}{formatMoney(Math.abs(row.value), settings)}
                </Text>
              </View>
            ))}
            <View className="border-t border-app-border pt-3">
              <View className="flex-row justify-between">
                <Text className="text-lg font-bold text-app-text">Net profit</Text>
                <Text
                  className="text-lg font-bold"
                  style={{ color: data.profit >= 0 ? '#16a34a' : '#dc2626' }}
                >
                  {formatMoney(data.profit, settings)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-3">
          <SummaryCard label="Revenue" value={formatMoney(data.sales, settings)} />
          <SummaryCard label="COGS" value={formatMoney(data.cogs, settings)} />
          <SummaryCard label="Gross profit" value={formatMoney(data.grossProfit, settings)} />
          <SummaryCard label="Expenses" value={formatMoney(data.expenses, settings)} />
          <SummaryCard label="Purchases (inventory)" value={formatMoney(data.purchases, settings)} />
        </View>
    </ScreenContainer>
  );
}
