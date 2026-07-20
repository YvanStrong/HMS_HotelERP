export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pcs (pieces)' },
  { value: 'kg', label: 'Kg (kilograms)' },
  { value: 'L', label: 'Liters (L)' },
  { value: 'pkg', label: 'Package (pkg)' },
  { value: 'box', label: 'Box' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'carton', label: 'Carton' },
  { value: 'g', label: 'Grams (g)' },
  { value: 'ml', label: 'Milliliters (ml)' },
] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number]['value'];

export function normalizeProductUnit(unit: string | null | undefined): string {
  const trimmed = unit?.trim();
  if (!trimmed) return 'pcs';
  const match = PRODUCT_UNITS.find((u) => u.value === trimmed);
  return match ? match.value : trimmed;
}
