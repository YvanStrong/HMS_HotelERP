import type { BusinessSettings } from '../types';

export function calculateLineTotal(unitPrice: number, quantity: number, discountAmount = 0): number {
  return Math.max(0, unitPrice * quantity - discountAmount);
}

export function calculateSubtotal(
  items: { unitPrice: number; quantity: number; discountAmount?: number }[],
): number {
  return items.reduce(
    (sum, item) => sum + calculateLineTotal(item.unitPrice, item.quantity, item.discountAmount ?? 0),
    0,
  );
}

export function calculateDiscountAmount(
  subtotal: number,
  discountPercent: number,
  fixedDiscount: number,
): number {
  const percentDiscount = subtotal * (discountPercent / 100);
  return Math.min(subtotal, percentDiscount + fixedDiscount);
}

export function calculateTax(
  subtotal: number,
  discountAmount: number,
  settings: Pick<BusinessSettings, 'taxEnabled' | 'taxRate' | 'taxInclusive'>,
): number {
  if (!settings.taxEnabled || settings.taxRate <= 0) return 0;

  const taxableBase = Math.max(0, subtotal - discountAmount);

  if (settings.taxInclusive) {
    return taxableBase - taxableBase / (1 + settings.taxRate / 100);
  }

  return taxableBase * (settings.taxRate / 100);
}

export function calculateTotal(
  subtotal: number,
  discountAmount: number,
  taxAmount: number,
  taxInclusive: boolean,
): number {
  if (taxInclusive) {
    return Math.max(0, subtotal - discountAmount);
  }
  return Math.max(0, subtotal - discountAmount + taxAmount);
}

export function calculateChange(amountPaid: number, total: number): number {
  return Math.max(0, amountPaid - total);
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
