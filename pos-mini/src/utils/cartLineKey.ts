import type { SelectedModifier } from '../types';

export function buildCartLineKey(
  productId: string,
  variantId?: string | null,
  modifiers?: SelectedModifier[],
): string {
  const modKey = modifiers?.length
    ? modifiers
        .map((m) => m.optionId)
        .sort()
        .join(',')
    : '';
  return `${productId}:${variantId ?? ''}:${modKey}`;
}
