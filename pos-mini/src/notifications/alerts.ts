import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let sessionLowStockShown = false;
let sessionBackupShown = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function showLowStockNotification(count: number): Promise<void> {
  if (sessionLowStockShown || count <= 0) return;
  const ok = await ensureNotificationPermissions();
  if (!ok) return;
  sessionLowStockShown = true;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Low stock alert',
      body: `${count} product${count === 1 ? '' : 's'} below minimum stock.`,
    },
    trigger: null,
  });
}

export async function showBackupReminderNotification(daysSince: number): Promise<void> {
  if (sessionBackupShown || daysSince < 7) return;
  const ok = await ensureNotificationPermissions();
  if (!ok) return;
  sessionBackupShown = true;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Backup reminder',
      body: `Last backup was ${daysSince} days ago. Export a backup in Settings.`,
    },
    trigger: null,
  });
}

export function resetSessionNotifications(): void {
  sessionLowStockShown = false;
  sessionBackupShown = false;
}
