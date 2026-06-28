import { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Toast from 'react-native-toast-message';
import { NumericKeypad } from '../../../src/components/NumericKeypad';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { closeShift, getOpenShift, getZReportForShift, openShift } from '../../../src/repositories/shiftRepository';
import type { Shift } from '../../../src/types';
import { useAppStore } from '../../../src/store/appStore';
import { colors } from '../../../src/constants/theme';
import { formatMoney } from '../../../src/utils/currency';

export default function ShiftScreen() {
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

  const endShift = async () => {
    if (!shift) return;
    try {
      await closeShift(shift.id, Number(closingCash) || 0);
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
      <ScreenContainer>
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
    <ScreenContainer>
      <Text className="mb-2 text-lg font-bold text-app-text">Shift open</Text>
      <Text className="mb-4 text-sm text-app-muted">Since {new Date(shift.openedAt).toLocaleString()}</Text>
      {zReport ? (
        <View className="mb-4 rounded-xl border border-app-border bg-app-surface p-4">
          <Text className="mb-2 font-bold text-app-text">Z-report (live)</Text>
          <Text className="text-app-text">Sales: {formatMoney(zReport.salesTotal, settings)} ({zReport.salesCount})</Text>
          <Text className="text-app-text">Cash sales: {formatMoney(zReport.cashSales, settings)}</Text>
          <Text className="text-app-text">Refunds: {formatMoney(zReport.refundsTotal, settings)}</Text>
          <Text className="mt-2 font-bold text-app-text">Expected cash: {formatMoney(zReport.expectedCash, settings)}</Text>
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
