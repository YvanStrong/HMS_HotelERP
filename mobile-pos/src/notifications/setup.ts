import Constants from "expo-constants";
import type { Router } from "expo-router";
import { Platform } from "react-native";
import { apiClient } from "../api/client";
import { mmkvGetString, mmkvSetString } from "../storage/mmkv";
import { notificationsSupported } from "./platform";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEVICE_ID_KEY = "hms_device_id";

let handlerConfigured = false;

async function notifications() {
  if (!notificationsSupported()) return null;
  return import("expo-notifications");
}

async function ensureNotificationHandler(): Promise<void> {
  if (handlerConfigured || !notificationsSupported()) return;
  const Notifications = await notifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  handlerConfigured = true;
}

function deviceId(): string {
  let id = mmkvGetString(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Date.now()}`;
    mmkvSetString(DEVICE_ID_KEY, id);
  }
  return id;
}

async function pushSupported(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  try {
    const Device = await import("expo-device");
    return Device.isDevice;
  } catch {
    return false;
  }
}

function resolveProjectId(): string | undefined {
  const candidates = [
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
    process.env.EXPO_PUBLIC_PROJECT_ID,
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined,
  ];
  for (const id of candidates) {
    if (id && UUID_RE.test(id)) return id;
  }
  return undefined;
}

export async function registerPushToken(hotelId: string): Promise<void> {
  if (!(await pushSupported())) return;

  try {
    const Notifications = await notifications();
    if (!Notifications) return;
    await ensureNotificationHandler();

    type Perm = { status?: string; granted?: boolean };
    const existing = (await Notifications.getPermissionsAsync()) as Perm;
    let ok = existing.granted === true || existing.status === "granted";
    if (!ok) {
      const requested = (await Notifications.requestPermissionsAsync()) as Perm;
      ok = requested.granted === true || requested.status === "granted";
    }
    if (!ok) return;

    const projectId = resolveProjectId();
    if (!projectId) {
      if (__DEV__) {
        console.warn(
          "[push] EAS projectId missing — run `eas init` and set EXPO_PUBLIC_EAS_PROJECT_ID, then rebuild (not Expo Go).",
        );
      }
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    const platform = Platform.OS === "ios" ? "ios" : "android";

    await apiClient.post(`/api/v1/hotels/${hotelId}/staff/push-token`, {
      token,
      deviceId: deviceId(),
      platform,
    });
  } catch {
    // Push is optional during local development.
  }
}

export async function unregisterPushToken(hotelId: string): Promise<void> {
  try {
    await apiClient.delete(`/api/v1/hotels/${hotelId}/staff/push-token`, {
      params: { deviceId: deviceId() },
    });
  } catch {
    // Best effort on logout.
  }
}

type ToastFn = (opts: { type: string; text1?: string; text2?: string }) => void;

export function attachNotificationListeners(
  router: Router,
  showToast: ToastFn,
): () => void {
  if (!notificationsSupported()) {
    return () => {};
  }

  let disposed = false;
  let cleanup: (() => void) | undefined;

  void (async () => {
    const Notifications = await notifications();
    if (!Notifications || disposed) return;
    await ensureNotificationHandler();

    const subTap = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>;
      if (data?.ticketId) {
        router.push(`/(main)/ticket/${data.ticketId}`);
      }
    });
    const subFg = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string>;
      if (data?.type === "LINE_READY") {
        showToast({
          type: "success",
          text1: notification.request.content.title ?? "Order ready",
          text2: notification.request.content.body ?? undefined,
        });
      }
    });

    if (disposed) {
      subTap.remove();
      subFg.remove();
      return;
    }
    cleanup = () => {
      subTap.remove();
      subFg.remove();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}
