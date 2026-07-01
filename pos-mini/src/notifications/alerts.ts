import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { differenceInDays } from 'date-fns';
import { countLowStock, countProducts } from '../repositories/productRepository';
import { getLastBackupAt } from '../repositories/metaRepository';

const BACKUP_REMINDER_ID = 'pos-mini-backup-reminder';
const LOW_STOCK_CHECK_ID = 'pos-mini-low-stock-weekly';
const BACKUP_STALE_DAYS = 7;

let sessionLowStockShown = false;
let sessionBackupShown = false;
let backgroundRegistered = false;

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

/**
 * Show a backup reminder only when we have real data:
 * - Last backup exists and is older than BACKUP_STALE_DAYS, or
 * - Never backed up but the business has products (honest message, not fake days).
 */
export async function maybeShowBackupReminder(): Promise<void> {
  if (sessionBackupShown) return;
  const ok = await ensureNotificationPermissions();
  if (!ok) return;

  const lastBackup = await getLastBackupAt();

  if (lastBackup) {
    const days = differenceInDays(new Date(), new Date(lastBackup));
    if (days < BACKUP_STALE_DAYS) return;
    sessionBackupShown = true;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Backup reminder',
        body: `Your last backup was ${days} day${days === 1 ? '' : 's'} ago. Export a backup in Settings.`,
      },
      trigger: null,
    });
    return;
  }

  const productCount = await countProducts();
  if (productCount === 0) return;

  sessionBackupShown = true;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Backup reminder',
      body: 'No backup saved yet. Export a backup in Settings to protect your products and sales.',
    },
    trigger: null,
  });
}

export function resetSessionNotifications(): void {
  sessionLowStockShown = false;
  sessionBackupShown = false;
}

async function cancelScheduled(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore missing scheduled notification
  }
}

export async function registerBackgroundAlerts(): Promise<void> {
  if (Platform.OS === 'web' || backgroundRegistered) return;
  const ok = await ensureNotificationPermissions();
  if (!ok) return;
  backgroundRegistered = true;

  // No daily backup nag — reminder is evaluated on app open from real backup metadata.
  await cancelScheduled(BACKUP_REMINDER_ID);

  await cancelScheduled(LOW_STOCK_CHECK_ID);
  await Notifications.scheduleNotificationAsync({
    identifier: LOW_STOCK_CHECK_ID,
    content: {
      title: 'Low stock check',
      body: 'Review low-stock products in Stock → Alerts.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2,
      hour: 8,
      minute: 30,
    },
  });
}

export async function runScheduledLowStockCheck(): Promise<void> {
  if (sessionLowStockShown) return;
  const count = await countLowStock();
  if (count > 0) {
    await showLowStockNotification(count);
  }
}

export async function runScheduledBackupCheck(): Promise<void> {
  await maybeShowBackupReminder();
}

// Keep import compatibility if referenced elsewhere
export async function showBackupReminderNotification(_daysSince: number): Promise<void> {
  await maybeShowBackupReminder();
}
