import { PermissionsAndroid, Platform } from "react-native";

/**
 * Android 12+ (API 31) requires runtime BLUETOOTH_SCAN / BLUETOOTH_CONNECT
 * before discovering or connecting to receipt printers.
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const api = typeof Platform.Version === "number" ? Platform.Version : 0;
  if (api < 31) return true;

  const required = [
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ];

  const already = await Promise.all(
    required.map((p) => PermissionsAndroid.check(p)),
  );
  if (already.every(Boolean)) return true;

  const result = await PermissionsAndroid.requestMultiple(required);
  return required.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}
