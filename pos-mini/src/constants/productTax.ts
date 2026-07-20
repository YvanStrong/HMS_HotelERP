export type ProductTaxClass = 'A' | 'B';

export const PRODUCT_TAX_OPTIONS: { value: ProductTaxClass; label: string }[] = [
  { value: 'A', label: 'A — Exempt from tax' },
  { value: 'B', label: 'B — Taxable (18%)' },
];

export const TAXABLE_VAT_RATE = 18;

export function taxRateForClass(taxClass: ProductTaxClass): number {
  return taxClass === 'B' ? TAXABLE_VAT_RATE : 0;
}

export function normalizeProductTaxClass(value: string | null | undefined): ProductTaxClass {
  return value === 'B' ? 'B' : 'A';
}
