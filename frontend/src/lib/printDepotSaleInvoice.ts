/** Printable depot / POS sale document (use browser Print → Save as PDF). */

export type DepotSaleLine = {
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** When true, line total is treated as VAT-inclusive at `vatPercent` (default 18%). */
  taxable?: boolean;
};

export type DepotSalePrintPayload = {
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName: string | null;
  totalAmount: number;
  soldAt: string;
  lines: DepotSaleLine[];
  /** VAT rate for extraction from VAT-inclusive line totals (Rwanda default 18). */
  vatPercent?: number;
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Split VAT-inclusive gross into net + VAT (per line, 2 dp). */
function splitInclusiveVat(gross: number, taxable: boolean, vatPercent: number): { net: number; vat: number } {
  const g = round2(gross);
  if (!taxable || vatPercent <= 0) return { net: g, vat: 0 };
  const net = round2(g / (1 + vatPercent / 100));
  const vat = round2(g - net);
  return { net, vat };
}

export function buildDepotSaleInvoiceHtml(payload: DepotSalePrintPayload, currency = "FRW"): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const assetUrl = (path: string) => `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const vatPercent = payload.vatPercent ?? 18;

  const soldAtLabel = (() => {
    try {
      return new Date(payload.soldAt).toLocaleString();
    } catch {
      return payload.soldAt;
    }
  })();

  const rows = payload.lines
    .map(
      (ln) => `
      <tr>
        <td class="col-item">${esc(ln.productName)}<div class="sub">${esc(ln.productCode)}</div></td>
        <td class="col-qty">${esc(Number(ln.quantity).toFixed(3))}</td>
        <td class="col-unit">${esc(Number(ln.unitPrice).toFixed(2))}</td>
        <td class="col-line strong">${esc(Number(ln.lineTotal).toFixed(2))}</td>
      </tr>`,
    )
    .join("");

  let subtotalExclVat = 0;
  for (const ln of payload.lines) {
    const taxable = ln.taxable !== false;
    const { net } = splitInclusiveVat(Number(ln.lineTotal), taxable, vatPercent);
    subtotalExclVat += net;
  }
  subtotalExclVat = round2(subtotalExclVat);
  const totalIncl = round2(Number(payload.totalAmount));
  /** Remainder so subtotal + VAT matches charged total after per-line rounding. */
  const vatTotal = round2(Math.max(0, totalIncl - subtotalExclVat));

  return `<!doctype html><html><head><meta charset="utf-8"/><title>Sale ${esc(payload.saleNumber)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: #2b211c;
    background: linear-gradient(180deg, #f7f1ea 0%, #efe6dc 100%);
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fffdf9;
    border: 1px solid #d9cfc4;
    border-radius: 14px;
    padding: 22px 24px 26px;
    box-shadow: 0 18px 50px rgba(58, 45, 40, 0.08);
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid #e8dfd4;
    margin-bottom: 16px;
  }
  .brand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .logo-img { height: 48px; width: auto; object-fit: contain; display: block; }
  h1 {
    margin: 0 0 4px;
    font-size: 20px;
    letter-spacing: 0.02em;
    font-weight: 800;
    color: #3a2d28;
  }
  .tagline { margin: 0; font-size: 11px; color: #7a6a62; letter-spacing: 0.12em; text-transform: uppercase; }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 18px;
    margin-bottom: 16px;
    font-size: 12px;
  }
  .meta div { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px dashed #e3d8ce; padding-bottom: 6px; }
  .muted { color: #7a6a62; }
  .strong { font-weight: 700; color: #3a2d28; }
  table.lines {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin-top: 4px;
    font-size: 12px;
  }
  col.col-item { width: 46%; }
  col.col-qty { width: 12%; }
  col.col-unit { width: 21%; }
  col.col-line { width: 21%; }
  th {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #7a6a62;
    border-bottom: 2px solid #d9cfc4;
    padding: 8px 6px;
    vertical-align: bottom;
  }
  th.col-item { text-align: left; }
  th.col-qty, th.col-unit, th.col-line { text-align: right; }
  td {
    padding: 10px 6px;
    border-bottom: 1px solid #efe6dc;
    vertical-align: top;
  }
  td.col-item { text-align: left; word-wrap: break-word; overflow-wrap: anywhere; }
  td.col-qty, td.col-unit, td.col-line {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .sub { font-size: 11px; color: #7a6a62; margin-top: 2px; }
  tfoot td { border-bottom: none; padding-top: 12px; font-size: 14px; }
  tfoot td.footer-total {
    text-align: right;
    padding-right: 10px;
    font-weight: 600;
    color: #7a6a62;
  }
  .invoice-totals {
    margin-top: 14px;
    max-width: 320px;
    margin-left: auto;
    font-size: 13px;
    border-top: 2px solid #d9cfc4;
    padding-top: 10px;
  }
  .invoice-totals .row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 4px 0;
    font-variant-numeric: tabular-nums;
  }
  .invoice-totals .row.grand {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px solid #e8dfd4;
    font-weight: 800;
    font-size: 15px;
    color: #3a2d28;
  }
  .invoice-totals .note {
    margin-top: 8px;
    font-size: 10px;
    color: #7a6a62;
    line-height: 1.45;
  }
  .foot {
    margin-top: 18px;
    padding-top: 12px;
    border-top: 1px solid #e8dfd4;
    font-size: 11px;
    color: #7a6a62;
    line-height: 1.5;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; border: none; max-width: none; }
  }
</style></head><body>
  <div class="sheet">
    <div class="top">
      <div class="brand">
        <img class="logo-img" src="${esc(assetUrl("/images/RRA_LOGO.png"))}" alt="RRA" />
        <img class="logo-img" src="${esc(assetUrl("/images/rraLogo2.png"))}" alt="RRA" />
      </div>
      <img class="logo-img" style="height:52px" src="${esc(assetUrl("/images/logoubumwe.png"))}" alt="Hotel" />
    </div>
    <div>
      <p class="tagline">Point of sale</p>
      <h1>Sale receipt</h1>
    </div>
    <div class="meta">
      <div><span class="muted">Sale #</span><span class="strong">${esc(payload.saleNumber)}</span></div>
      <div><span class="muted">Depot</span><span>${esc(payload.depotName)}</span></div>
      <div><span class="muted">Client</span><span>${esc(payload.customerName || "Walk-in")}</span></div>
      <div><span class="muted">Date</span><span>${esc(soldAtLabel)}</span></div>
    </div>
    <table class="lines">
      <colgroup>
        <col class="col-item" />
        <col class="col-qty" />
        <col class="col-unit" />
        <col class="col-line" />
      </colgroup>
      <thead>
        <tr>
          <th class="col-item">Item</th>
          <th class="col-qty">Qty</th>
          <th class="col-unit">Unit (${esc(currency)})</th>
          <th class="col-line">Line (${esc(currency)})</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="invoice-totals">
      <div class="row"><span class="muted">Subtotal (excl. VAT)</span><span>${esc(subtotalExclVat.toFixed(2))}</span></div>
      <div class="row"><span class="muted">VAT ${esc(String(vatPercent))}%</span><span>${esc(vatTotal.toFixed(2))}</span></div>
      <div class="row grand"><span>Total (incl. VAT)</span><span>${esc(totalIncl.toFixed(2))}</span></div>
      <p class="note">Line amounts are VAT-inclusive. VAT ${esc(String(vatPercent))}% is shown on taxable items only; non-taxable lines use 0%.</p>
    </div>
    <div class="foot">
      Thank you for your purchase. To save a PDF, use your browser <strong>Print</strong> dialog and choose <strong>Save as PDF</strong>.
    </div>
  </div>
</body></html>`;
}

/** Print via hidden iframe — works after `await fetch`, unlike `window.open` (often blocked). */
export function printDepotSaleInvoice(payload: DepotSalePrintPayload, currency = "FRW"): void {
  if (typeof document === "undefined") return;
  const html = buildDepotSaleInvoiceHtml(payload, currency);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.title = "Print receipt";
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const w = iframe.contentWindow;
  const d = iframe.contentDocument ?? w?.document ?? null;

  const cleanup = () => {
    iframe.remove();
  };

  try {
    if (!w || !d) {
      const win = window.open("", "_blank");
      if (!win) return;
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
      return;
    }
    d.open();
    d.write(html);
    d.close();
    /** Short delay lets layout settle before print in Chromium / WebKit */
    window.setTimeout(() => {
      try {
        w.focus();
        w.print();
      } finally {
        window.setTimeout(cleanup, 2000);
      }
    }, 120);
  } catch {
    cleanup();
  }
}
