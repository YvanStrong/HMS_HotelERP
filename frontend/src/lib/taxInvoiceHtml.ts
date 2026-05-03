export function escapeInvoiceHtml(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Derive summary numbers from persisted invoice line items (matches checkout print when no breakdown). */
export function summarizeFromLineItems(items: { description: string; amount: number }[], balanceAfter: number) {
  let totalCharges = 0;
  let depositPaid = 0;
  let paidAtCheckout = 0;
  for (const it of items) {
    const a = Number(it.amount);
    const d = String(it.description).toLowerCase();
    if (a > 0) totalCharges += a;
    if (d.includes("deposit")) depositPaid += Math.abs(a);
    if (d.includes("payment received")) paidAtCheckout += Math.abs(a);
  }
  const remainingBeforePayment = paidAtCheckout + Math.max(0, balanceAfter);
  return { totalCharges, depositPaid, paidAtCheckout, remainingBeforePayment, balanceAfter };
}

export function guessPaymentMethodFromItems(items: { description: string; amount: number }[]) {
  for (const it of items) {
    const m = String(it.description).match(/payment\s+received\s*\(([^)]+)\)/i);
    if (m) return m[1].trim();
  }
  return "PAYMENT";
}

export type TaxInvoiceHtmlOpts = {
  invoiceNumber: string;
  items: { description: string; amount: number }[];
  bookingRef: string;
  guestName: string;
  roomLabel: string;
  whenLabel: string;
  currency: string;
  totalCharges: number;
  depositPaid: number;
  remainingBeforePayment: number;
  paidAtCheckout: number;
  paymentMethodLabel: string;
  paymentTypesUsed: string;
  balanceAfter: number;
};

export function buildTaxInvoiceHtml(opts: TaxInvoiceHtmlOpts) {
  const esc = escapeInvoiceHtml;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const assetUrl = (path: string) => `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice ${esc(opts.invoiceNumber)}</title>
    <style>
    body{font-family:Arial,sans-serif;margin:20px;color:#111}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
    .brand{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .logo-img{height:52px;width:auto;object-fit:contain;display:block}
    .inv{border:1px solid #e2e8f0;border-radius:10px;padding:14px}
    .row{display:flex;justify-content:space-between;margin:6px 0}
    .muted{color:#64748b}
    .strong{font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
    tfoot td{font-weight:700}
    </style></head><body>
    <div class="top">
      <div class="brand">
        <img class="logo-img" src="${esc(assetUrl("/images/RRA_LOGO.png"))}" alt="RRA" />
        <img class="logo-img" src="${esc(assetUrl("/images/rraLogo2.png"))}" alt="RRA" />
      </div>
      <img class="logo-img" style="height:56px" src="${esc(assetUrl("/images/logoubumwe.png"))}" alt="Hotel" />
    </div>
    <h2>Tax Invoice</h2>
    <div class="inv">
      <div class="row"><span class="muted">Invoice #</span><span class="strong">${esc(opts.invoiceNumber)}</span></div>
      <div class="row"><span class="muted">Booking reference</span><span>${esc(opts.bookingRef)}</span></div>
      <div class="row"><span class="muted">Guest</span><span>${esc(opts.guestName)}</span></div>
      <div class="row"><span class="muted">Room</span><span>${esc(opts.roomLabel)}</span></div>
      <div class="row"><span class="muted">Time</span><span>${esc(opts.whenLabel)}</span></div>
      <table>
        <thead><tr><th>Description</th><th>Amount (${esc(opts.currency)})</th></tr></thead>
        <tbody>
          ${opts.items.map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.amount)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="row"><span class="muted">Total charges</span><span>${esc(opts.totalCharges)} ${esc(opts.currency)}</span></div>
      <div class="row"><span class="muted">Deposit paid</span><span>- ${esc(opts.depositPaid)} ${esc(opts.currency)}</span></div>
      <div class="row"><span class="muted">Remaining before checkout payment</span><span>${esc(opts.remainingBeforePayment)} ${esc(opts.currency)}</span></div>
      <div class="row"><span class="muted">Paid at checkout (${esc(opts.paymentMethodLabel)})</span><span>- ${esc(opts.paidAtCheckout)} ${esc(opts.currency)}</span></div>
      <div class="row"><span class="muted">Payment types used</span><span>${esc(opts.paymentTypesUsed)}</span></div>
      <div class="row strong"><span>Balance after payment</span><span>${esc(opts.balanceAfter)} ${esc(opts.currency)}</span></div>
    </div>
    </body></html>`;
}

/** Open branded tax invoice in a new window and trigger print (same UX as reservation "Print Invoice"). */
export function openTaxInvoicePrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  return true;
}
