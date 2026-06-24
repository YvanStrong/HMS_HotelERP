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
import { hydrateAuthFromSecureStore, initAuthApiBridge, useAuthStore } from "../src/store/authStore";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setHydrated = useAuthStore((s) => s.setHydrated);

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
        const session = await hydrateAuthFromSecureStore();
        if (session) {
          await setTokens(session.access, session.refresh, session.user);
        }
      } finally {
        if (!cancelled) setHydrated();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setHydrated, setTokens]);

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

    let detach: (() => void) | undefined;
    void import("../src/notifications/setup").then(async (m) => {
      await m.registerPushToken(hotelId);
      detach = m.attachNotificationListeners(router, (opts) => Toast.show(opts));
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
