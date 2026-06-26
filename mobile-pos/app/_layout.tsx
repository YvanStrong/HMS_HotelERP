import axios from "axios";
import "../src/i18n";
import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { hydrateApiBaseUrl } from "../src/api/settings";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { PrivacyOverlay } from "../src/components/PrivacyOverlay";
import { SessionLock } from "../src/components/SessionLock";
import { initLocalStorage, purgeStaleLocalData } from "../src/storage/mmkv";
import { initAuthApiBridge, useAuthStore } from "../src/store/authStore";
import { notificationsSupported } from "../src/notifications/platform";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    initAuthApiBridge(() => router.replace("/(auth)/login"));
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initLocalStorage();
        purgeStaleLocalData();
        await hydrateApiBaseUrl();
        await restoreSession();
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreSession, setHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    const inAuth = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuth) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuth) {
      router.replace("/(main)/outlets");
    }
  }, [isAuthenticated, isHydrated, router, segments]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const hotelId = useAuthStore.getState().user?.hotelId;
    if (!hotelId) return;

    if (!notificationsSupported()) return;

    let detach: (() => void) | undefined;
    void import("../src/notifications/setup")
      .then(async (m) => {
        if (!m.registerPushToken) return;
        await m.registerPushToken(hotelId);
        detach = m.attachNotificationListeners(router, (opts) => Toast.show(opts));
      })
      .catch(() => {
        // Expo Go: push module unavailable.
      });

    return () => {
      detach?.();
    };
  }, [isAuthenticated, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(main)" />
            </Stack>
            <SessionLock />
            <PrivacyOverlay />
          </AuthGate>
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
