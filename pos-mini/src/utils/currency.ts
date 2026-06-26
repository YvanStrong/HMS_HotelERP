import type { BusinessSettings } from '../types';
import { roundMoney } from './calculations';

export function formatMoney(
  amount: number,
  settings?: Pick<BusinessSettings, 'currency' | 'currencySymbol'> | null,
): string {
  const symbol = settings?.currencySymbol ?? '$';
  const currency = settings?.currency ?? 'USD';
  const rounded = roundMoney(amount);

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(rounded);
  } catch {
    return `${symbol}${rounded.toFixed(2)}`;
  }
}

export function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}
