import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { HubLink } from '../../../src/components/HubLink';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import { getPresetRange, getProfitReport, type ReportDateRange } from '../../../src/utils/reports';

export default function ReportingHubScreen() {
  const settings = useAppStore((s) => s.settings);
  const [range, setRange] = useState<ReportDateRange>(getPresetRange('today'));
  const [profit, setProfit] = useState({
    sales: 0,
    cogs: 0,
    grossProfit: 0,
    purchases: 0,
    expenses: 0,
    profit: 0,
  });

  useFocusEffect(
    useCallback(() => {
      void getProfitReport(range).then(setProfit);
    }, [range]),
  );

  return (
    <ScreenContainer scroll>
      <DateRangePicker range={range} onChange={setRange} />

      <View className="mb-4 flex-row flex-wrap gap-3">
        <SummaryCard label="Sales" value={formatMoney(profit.sales, settings)} />
        <SummaryCard label="COGS" value={formatMoney(profit.cogs, settings)} />
        <SummaryCard label="Gross profit" value={formatMoney(profit.grossProfit, settings)} />
        <SummaryCard label="Expenses" value={formatMoney(profit.expenses, settings)} />
        <SummaryCard label="Net profit" value={formatMoney(profit.profit, settings)} />
      </View>

      <HubLink label="Sales report" href={{ pathname: '/(main)/reporting/sales', params: { preset: range.preset } }} subtitle="Totals, top products, chart" />
      <HubLink label="Profit & loss" href={{ pathname: '/(main)/reporting/profit', params: { preset: range.preset } }} subtitle="Revenue, COGS, expenses, net profit" />
      <HubLink label="Purchases report" href={{ pathname: '/(main)/reporting/purchases', params: { preset: range.preset } }} subtitle="Purchase totals by period" />
      <HubLink label="Refunds report" href={{ pathname: '/(main)/reporting/refunds', params: { preset: range.preset } }} subtitle="Refund totals by period" />
      <HubLink label="Expenses report" href={{ pathname: '/(main)/reporting/expenses', params: { preset: range.preset } }} subtitle="Expenses by category" />
      <HubLink label="Stock report" href="/(main)/reporting/stock-report" subtitle="Stock valuation and category breakdown" />
      {settings?.taxEnabled ? (
        <HubLink label="Tax report" href={{ pathname: '/(main)/reporting/tax-report', params: { preset: range.preset } }} subtitle="Tax collected by period" />
      ) : null}
      <HubLink label="Export data" href="/(main)/reporting/export" subtitle="CSV exports and full JSON backup" />
    </ScreenContainer>
  );
}
