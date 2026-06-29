import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import {
  getPresetRange,
  getTaxReport,
  type ReportDateRange,
  type TaxReportData,
} from '../../../src/utils/reports';

export default function TaxReportScreen() {
  const settings = useAppStore((s) => s.settings);
  const [range, setRange] = useState<ReportDateRange>(getPresetRange('month'));
  const [report, setReport] = useState<TaxReportData | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!settings?.taxEnabled) {
        setReport(null);
        return;
      }
      void getTaxReport(range).then(setReport);
    }, [range, settings?.taxEnabled]),
  );

  if (!settings?.taxEnabled) {
    return (
      <ScreenContainer>
        <Text className="text-app-muted">Enable tax in Settings → Tax to view this report.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
        <DateRangePicker range={range} onChange={setRange} />
        {report ? (
          <>
            <View className="mb-4 flex-row flex-wrap gap-3">
              <SummaryCard label="Gross sales" value={formatMoney(report.grossSales, settings)} />
              <SummaryCard label="Tax collected" value={formatMoney(report.taxCollected, settings)} />
              <SummaryCard label="Net sales" value={formatMoney(report.netSales, settings)} />
              <SummaryCard label="Sales count" value={String(report.saleCount)} />
            </View>
            <Text className="mb-2 font-semibold text-app-text">Daily breakdown</Text>
            {report.daily.map((row) => (
              <View
                key={row.date}
                className="mb-2 rounded-xl border border-app-border bg-app-surface p-3"
              >
                <Text className="font-semibold text-app-text">{row.date}</Text>
                <Text className="text-sm text-app-muted">
                  {row.count} sales · Tax {formatMoney(row.tax, settings)} · Net{' '}
                  {formatMoney(row.net, settings)}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <Text className="text-app-muted">Loading...</Text>
        )}
    </ScreenContainer>
  );
}
