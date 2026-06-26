import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton } from '../../../src/components/ActionButton';
import { HubLink } from '../../../src/components/HubLink';
import { ScreenContainer } from '../../../src/components/ScreenContainer';
import { SummaryCard } from '../../../src/components/SummaryCard';
import { getPurchaseCount, getPresetRange, getPurchasesReport } from '../../../src/utils/reports';
import { useAppStore } from '../../../src/store/appStore';
import { formatMoney } from '../../../src/utils/currency';

export default function PurchasesHubScreen() {
  const router = useRouter();
  const settings = useAppStore((s) => s.settings);
  const [todayTotal, setTodayTotal] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const [today, count] = await Promise.all([
          getPurchasesReport(getPresetRange('today')),
          getPurchaseCount(),
        ]);
        setTodayTotal(today.total);
        setTotalCount(count);
      })();
    }, []),
  );

  return (
    <ScreenContainer scroll>
        <View className="mb-4 flex-row flex-wrap gap-3">
          <SummaryCard label="Today" value={formatMoney(todayTotal, settings)} />
          <SummaryCard label="Total POs" value={String(totalCount)} />
        </View>

        <ActionButton
          label="+ New Purchase"
          onPress={() => router.push('/(main)/purchases/new')}
          className="mb-4"
        />

        <HubLink
          label="Purchase History"
          href="/(main)/purchases/history"
          subtitle="Search and browse all purchase orders"
        />
    </ScreenContainer>
  );
}
