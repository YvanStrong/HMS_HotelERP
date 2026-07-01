export type BusinessTypeId =
  | 'coffee_shop'
  | 'boutique'
  | 'bar_restaurant'
  | 'restaurant'
  | 'retail_store'
  | 'grocery'
  | 'salon_spa'
  | 'pharmacy'
  | 'other';

export type BusinessFeature = 'kitchen' | 'modifiers' | 'table_service';

export type BusinessTypeOption = {
  id: BusinessTypeId;
  label: string;
  description: string;
  features: BusinessFeature[];
};

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  {
    id: 'coffee_shop',
    label: 'Coffee Shop',
    description: 'Café, bakery, quick-service drinks & snacks',
    features: ['kitchen', 'modifiers'],
  },
  {
    id: 'bar_restaurant',
    label: 'Bar & Restaurant',
    description: 'Full bar with kitchen and table service',
    features: ['kitchen', 'modifiers', 'table_service'],
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Sit-down dining with kitchen orders',
    features: ['kitchen', 'modifiers', 'table_service'],
  },
  {
    id: 'boutique',
    label: 'Boutique',
    description: 'Fashion, gifts, and specialty retail',
    features: [],
  },
  {
    id: 'retail_store',
    label: 'Retail Store',
    description: 'General merchandise and point-of-sale',
    features: [],
  },
  {
    id: 'grocery',
    label: 'Grocery / Supermarket',
    description: 'Food retail with inventory tracking',
    features: [],
  },
  {
    id: 'salon_spa',
    label: 'Salon & Spa',
    description: 'Beauty, wellness, and appointments',
    features: [],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    description: 'Medicine and health products',
    features: [],
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Custom business — basic POS features',
    features: [],
  },
];

export const DEFAULT_BUSINESS_TYPE: BusinessTypeId = 'retail_store';

export function getBusinessTypeOption(id: BusinessTypeId | string | null | undefined): BusinessTypeOption {
  return BUSINESS_TYPES.find((t) => t.id === id) ?? BUSINESS_TYPES.find((t) => t.id === DEFAULT_BUSINESS_TYPE)!;
}

export function businessTypeHasFeature(
  typeId: BusinessTypeId | string | null | undefined,
  feature: BusinessFeature,
): boolean {
  return getBusinessTypeOption(typeId).features.includes(feature);
}
