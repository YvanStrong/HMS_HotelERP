import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton } from '../../../src/components/ActionButton';
import { HubLink } from '../../../src/components/HubLink';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { getDb } from '../../../src/db/database';
import { getRefundCount, getPresetRange } from '../../../src/utils/reports';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

async function getTodayRefundTotal(): Promise<number> {
  const range = getPresetRange('today');
  const db = getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total), 0) AS total FROM refunds
     WHERE status = 'completed' AND created_at >= ? AND created_at <= ?`,
    [range.startIso, range.endIso],
  );
  return row?.total ?? 0;
}

export default function RefundsHubScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [todayTotal, setTodayTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [today, count] = await Promise.all([getTodayRefundTotal(), getRefundCount()]);
        setTodayTotal(today);
        setTotalCount(count);
      })();
    }, []),
  );

  return (
    <ScreenContainer scroll>
      <View className="mb-4 flex-row flex-wrap gap-3">
        <SummaryCard label="Today" value={formatMoney(todayTotal, settings)} />
        <SummaryCard label="Total Refunds" value={String(totalCount)} />
      </View>

      <ActionButton
        label="+ New Refund"
        onPress={() => router.push('/(main)/refunds/new')}
        className="mb-4"
      />

      <HubLink
        label="Refund History"
        href="/(main)/refunds/history"
        subtitle="Search refunds by number or invoice"
      />
    </ScreenContainer>
  );
}
