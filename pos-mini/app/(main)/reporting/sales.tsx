import { useCallback, useMemo, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { DateRangePicker } from '../../../src/components/DateRangePicker';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { useThemedStyles } from '../../../src/hooks/useTheme';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';
import {
  getDailySalesChart,
  getPaymentMethodBreakdown,
  getPresetRange,
  getSalesByHourChart,
  getSalesReport,
  getTopProducts,
  type ReportDateRange,
} from '../../../src/utils/reports';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { subDays } from 'date-fns';

const CHART_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed'];

export default function SalesReportScreen() {
  const settings = useAppStore((s) => s.settings);
  const { cardStyle, colors } = useThemedStyles();
  const { preset } = useLocalSearchParams<{ preset?: string }>();
  const initialPreset = (preset === 'week' || preset === 'month' ? preset : 'today') as 'today' | 'week' | 'month';
  const [range, setRange] = useState<ReportDateRange>(getPresetRange(initialPreset));
  const [report, setReport] = useState({ total: 0, count: 0, avgTransaction: 0 });
  const [topProducts, setTopProducts] = useState<{ productName: string; quantity: number; revenue: number }[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ label: string; value: number }[]>([]);
  const [payments, setPayments] = useState<{ method: string; total: number }[]>([]);
  const [compareReport, setCompareReport] = useState({ total: 0, count: 0, avgTransaction: 0 });
  const [compareEnabled, setCompareEnabled] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [r, top, chart, hourly, pay] = await Promise.all([
          getSalesReport(range),
          getTopProducts(range),
          getDailySalesChart(range),
          getSalesByHourChart(range),
          getPaymentMethodBreakdown(range),
        ]);
        setReport(r);
        setTopProducts(top);
        setChartData(chart);
        setHourlyData(hourly);
        setPayments(pay);

        if (compareEnabled) {
          const spanMs = new Date(range.endIso).getTime() - new Date(range.startIso).getTime();
          const prevEnd = new Date(new Date(range.startIso).getTime() - 1);
          const prevStart = subDays(prevEnd, Math.max(1, Math.round(spanMs / 86400000)));
          const prevRange = {
            preset: 'custom' as const,
            startIso: prevStart.toISOString(),
            endIso: prevEnd.toISOString(),
          };
          setCompareReport(await getSalesReport(prevRange));
        }
      })();
    }, [range, compareEnabled]),
  );

  const exportPdf = async () => {
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:16px">
      <h1>Sales report</h1>
      <p>${new Date(range.startIso).toLocaleDateString()} – ${new Date(range.endIso).toLocaleDateString()}</p>
      <p><strong>Total:</strong> ${formatMoney(report.total, settings)}</p>
      <p><strong>Transactions:</strong> ${report.count}</p>
      <p><strong>Average:</strong> ${formatMoney(report.avgTransaction, settings)}</p>
      ${compareEnabled ? `<hr><h2>Previous period</h2><p>Total: ${formatMoney(compareReport.total, settings)} (${compareReport.count} txns)</p>` : ''}
      <h2>Top products</h2><ul>${topProducts.map((p) => `<li>${p.productName}: ${p.quantity} · ${formatMoney(p.revenue, settings)}</li>`).join('')}</ul>
    </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Sales report PDF' });
      } else {
        Toast.show({ type: 'info', text1: 'PDF saved', text2: uri });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'PDF export failed' });
    }
  };

  const chartWidth = Dimensions.get('window').width - 32;
  const pieData = useMemo(
    () =>
      payments.map((p, i) => ({
        name: p.method,
        amount: p.total,
        color: CHART_COLORS[i % CHART_COLORS.length],
        legendFontColor: colors.text,
        legendFontSize: 12,
      })),
    [payments],
  );

  return (
    <ScreenContainer scroll>
        <DateRangePicker range={range} onChange={setRange} />

        <View className="mb-3 flex-row gap-2">
          <Pressable
            onPress={() => setCompareEnabled((v) => !v)}
            className="flex-1 rounded-xl border border-app-border bg-app-surface py-2"
          >
            <Text className="text-center text-sm font-semibold text-app-text">
              {compareEnabled ? 'Compare: on' : 'Compare previous period'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void exportPdf()} className="flex-1 rounded-xl py-2" style={{ backgroundColor: colors.primary }}>
            <Text className="text-center text-sm font-semibold text-white">Export PDF</Text>
          </Pressable>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-3">
          <SummaryCard label="Total Sales" value={formatMoney(report.total, settings)} />
          <SummaryCard label="Transactions" value={String(report.count)} />
          <SummaryCard label="Avg Sale" value={formatMoney(report.avgTransaction, settings)} />
        </View>

        {compareEnabled ? (
          <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-3">
            <Text className="mb-1 font-bold text-app-text">Previous period</Text>
            <Text className="text-app-text">
              {formatMoney(compareReport.total, settings)} · {compareReport.count} transactions
            </Text>
            <Text className="text-sm text-app-muted">
              Δ {formatMoney(report.total - compareReport.total, settings)} (
              {compareReport.total > 0
                ? `${(((report.total - compareReport.total) / compareReport.total) * 100).toFixed(1)}%`
                : '—'}
              )
            </Text>
          </View>
        ) : null}

        {hourlyData.length > 0 ? (
          <View className="mb-4" style={cardStyle}>
            <Text className="mb-2 p-3 font-bold text-app-text">Sales by hour</Text>
            <BarChart
              data={{
                labels: hourlyData.map((d) => d.label),
                datasets: [{ data: hourlyData.map((d) => d.value || 0) }],
              }}
              width={chartWidth}
              height={180}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: () => colors.primary,
                labelColor: () => colors.text,
              }}
              style={{ borderRadius: 0 }}
            />
          </View>
        ) : null}

        {pieData.length > 0 ? (
          <View className="mb-4 items-center" style={cardStyle}>
            <Text className="mb-2 self-start p-3 font-bold text-app-text">Payment methods</Text>
            <PieChart
              data={pieData}
              width={chartWidth}
              height={180}
              chartConfig={{
                color: () => colors.primary,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="12"
              absolute
            />
          </View>
        ) : null}

        {chartData.length > 0 ? (
          <View className="mb-4" style={cardStyle}>
            <Text className="mb-2 p-3 font-bold text-app-text">Daily sales</Text>
            <BarChart
              data={{
                labels: chartData.map((d) => d.label),
                datasets: [{ data: chartData.map((d) => d.value || 0) }],
              }}
              width={chartWidth}
              height={200}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: '#fff',
                backgroundGradientFrom: '#fff',
                backgroundGradientTo: '#fff',
                decimalPlaces: 0,
                color: () => '#22c55e',
                labelColor: () => colors.text,
              }}
              style={{ borderRadius: 0 }}
            />
          </View>
        ) : null}

        <Text className="mb-2 font-bold text-app-text">Top products</Text>
        {topProducts.length === 0 ? (
          <Text className="text-app-muted">No sales in this period.</Text>
        ) : (
          topProducts.map((p, i) => (
            <View key={`${p.productName}-${i}`} style={cardStyle} className="mb-2 p-3">
              <View className="flex-row justify-between">
                <Text className="font-bold text-app-text">{p.productName}</Text>
                <Text className="font-bold text-app-text">{formatMoney(p.revenue, settings)}</Text>
              </View>
              <Text className="text-sm text-app-muted">Qty sold: {p.quantity}</Text>
            </View>
          ))
        )}
    </ScreenContainer>
  );
}
