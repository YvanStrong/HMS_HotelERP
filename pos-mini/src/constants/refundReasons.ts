export const REFUND_REASON_CODES = [
  { code: 'defective', label: 'Defective / damaged' },
  { code: 'wrong_item', label: 'Wrong item' },
  { code: 'customer_changed', label: 'Customer changed mind' },
  { code: 'price_error', label: 'Price error' },
  { code: 'duplicate', label: 'Duplicate charge' },
  { code: 'other', label: 'Other' },
] as const;

export type RefundReasonCode = (typeof REFUND_REASON_CODES)[number]['code'];

export function refundReasonLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return REFUND_REASON_CODES.find((r) => r.code === code)?.label ?? code;
}
