import "../global.css";
import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    void import("../src/notifications/setup").then((m) => m.registerPushToken(hotelId));
    const subTap = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.ticketId) {
        router.push(`/(main)/ticket/${data.ticketId}`);
      }
    });
    const subFg = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string>;
      if (data?.type === "LINE_READY") {
        Toast.show({
          type: "success",
          text1: notification.request.content.title ?? "Order ready",
          text2: notification.request.content.body ?? undefined,
        });
      }
    });
    return () => {
      subTap.remove();
      subFg.remove();
    };
  }, [isAuthenticated, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
