import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppStore } from '../src/store/appStore';
import { useAndroidBackHandler } from '../src/hooks/useAndroidBackHandler';
import { colors, getThemeColors } from '../src/constants/theme';
import { registerBackgroundAlerts } from '../src/notifications/alerts';
import { initI18n } from '../src/i18n';

/*
 * PHASE 8 — HMS Admin Console Integration (NOT implemented)
 * When ready to connect to HMS platform:
 * 1. Add user registration/login screen
 * 2. Add sync logic: local SQLite → remote API
 * 3. Add subscription check on app open
 * 4. Add device registration with HMS platform
 * 5. HMS admin console: registered users, subscriptions, suspend/activate
 * 6. Subscription tiers: Free / Basic / Pro with cloud sync
 * Local schema uses UUIDs + created_at — compatible with future sync.
 */

function AppShell() {
  useAndroidBackHandler();
  const themeMode = useAppStore((s) => s.themeMode);
  const palette = getThemeColors(themeMode);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { flex: 1, backgroundColor: palette.background },
      }}
    />
  );
}

export default function RootLayout() {
  const init = useAppStore((s) => s.init);
  const isReady = useAppStore((s) => s.isReady);
  const themeMode = useAppStore((s) => s.themeMode);
  const [error, setError] = useState<string | null>(null);
  const palette = getThemeColors(themeMode);
  const paperTheme = useMemo(() => {
    const base = themeMode === 'dark' ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: palette.primary,
        background: palette.background,
        surface: palette.surface,
      },
    };
  }, [themeMode, palette]);

  useEffect(() => {
    init()
      .then(async () => {
        await initI18n();
        await registerBackgroundAlerts();
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to initialize database');
      });
  }, [init]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-app-surface p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-app-surface">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView
      style={{ flex: 1, backgroundColor: palette.background }}
      className={themeMode === 'dark' ? 'dark flex-1' : 'flex-1'}
    >
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
          <AppShell />
          <Toast />
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
