import type { Staff, StaffRole } from '../types';

export function isManager(staff: Staff | null | undefined): boolean {
  return staff?.role === 'manager';
}

export function canVoidSales(staff: Staff | null | undefined, staffExists: boolean): boolean {
  if (!staffExists) return true;
  return isManager(staff);
}

export function canProcessRefunds(staff: Staff | null | undefined, staffExists: boolean): boolean {
  if (!staffExists) return true;
  return isManager(staff);
}

export function discountNeedsApproval(
  subtotal: number,
  discountAmount: number,
  thresholdPercent: number,
  staff: Staff | null | undefined,
  staffExists: boolean,
): boolean {
  if (!staffExists || isManager(staff)) return false;
  if (subtotal <= 0 || discountAmount <= 0) return false;
  const pct = (discountAmount / subtotal) * 100;
  return pct > thresholdPercent;
}

export function roleLabel(role: StaffRole): string {
  return role === 'manager' ? 'Manager' : 'Cashier';
}
