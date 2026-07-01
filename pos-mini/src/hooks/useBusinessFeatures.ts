import type { BusinessFeature, BusinessTypeId } from '../constants/businessTypes';
import { businessTypeHasFeature, DEFAULT_BUSINESS_TYPE } from '../constants/businessTypes';
import { useAppStore } from '../store/appStore';

export function useBusinessFeatures() {
  const businessType = (useAppStore((s) => s.settings?.businessType) ?? DEFAULT_BUSINESS_TYPE) as BusinessTypeId;

  return {
    businessType,
    hasFeature: (feature: BusinessFeature) => businessTypeHasFeature(businessType, feature),
    hasKitchen: businessTypeHasFeature(businessType, 'kitchen'),
    hasModifiers: businessTypeHasFeature(businessType, 'modifiers'),
    hasTableService: businessTypeHasFeature(businessType, 'table_service'),
  };
}
