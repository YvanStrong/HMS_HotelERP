import type { BusinessSettings } from '../types';
import type { ProductTaxClass } from '../constants/productTax';
import { TAXABLE_VAT_RATE } from '../constants/productTax';

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

export type CartTaxLine = {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  taxClass: ProductTaxClass;
};

/** VAT on class-B lines only (18%), after proportional cart discount. */
export function calculateCartTax(
  items: CartTaxLine[],
  cartDiscountAmount: number,
  taxInclusive = false,
): number {
  if (!items.length) return 0;

  const subtotal = calculateSubtotal(items);
  if (subtotal <= 0) return 0;

  let taxableBase = 0;
  for (const item of items) {
    if (item.taxClass !== 'B') continue;
    const lineTotal = calculateLineTotal(item.unitPrice, item.quantity, item.discountAmount ?? 0);
    const lineShare = lineTotal / subtotal;
    const lineCartDiscount = cartDiscountAmount * lineShare;
    taxableBase += Math.max(0, lineTotal - lineCartDiscount);
  }

  if (taxableBase <= 0) return 0;

  if (taxInclusive) {
    return taxableBase - taxableBase / (1 + TAXABLE_VAT_RATE / 100);
  }

  return taxableBase * (TAXABLE_VAT_RATE / 100);
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
