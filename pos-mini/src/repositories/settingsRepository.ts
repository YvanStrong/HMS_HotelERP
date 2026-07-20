import type { BusinessSettings } from '../types';
import { DEFAULT_BUSINESS_TYPE, type BusinessTypeId } from '../constants/businessTypes';
import { getDb } from '../db/database';
import { nowIso } from '../utils/ids';

type SettingsRow = {
  id: number;
  business_name: string;
  business_type: string;
  business_logo: string | null;
  tax_name: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  currency_symbol: string;
  tax_enabled: number;
  tax_rate: number;
  tax_inclusive: number;
  receipt_header: string;
  receipt_footer: string;
  pin_enabled: number;
  low_stock_alert: number;
  created_at: string;
  updated_at: string;
};

function mapSettings(row: SettingsRow): BusinessSettings {
  return {
    id: row.id,
    businessName: row.business_name,
    businessType: (row.business_type as BusinessTypeId) || DEFAULT_BUSINESS_TYPE,
    businessLogo: row.business_logo,
    taxName: row.tax_name ?? 'Tax',
    address: row.address,
    phone: row.phone,
    email: row.email,
    currency: row.currency,
    currencySymbol: row.currency_symbol,
    taxEnabled: row.tax_enabled === 1,
    taxRate: row.tax_rate,
    taxInclusive: row.tax_inclusive === 1,
    receiptHeader: row.receipt_header,
    receiptFooter: row.receipt_footer,
    pinEnabled: row.pin_enabled === 1,
    lowStockAlert: row.low_stock_alert === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  const db = getDb();
  const row = await db.getFirstAsync<SettingsRow>('SELECT * FROM business_settings WHERE id = 1');
  return row ? mapSettings(row) : null;
}

export async function saveBusinessSettings(
  input: Partial<Omit<BusinessSettings, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<BusinessSettings> {
  const db = getDb();
  const existing = await getBusinessSettings();
  const now = nowIso();

  if (!existing) {
    await db.runAsync(
      `INSERT INTO business_settings (
        id, business_name, business_type, business_logo, tax_name, address, phone, email, currency, currency_symbol,
        tax_enabled, tax_rate, tax_inclusive, receipt_header, receipt_footer,
        pin_enabled, low_stock_alert, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.businessName ?? '',
        input.businessType ?? DEFAULT_BUSINESS_TYPE,
        input.businessLogo ?? null,
        input.taxName ?? 'Tax',
        input.address ?? '',
        input.phone ?? '',
        input.email ?? '',
        input.currency ?? 'USD',
        input.currencySymbol ?? '$',
        input.taxEnabled ? 1 : 0,
        input.taxRate ?? 0,
        input.taxInclusive ? 1 : 0,
        input.receiptHeader ?? '',
        input.receiptFooter ?? 'Thank you!',
        input.pinEnabled ? 1 : 0,
        input.lowStockAlert !== false ? 1 : 0,
        now,
        now,
      ],
    );
  } else {
    await db.runAsync(
      `UPDATE business_settings SET
        business_name = ?, business_type = ?, business_logo = ?, tax_name = ?, address = ?, phone = ?, email = ?,
        currency = ?, currency_symbol = ?, tax_enabled = ?, tax_rate = ?,
        tax_inclusive = ?, receipt_header = ?, receipt_footer = ?,
        pin_enabled = ?, low_stock_alert = ?, updated_at = ?
      WHERE id = 1`,
      [
        input.businessName ?? existing.businessName,
        input.businessType ?? existing.businessType,
        input.businessLogo !== undefined ? input.businessLogo : existing.businessLogo,
        input.taxName ?? existing.taxName,
        input.address ?? existing.address,
        input.phone ?? existing.phone,
        input.email ?? existing.email,
        input.currency ?? existing.currency,
        input.currencySymbol ?? existing.currencySymbol,
        (input.taxEnabled ?? existing.taxEnabled) ? 1 : 0,
        input.taxRate ?? existing.taxRate,
        (input.taxInclusive ?? existing.taxInclusive) ? 1 : 0,
        input.receiptHeader ?? existing.receiptHeader,
        input.receiptFooter ?? existing.receiptFooter,
        (input.pinEnabled ?? existing.pinEnabled) ? 1 : 0,
        (input.lowStockAlert ?? existing.lowStockAlert) ? 1 : 0,
        now,
      ],
    );
  }

  const updated = await getBusinessSettings();
  if (!updated) throw new Error('Failed to save settings');
  return updated;
}

export async function isBusinessSetupComplete(): Promise<boolean> {
  const settings = await getBusinessSettings();
  return Boolean(settings?.businessName?.trim());
}
