import { getDb } from '../db/database';

export type PaymentMethodSettings = {
  cardEnabled: boolean;
  mobileEnabled: boolean;
  creditEnabled: boolean;
  mobileMoneyLabel: string;
};

const DEFAULT_PAYMENT: PaymentMethodSettings = {
  cardEnabled: true,
  mobileEnabled: true,
  creditEnabled: true,
  mobileMoneyLabel: 'Mobile Money',
};

async function getMeta(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

async function setMeta(key: string, value: string): Promise<void> {
  const db = getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
}

export async function getPaymentMethodSettings(): Promise<PaymentMethodSettings> {
  const raw = await getMeta('payment_methods');
  if (!raw) return { ...DEFAULT_PAYMENT };
  try {
    return { ...DEFAULT_PAYMENT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PAYMENT };
  }
}

export async function savePaymentMethodSettings(
  input: Partial<PaymentMethodSettings>,
): Promise<PaymentMethodSettings> {
  const current = await getPaymentMethodSettings();
  const next = { ...current, ...input };
  await setMeta('payment_methods', JSON.stringify(next));
  return next;
}

export async function getLastBackupAt(): Promise<string | null> {
  return getMeta('last_backup_at');
}

export async function setLastBackupAt(iso: string): Promise<void> {
  await setMeta('last_backup_at', iso);
}

export async function getLastBackupSize(): Promise<number | null> {
  const raw = await getMeta('last_backup_size');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setLastBackupSize(bytes: number): Promise<void> {
  await setMeta('last_backup_size', String(Math.round(bytes)));
}

export type BackupFrequency = 'off' | 'daily' | 'weekly' | 'monthly';

export type BackupSettings = {
  reminderFrequency: BackupFrequency;
};

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  reminderFrequency: 'weekly',
};

export async function getBackupSettings(): Promise<BackupSettings> {
  const raw = await getMeta('backup_settings');
  if (!raw) return { ...DEFAULT_BACKUP_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<BackupSettings>;
    const freq = parsed.reminderFrequency;
    if (freq === 'off' || freq === 'daily' || freq === 'weekly' || freq === 'monthly') {
      return { reminderFrequency: freq };
    }
    return { ...DEFAULT_BACKUP_SETTINGS };
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
}

export async function saveBackupSettings(input: Partial<BackupSettings>): Promise<BackupSettings> {
  const current = await getBackupSettings();
  const next = { ...current, ...input };
  await setMeta('backup_settings', JSON.stringify(next));
  return next;
}

export type ReceiptDisplayPrefs = {
  showLogo: boolean;
  showTax: boolean;
  showChange: boolean;
  showBarcode: boolean;
};

const DEFAULT_RECEIPT_PREFS: ReceiptDisplayPrefs = {
  showLogo: true,
  showTax: true,
  showChange: true,
  showBarcode: false,
};

export async function getReceiptDisplayPrefs(): Promise<ReceiptDisplayPrefs> {
  const raw = await getMeta('receipt_display');
  if (!raw) return { ...DEFAULT_RECEIPT_PREFS };
  try {
    return { ...DEFAULT_RECEIPT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_RECEIPT_PREFS };
  }
}

export async function saveReceiptDisplayPrefs(
  input: Partial<ReceiptDisplayPrefs>,
): Promise<ReceiptDisplayPrefs> {
  const current = await getReceiptDisplayPrefs();
  const next = { ...current, ...input };
  await setMeta('receipt_display', JSON.stringify(next));
  return next;
}

export type PrinterSettings = {
  autoPrint: boolean;
};

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  autoPrint: false,
};

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const raw = await getMeta('printer_settings');
  if (!raw) return { ...DEFAULT_PRINTER_SETTINGS };
  try {
    return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PRINTER_SETTINGS };
  }
}

export async function savePrinterSettings(input: Partial<PrinterSettings>): Promise<PrinterSettings> {
  const current = await getPrinterSettings();
  const next = { ...current, ...input };
  await setMeta('printer_settings', JSON.stringify(next));
  return next;
}

export type ThemeSettings = {
  mode: 'light' | 'dark';
};

const DEFAULT_THEME: ThemeSettings = { mode: 'light' };

export async function getThemeSettings(): Promise<ThemeSettings> {
  const raw = await getMeta('theme_mode');
  if (!raw) return { ...DEFAULT_THEME };
  try {
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return { mode: raw === 'dark' ? 'dark' : 'light' };
  }
}

export async function saveThemeSettings(input: Partial<ThemeSettings>): Promise<ThemeSettings> {
  const current = await getThemeSettings();
  const next = { ...current, ...input };
  await setMeta('theme_mode', JSON.stringify(next));
  return next;
}

export async function getCurrentStaffId(): Promise<string | null> {
  return getMeta('current_staff_id');
}

