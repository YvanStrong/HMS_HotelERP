import type { BusinessSettings, Sale, SaleItem } from '../types';
import type { ReceiptDisplayPrefs } from '../repositories/metaRepository';
import { formatMoney } from './currency';

export type ReceiptBarcodeMap = Record<string, string | null>;

export function buildReceiptText(
  sale: Sale,
  items: SaleItem[],
  settings: BusinessSettings,
  display?: ReceiptDisplayPrefs,
  barcodes: ReceiptBarcodeMap = {},
): string {
  const prefs = display ?? {
    showLogo: true,
    showTax: true,
    showChange: true,
    showBarcode: false,
  };
  const lines: string[] = [];

  if (settings.receiptHeader) {
    lines.push(settings.receiptHeader);
    lines.push('');
  }

  if (prefs.showLogo && settings.businessLogo) {
    lines.push('[LOGO]');
    lines.push('');
  }

  lines.push(settings.businessName || 'POS Mini');
  if (settings.address) lines.push(settings.address);
  if (settings.phone) lines.push(`Tel: ${settings.phone}`);
  lines.push('');
  lines.push(`Invoice: ${sale.invoiceNumber}`);
  if (sale.status === 'voided') lines.push('*** VOIDED ***');
  if (sale.refundStatus === 'refunded') lines.push('*** REFUNDED ***');
  else if (sale.refundStatus === 'partial') lines.push('*** PARTIALLY REFUNDED ***');
  lines.push(`Date: ${new Date(sale.createdAt).toLocaleString()}`);
  if (sale.notes?.trim()) {
    lines.push(`Note: ${sale.notes.trim()}`);
  }
  lines.push('--------------------------------');
  lines.push('Item                Qty    Amount');
  lines.push('--------------------------------');

  for (const item of items) {
    const name = item.productName.slice(0, 18).padEnd(18);
    const qty = String(item.quantity).padStart(3);
    const amt = formatMoney(item.lineTotal, settings).padStart(8);
    lines.push(`${name} ${qty} ${amt}`);
    if (prefs.showBarcode) {
      const code = barcodes[item.productId];
      if (code) lines.push(`  ${code}`);
    }
  }

  lines.push('--------------------------------');
  lines.push(`Subtotal:${formatMoney(sale.subtotal, settings).padStart(22)}`);
  if (sale.discountAmount > 0) {
    lines.push(`Discount:${formatMoney(sale.discountAmount, settings).padStart(22)}`);
  }
  if (prefs.showTax && sale.taxAmount > 0) {
    const taxLabel = (settings.taxName || 'Tax').slice(0, 20);
    lines.push(`${taxLabel}:${formatMoney(sale.taxAmount, settings).padStart(27 - taxLabel.length)}`);
  }
  lines.push(`TOTAL:${formatMoney(sale.total, settings).padStart(25)}`);
  lines.push(`Paid:${formatMoney(sale.amountPaid, settings).padStart(26)}`);
  if (prefs.showChange && sale.changeAmount > 0) {
    lines.push(`Change:${formatMoney(sale.changeAmount, settings).padStart(24)}`);
  }
  lines.push(`Payment: ${sale.paymentMethod.toUpperCase()}`);
  lines.push('');
  lines.push(settings.receiptFooter || 'Thank you!');

  return lines.join('\n');
}

export function buildReceiptHtml(
  sale: Sale,
  items: SaleItem[],
  settings: BusinessSettings,
  display?: ReceiptDisplayPrefs,
  barcodes: ReceiptBarcodeMap = {},
): string {
  const prefs = display ?? {
    showLogo: true,
    showTax: true,
    showChange: true,
    showBarcode: false,
  };

  const itemRows = items
    .map((item) => {
      const barcodeRow =
        prefs.showBarcode && barcodes[item.productId]
          ? `<tr><td colspan="3" style="font-size:10px;color:#666">${barcodes[item.productId]}</td></tr>`
          : '';
      return `<tr><td>${item.productName}</td><td>${item.quantity}</td><td>${formatMoney(item.lineTotal, settings)}</td></tr>${barcodeRow}`;
    })
    .join('');

  const logoHtml =
    prefs.showLogo && settings.businessLogo
      ? `<div class="center"><img src="${settings.businessLogo}" style="max-height:60px;margin-bottom:8px" alt="logo"/></div>`
      : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:monospace;font-size:12px;max-width:300px;margin:0 auto}
    table{width:100%;border-collapse:collapse}td{padding:2px 0}
    .right{text-align:right}.center{text-align:center}
  </style></head><body>
    ${logoHtml}
    <div class="center"><strong>${settings.businessName || 'POS Mini'}</strong></div>
    ${settings.address ? `<div class="center">${settings.address}</div>` : ''}
    <p>Invoice: ${sale.invoiceNumber}<br>Date: ${new Date(sale.createdAt).toLocaleString()}</p>
    ${sale.status === 'voided' ? '<p class="center" style="color:#dc2626;font-weight:bold">VOIDED</p>' : ''}
    ${sale.refundStatus === 'refunded' ? '<p class="center" style="color:#d97706;font-weight:bold">REFUNDED</p>' : sale.refundStatus === 'partial' ? '<p class="center" style="color:#d97706;font-weight:bold">PARTIALLY REFUNDED</p>' : ''}
    ${sale.notes ? `<p>Note: ${sale.notes}</p>` : ''}
    <table><tr><th>Item</th><th>Qty</th><th>Amt</th></tr>${itemRows}</table>
    <p class="right">Subtotal: ${formatMoney(sale.subtotal, settings)}</p>
    ${sale.discountAmount > 0 ? `<p class="right">Discount: ${formatMoney(sale.discountAmount, settings)}</p>` : ''}
    ${prefs.showTax && sale.taxAmount > 0 ? `<p class="right">${settings.taxName || 'Tax'}: ${formatMoney(sale.taxAmount, settings)}</p>` : ''}
    <p class="right"><strong>Total: ${formatMoney(sale.total, settings)}</strong></p>
    <p class="right">Paid: ${formatMoney(sale.amountPaid, settings)}</p>
    ${prefs.showChange && sale.changeAmount > 0 ? `<p class="right">Change: ${formatMoney(sale.changeAmount, settings)}</p>` : ''}
    <p class="center">${settings.receiptFooter || 'Thank you!'}</p>
  </body></html>`;
}
