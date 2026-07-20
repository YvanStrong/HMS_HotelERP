import { differenceInDays } from 'date-fns';
import type { BackupFrequency } from '../repositories/metaRepository';

export function formatBackupSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getBackupStaleDays(frequency: BackupFrequency): number | null {
  switch (frequency) {
    case 'daily':
      return 1;
    case 'weekly':
      return 7;
    case 'monthly':
      return 30;
    default:
      return null;
  }
}

export function isBackupReminderDue(
  lastBackup: string | null,
  frequency: BackupFrequency,
  hasData: boolean,
): boolean {
  const staleDays = getBackupStaleDays(frequency);
  if (staleDays === null) return false;
  if (!lastBackup) return hasData;
  return differenceInDays(new Date(), new Date(lastBackup)) >= staleDays;
}

export function backupReminderMessage(
  lastBackup: string | null,
  frequency: BackupFrequency,
): string {
  if (frequency === 'off') return '';
  const label = frequency === 'daily' ? 'daily' : frequency === 'weekly' ? 'weekly' : 'monthly';
  if (!lastBackup) {
    return `You have not backed up yet. Your ${label} reminder is on — save a copy to Google Drive below.`;
  }
  const days = differenceInDays(new Date(), new Date(lastBackup));
  return `Last backup was ${days} day${days === 1 ? '' : 's'} ago. Your ${label} reminder is on — back up now.`;
}
