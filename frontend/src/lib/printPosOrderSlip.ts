/** Non-fiscal kitchen/service order slip (COMMANDE / ORDER). */

export type PosOrderSlipLine = {
  itemName: string;
  quantity: number;
  lineTotal: number;
};

export type PosOrderSlipPayload = {
  companyName: string;
  phone?: string | null;
  tin?: string | null;
  tableLabel?: string | null;
  customerName?: string | null;
  servedBy?: string | null;
  outletName?: string | null;
  lines: PosOrderSlipLine[];
  totalAmount: number;
  printedAt?: string | Date;
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return Math.round(v).toString();
}

export function buildPosOrderSlipHtml(payload: PosOrderSlipPayload): string {
  const when = payload.printedAt ? new Date(payload.printedAt) : new Date();
  const dateLabel = when.toLocaleDateString("en-GB");
  const timeLabel = when.toLocaleTimeString("en-GB", { hour12: false });
  const company = payload.companyName?.trim() || "Hotel";
  const table = payload.tableLabel?.trim() || "—";
  const servedBy = payload.servedBy?.trim() || "—";

  const rows = payload.lines
    .map(
      (ln) => `
    <tr>
      <td class="item">${esc(ln.itemName)}</td>
      <td class="qty">${esc(ln.quantity)}</td>
      <td class="amt">${esc(money(ln.lineTotal))}</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>COMMANDE / ORDER</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      color: #000;
      width: 72mm;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .sep { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    .stars { letter-spacing: 1px; margin: 6px 0; }
    h1 { font-size: 14px; margin: 0 0 2px; }
    .sub { font-size: 11px; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 2px 0; vertical-align: top; }
    th { font-size: 11px; text-align: left; border-bottom: 1px dashed #000; }
    td.item { width: 55%; }
    td.qty, th.qty { width: 15%; text-align: center; }
    td.amt, th.amt { width: 30%; text-align: right; }
    .meta { margin-top: 4px; }
    .footer { font-size: 10px; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="center">
    <h1>${esc(company)}</h1>
    <p class="sub">${esc(company)}</p>
    ${payload.phone ? `<p class="sub">Phone : ${esc(payload.phone)}</p>` : ""}
    ${payload.tin ? `<p class="sub">TIN: ${esc(payload.tin)}</p>` : ""}
  </div>
  <hr class="sep" />
  <div class="center">
    <p class="bold" style="margin:0;font-size:13px;">COMMANDE / ORDER</p>
    <p class="sub" style="margin:2px 0 0;">NOT OFFICIAL RECEIPT</p>
  </div>
  <hr class="sep" />
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th class="qty">Qty</th>
        <th class="amt">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="3" class="center">No items</td></tr>`}
    </tbody>
  </table>
  <hr class="sep" />
  <table>
    <tr>
      <td class="bold">TOTAL</td>
      <td class="amt bold">${esc(money(payload.totalAmount))}</td>
    </tr>
  </table>
  <hr class="sep" />
  <div class="meta">
    <div><span class="bold">Table:</span> ${esc(table)}</div>
    ${payload.outletName ? `<div>Outlet: ${esc(payload.outletName)}</div>` : ""}
    ${payload.customerName ? `<div>Customer: ${esc(payload.customerName)}</div>` : ""}
    <div>Served by: ${esc(servedBy)}</div>
  </div>
  <p class="center bold" style="margin:8px 0;">*** THANKS ***</p>
  <table class="footer">
    <tr>
      <td>${esc(dateLabel)}</td>
      <td class="right">${esc(timeLabel)}</td>
    </tr>
  </table>
  <p class="center stars">***************************</p>
  <p class="center footer">Powered by HMS HotelERP</p>
</body>
</html>`;
}

export function printPosOrderSlip(payload: PosOrderSlipPayload): void {
  const html = buildPosOrderSlipHtml(payload);
  const iframe = document.createElement("iframe");
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
