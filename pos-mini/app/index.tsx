import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { differenceInDays } from 'date-fns';
import { HomeGrid } from '../src/components/HomeGrid';
import { HomeMenuModal } from '../src/components/HomeMenuModal';
import { LogoutButton } from '../src/components/LogoutButton';
import { SummaryCard } from '../src/components/SummaryCard';
import { useAppStore } from '../src/store/appStore';
import { getThemeColors } from '../src/constants/theme';
import { formatMoney } from '../src/utils/currency';
import { getLastBackupAt } from '../src/repositories/metaRepository';
import { showBackupReminderNotification, showLowStockNotification } from '../src/notifications/alerts';

export default function HomeScreen() {
  const router = useRouter();
  const {
    isSetupComplete,
    isUnlocked,
    pinRequired,
    settings,
    stats,
    themeMode,
    refreshStats,
    lock,
  } = useAppStore();
  const palette = getThemeColors(themeMode);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!isSetupComplete) {
      router.replace('/(auth)/setup');
      return;
    }
    if (pinRequired && !isUnlocked) {
      router.replace('/(auth)/pin');
    }
  }, [isSetupComplete, isUnlocked, pinRequired, router]);

  useFocusEffect(
    useCallback(() => {
      if (!isSetupComplete || (pinRequired && !isUnlocked)) return;
      void refreshStats().then(async () => {
        const s = useAppStore.getState().stats;
        if (settings?.lowStockAlert && s.lowStockCount > 0) {
          await showLowStockNotification(s.lowStockCount);
        }
        const lastBackup = await getLastBackupAt();
        if (lastBackup) {
          const days = differenceInDays(new Date(), new Date(lastBackup));
          await showBackupReminderNotification(days);
        } else {
          await showBackupReminderNotification(8);
        }
      });
    }, [isSetupComplete, isUnlocked, pinRequired, refreshStats, settings?.lowStockAlert]),
  );

  if (!isSetupComplete || (pinRequired && !isUnlocked)) {
    return null;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
      <ScrollView style={{ flex: 1 }} className="px-4 pt-4">
        <View className="mb-2 flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text style={{ color: palette.text }} className="text-2xl font-bold" numberOfLines={2}>
              {settings?.businessName || 'POS Mini'}
            </Text>
            <Text style={{ color: palette.textMuted }} className="mt-1 text-sm">
              Today: {stats.todayTransactions} sales · {formatMoney(stats.todaySales, settings)}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => router.replace('/')} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
              <Ionicons name="home" size={22} color={palette.primary} />
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
              <Ionicons name="ellipsis-vertical" size={22} color={palette.primary} />
            </Pressable>
            {pinRequired ? (
              <Pressable onPress={lock} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
                <Ionicons name="lock-closed" size={22} color={palette.primary} />
              </Pressable>
            ) : null}
            <LogoutButton />
          </View>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-3">
          <SummaryCard label="Today sales" value={formatMoney(stats.todaySales, settings)} subtitle={`${stats.todayTransactions} transactions`} />
          <SummaryCard label="Products" value={String(stats.totalProducts)} subtitle={`${stats.lowStockCount} low stock`} />
        </View>

        <Text style={{ color: palette.text }} className="mb-3 text-lg font-bold">Modules</Text>
        <HomeGrid />

        <Pressable onPress={() => router.push('/(main)/sales/new')} className="mb-8 mt-5 rounded-xl py-4 active:opacity-90" style={{ backgroundColor: palette.primary }}>
          <Text className="text-center text-lg font-semibold text-white">New sale</Text>
        </Pressable>
      </ScrollView>
      <HomeMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} onLock={lock} pinRequired={pinRequired} />
    </SafeAreaView>
  );
}
