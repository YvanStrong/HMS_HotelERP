import Constants from "expo-constants";

/** Remote push and native notification APIs are unavailable in Expo Go (SDK 53+). */
export function notificationsSupported(): boolean {
  return Constants.appOwnership !== "expo";
}
