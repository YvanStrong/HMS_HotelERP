import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiClient } from "../api/client";
import { mmkvSetString, mmkvGetString } from "../storage/mmkv";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;



const DEVICE_ID_KEY = "hms_device_id";



Notifications.setNotificationHandler({

  handleNotification: async () => ({

    shouldShowAlert: true,

    shouldPlaySound: true,

    shouldSetBadge: false,

    shouldShowBanner: true,

    shouldShowList: true,

  }),

});



function deviceId(): string {

  let id = mmkvGetString(DEVICE_ID_KEY);

  if (!id) {

    id = `${Platform.OS}-${Date.now()}`;

    mmkvSetString(DEVICE_ID_KEY, id);

  }

  return id;

}



function pushSupported(): boolean {
  // Remote push is not available in Expo Go (SDK 53+). Use a dev build for production push.
  if (Constants.appOwnership === "expo") return false;
  if (!Device.isDevice) return false;
  return true;
}

function resolveProjectId(): string | undefined {
  const candidates = [
    process.env.EXPO_PUBLIC_PROJECT_ID,
    Constants.expoConfig?.extra?.eas?.projectId as string | undefined,
  ];
  for (const id of candidates) {
    if (id && UUID_RE.test(id)) return id;
  }
  return undefined;
}

export async function registerPushToken(hotelId: string): Promise<void> {
  if (!pushSupported()) return;

  try {
    type Perm = { status?: string; granted?: boolean };
    const existing = (await Notifications.getPermissionsAsync()) as Perm;
    let ok = existing.granted === true || existing.status === "granted";
    if (!ok) {
      const requested = (await Notifications.requestPermissionsAsync()) as Perm;
      ok = requested.granted === true || requested.status === "granted";
    }
    if (!ok) return;

    const projectId = resolveProjectId();
    if (!projectId) return;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    const platform = Platform.OS === "ios" ? "ios" : "android";

    await apiClient.post(`/api/v1/hotels/${hotelId}/staff/push-token`, {
      token,
      deviceId: deviceId(),
      platform,
    });
  } catch {
    // Push is optional in local Expo Go development.
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



export function addNotificationResponseListener(

  onNavigate: (ticketId: string) => void,

): Notifications.Subscription {

  return Notifications.addNotificationResponseReceivedListener((response) => {

    const data = response.notification.request.content.data as Record<string, string>;

    if (data?.ticketId) {

      onNavigate(data.ticketId);

    }

  });

}


