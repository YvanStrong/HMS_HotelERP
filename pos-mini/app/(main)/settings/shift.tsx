import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { closeShift, getOpenShift, getZReportForShift, openShift } from '../../../src/repositories/shiftRepository';
import { printReceiptText } from '../../../src/printing/PrinterService';
import type { Shift } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { useThemeColors } from '../../../src/hooks/useTheme';
import { formatMoney } from '../../../src/utils/currency';
import { buildZReportText } from '../../../src/utils/zReport';

export default function ShiftScreen() {
  const colors = useThemeColors();
  const settings = useAppStore((s) => s.settings);
  const [shift, setShift] = useState<Shift | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [closingCash, setClosingCash] = useState('');
  const [zReport, setZReport] = useState<Awaited<ReturnType<typeof getZReportForShift>> | null>(null);

  const load = useCallback(async () => {
    const open = await getOpenShift();
    setShift(open);
    if (open) setZReport(await getZReportForShift(open));
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const startShift = async () => {
    try {
      const s = await openShift(Number(openingCash) || 0);
      setShift(s);
      setZReport(await getZReportForShift(s));
      Toast.show({ type: 'success', text1: 'Shift opened' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  const shareZReport = async (closing?: number) => {
    if (!shift || !zReport) return;
    const text = buildZReportText(shift, zReport, settings, closing);
    if (await Sharing.isAvailableAsync()) {
      // expo-sharing needs a file URI; use print-to-file pattern via Print
      const { uri } = await Print.printToFileAsync({ html: `<pre>${text.replace(/</g, '&lt;')}</pre>` });
      await Sharing.shareAsync(uri, { mimeType: 'text/plain', dialogTitle: 'Share Z-report' });
    } else {
      Toast.show({ type: 'info', text1: 'Sharing not available on this device' });
    }
  };

  const printZReport = async (closing?: number) => {
    if (!shift || !zReport) return;
    try {
      const text = buildZReportText(shift, zReport, settings, closing);
      const result = await printReceiptText(text);
      Toast.show({
        type: 'success',
        text1: result.simulated ? 'Z-report simulated' : 'Z-report sent to printer',
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Print failed' });
    }
  };

  const endShift = async () => {
    if (!shift) return;
    try {
      const closing = Number(closingCash) || 0;
      await closeShift(shift.id, closing);
      await shareZReport(closing).catch(() => undefined);
      setShift(null);
      setZReport(null);
      setClosingCash('');
      Toast.show({ type: 'success', text1: 'Shift closed — Z-report saved' });
    } catch (e) {
      Toast.show({ type: 'error', text1: e instanceof Error ? e.message : 'Failed' });
    }
  };

  if (!shift) {
    return (
      <ScreenContainer scroll>
        <Text className="mb-4 text-lg font-bold text-app-text">Open shift</Text>
        <Text className="mb-2 text-app-muted">Opening cash in drawer</Text>
        <NumericKeypad value={openingCash} onChange={setOpeningCash} />
        <Pressable onPress={() => void startShift()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
          <Text className="text-center font-semibold text-white">Open shift</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll>
      <Text className="mb-2 text-lg font-bold text-app-text">Shift open</Text>
      <Text className="mb-4 text-sm text-app-muted">Since {new Date(shift.openedAt).toLocaleString()}</Text>
      {zReport ? (
        <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="mb-2 font-bold text-app-text">Z-report (live)</Text>
          <Text className="text-app-text">Sales: {formatMoney(zReport.salesTotal, settings)} ({zReport.salesCount})</Text>
          <Text className="text-app-text">Cash sales: {formatMoney(zReport.cashSales, settings)}</Text>
          <Text className="text-app-text">Refunds: {formatMoney(zReport.refundsTotal, settings)}</Text>
          <Text className="mt-2 font-bold text-app-text">Expected cash: {formatMoney(zReport.expectedCash, settings)}</Text>
          <View className="mt-3 flex-row gap-2">
            <Pressable onPress={() => void printZReport()} className="flex-1 rounded-lg py-2" style={{ backgroundColor: colors.primarySoft }}>
              <Text className="text-center font-semibold text-app-primary">Print</Text>
            </Pressable>
            <Pressable onPress={() => void shareZReport()} className="flex-1 rounded-lg border border-app-border py-2">
              <Text className="text-center font-semibold text-app-text">Share</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Text className="mb-2 font-semibold text-app-text">Closing cash count</Text>
      <NumericKeypad value={closingCash} onChange={setClosingCash} />
      <Pressable onPress={() => void endShift()} className="mt-4 rounded-xl py-4" style={{ backgroundColor: colors.primary }}>
        <Text className="text-center font-semibold text-white">Close shift</Text>
      </Pressable>
    </ScreenContainer>
  );
}
