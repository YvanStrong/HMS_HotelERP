import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { HomeGrid } from '../src/components/HomeGrid';
import { HomeMenuModal } from '../src/components/HomeMenuModal';
import { LogoutButton } from '../src/components/LogoutButton';
import { OnboardingTour } from '../src/components/OnboardingTour';
import { SummaryCard } from '../src/components/SummaryCard';
import { useAppStore } from '../src/store/appStore';
import { getThemeColors } from '../src/constants/theme';
import { formatMoney } from '../src/utils/currency';
import { showLowStockNotification } from '../src/notifications/alerts';
import { useAndroidBackHandler } from '../src/hooks/useAndroidBackHandler';
import { getOnboardingComplete } from '../src/repositories/metaRepository';

export default function HomeScreen() {
  const router = useRouter();
  useAndroidBackHandler();
  const { t } = useTranslation();
  const {
    isSetupComplete,
    isUnlocked,
    pinRequired,
    staffSignInRequired,
    settings,
    stats,
    themeMode,
    refreshStats,
    lock,
    currentStaff,
  } = useAppStore();
  const palette = getThemeColors(themeMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const switchStaff = async () => {
    await lock();
    const state = useAppStore.getState();
    if (state.staffSignInRequired) {
      router.replace('/(auth)/staff');
    } else if (state.pinRequired && !state.isUnlocked) {
      router.replace('/(auth)/pin');
    }
  };

  useEffect(() => {
    if (!isSetupComplete) {
      router.replace('/(auth)/setup');
      return;
    }
    if (staffSignInRequired) {
      router.replace('/(auth)/staff');
      return;
    }
    if (pinRequired && !isUnlocked) {
      router.replace('/(auth)/pin');
    }
  }, [isSetupComplete, isUnlocked, pinRequired, staffSignInRequired, router]);

  useFocusEffect(
    useCallback(() => {
      if (!isSetupComplete || staffSignInRequired || (pinRequired && !isUnlocked)) return;
      void refreshStats().then(async () => {
        const s = useAppStore.getState().stats;
        if (settings?.lowStockAlert && s.lowStockCount > 0) {
          await showLowStockNotification(s.lowStockCount);
        }
        const done = await getOnboardingComplete();
        if (!done) setShowOnboarding(true);
      });
    }, [isSetupComplete, isUnlocked, pinRequired, staffSignInRequired, refreshStats, settings?.lowStockAlert]),
  );

  if (!isSetupComplete || staffSignInRequired || (pinRequired && !isUnlocked)) {
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
              Today: {stats.todayTransactions} {t('home.transactions')} · {formatMoney(stats.todaySales, settings)}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => router.replace('/')} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
              <Ionicons name="home" size={22} color={palette.primary} />
            </Pressable>
            <Pressable onPress={() => setMenuOpen(true)} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
              <Ionicons name="ellipsis-vertical" size={22} color={palette.primary} />
            </Pressable>
            {currentStaff ? (
              <Pressable onPress={() => void switchStaff()} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
                <Ionicons name="people" size={22} color={palette.primary} />
              </Pressable>
            ) : pinRequired ? (
              <Pressable onPress={() => void switchStaff()} className="rounded-lg border p-2" style={{ borderColor: palette.border, backgroundColor: palette.surface }}>
                <Ionicons name="lock-closed" size={22} color={palette.primary} />
              </Pressable>
            ) : null}
            <LogoutButton />
          </View>
        </View>

        <View className="mb-4 flex-row flex-wrap gap-3">
          <SummaryCard label={t('home.todaySales')} value={formatMoney(stats.todaySales, settings)} subtitle={`${stats.todayTransactions} ${t('home.transactions')}`} />
          <SummaryCard label={t('home.products')} value={String(stats.totalProducts)} subtitle={`${stats.lowStockCount} ${t('home.lowStock')}`} />
        </View>

        <Text style={{ color: palette.text }} className="mb-3 text-lg font-bold">{t('home.modules')}</Text>
        <HomeGrid />

        <Pressable onPress={() => router.push('/(main)/sales/new')} className="mb-8 mt-5 rounded-xl py-4 active:opacity-90" style={{ backgroundColor: palette.primary }}>
          <Text className="text-center text-lg font-semibold text-white">{t('home.newSale')}</Text>
        </Pressable>
      </ScrollView>
      <HomeMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} onLock={() => void switchStaff()} pinRequired={Boolean(pinRequired || currentStaff)} />
      <OnboardingTour visible={showOnboarding} onComplete={() => setShowOnboarding(false)} />
    </SafeAreaView>
  );
}