export async function setCurrentStaffId(id: string | null): Promise<void> {
  if (id) await setMeta('current_staff_id', id);
  else {
    const db = getDb();
    await db.runAsync('DELETE FROM app_meta WHERE key = ?', ['current_staff_id']);
  }
}

export async function getRequireShift(): Promise<boolean> {
  const raw = await getMeta('require_shift');
  if (raw === null) return false;
  return raw === '1' || raw === 'true';
}

export async function saveRequireShift(required: boolean): Promise<void> {
  await setMeta('require_shift', required ? '1' : '0');
}

export async function getRequireStaffLogin(): Promise<boolean> {
  const raw = await getMeta('require_staff_login');
  if (raw === null) return false;
  return raw === '1' || raw === 'true';
}

export async function saveRequireStaffLogin(required: boolean): Promise<void> {
  await setMeta('require_staff_login', required ? '1' : '0');
}

export type PosSettings = {
  managerDiscountThresholdPercent: number;
};

const DEFAULT_POS_SETTINGS: PosSettings = {
  managerDiscountThresholdPercent: 10,
};

export async function getPosSettings(): Promise<PosSettings> {
  const raw = await getMeta('pos_settings');
  if (!raw) return { ...DEFAULT_POS_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<PosSettings>;
    return {
      managerDiscountThresholdPercent:
        typeof parsed.managerDiscountThresholdPercent === 'number'
          ? parsed.managerDiscountThresholdPercent
          : DEFAULT_POS_SETTINGS.managerDiscountThresholdPercent,
    };
  } catch {
    return { ...DEFAULT_POS_SETTINGS };
  }
}

export async function savePosSettings(input: Partial<PosSettings>): Promise<PosSettings> {
  const current = await getPosSettings();
  const next = { ...current, ...input };
  await setMeta('pos_settings', JSON.stringify(next));
  return next;
}

export async function getPinnedProductIds(): Promise<string[]> {
  const raw = await getMeta('pinned_product_ids');
  if (!raw) return [];
  try {
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
}

export async function savePinnedProductIds(ids: string[]): Promise<void> {
  await setMeta('pinned_product_ids', JSON.stringify(ids));
}

export async function getLastSaleId(): Promise<string | null> {
  return getMeta('last_sale_id');
}

export async function setLastSaleId(id: string): Promise<void> {
  await setMeta('last_sale_id', id);
}

export type KitchenPrinterRoute = {
  categoryId: string;
  categoryName: string;
  printerAddress: string;
  printerName?: string;
};

export async function getKitchenPrinterRoutes(): Promise<KitchenPrinterRoute[]> {
  const raw = await getMeta('kitchen_printer_routes');
  if (!raw) return [];
  try {
    const routes = JSON.parse(raw) as KitchenPrinterRoute[];
    return Array.isArray(routes) ? routes : [];
  } catch {
    return [];
  }
}

export async function saveKitchenPrinterRoutes(routes: KitchenPrinterRoute[]): Promise<void> {
  await setMeta('kitchen_printer_routes', JSON.stringify(routes));
}

export async function getBackupEncryptionEnabled(): Promise<boolean> {
  const raw = await getMeta('backup_encrypt');
  return raw === '1' || raw === 'true';
}

export async function saveBackupEncryptionEnabled(enabled: boolean): Promise<void> {
  await setMeta('backup_encrypt', enabled ? '1' : '0');
}

export type AppLanguage = 'en' | 'fr';

export async function getAppLanguage(): Promise<AppLanguage> {
  const raw = await getMeta('app_language');
  return raw === 'fr' ? 'fr' : 'en';
}

export async function saveAppLanguage(lang: AppLanguage): Promise<void> {
  await setMeta('app_language', lang);
}

export async function getOnboardingComplete(): Promise<boolean> {
  const raw = await getMeta('onboarding_complete');
  return raw === '1' || raw === 'true';
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
  await setMeta('onboarding_complete', complete ? '1' : '0');
  if (complete) {
    await setMeta('onboarding_pending', '0');
  }
}

/** First-install tour flag — only set after business setup, cleared when tour finishes. */
export async function getOnboardingPending(): Promise<boolean> {
  const raw = await getMeta('onboarding_pending');
  return raw === '1' || raw === 'true';
}

export async function setOnboardingPending(pending: boolean): Promise<void> {
  await setMeta('onboarding_pending', pending ? '1' : '0');
}

/** Show tour only for a brand-new install that just finished setup. */
export async function shouldShowOnboardingTour(): Promise<boolean> {
  if (await getOnboardingPending()) return true;
  // Existing installs (upgrade / already set up) never see the tour.
  if (!(await getOnboardingComplete())) {
    await setOnboardingComplete(true);
  }
  return false;
}
