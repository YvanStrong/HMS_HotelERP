import type { BusinessSettings, Shift } from '../types';
import type { ZReportSummary } from '../repositories/shiftRepository';
import { formatMoney } from './currency';

export function buildZReportText(
  shift: Shift,
  report: ZReportSummary,
  settings: BusinessSettings | null,
  closingCash?: number | null,
): string {
  const opened = new Date(shift.openedAt).toLocaleString();
  const closed = shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Open';
  const lines = [
    settings?.businessName || 'POS Mini',
    'Z-REPORT',
    '--------------------------------',
    `Opened: ${opened}`,
    `Closed: ${closed}`,
    '',
    `Sales total: ${formatMoney(report.salesTotal, settings)} (${report.salesCount} txns)`,
    `Cash sales: ${formatMoney(report.cashSales, settings)}`,
    `Refunds: ${formatMoney(report.refundsTotal, settings)}`,
    '',
    `Opening cash: ${formatMoney(report.openingCash, settings)}`,
    `Expected cash: ${formatMoney(report.expectedCash, settings)}`,
  ];
  if (closingCash != null) {
    lines.push(`Closing cash: ${formatMoney(closingCash, settings)}`);
    lines.push(`Variance: ${formatMoney(closingCash - report.expectedCash, settings)}`);
  }
  lines.push('--------------------------------');
  return lines.join('\n');
}
