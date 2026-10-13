import { tryDirectThermalPrint } from "@/lib/directThermalPrint";
import { encodeEscPosOrderSlip } from "@/lib/escposReceipt";

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
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

const COLS = 32;

function fitLine(left: string, right: string): string {
  const r = right.replace(/\s+/g, " ").trim();
  const l = left.replace(/\s+/g, " ").trim();
  if (!r) return l;
  if (l.length + r.length + 1 <= COLS) {
    return l + " ".repeat(COLS - l.length - r.length) + r;
  }
  return `${l}\n${" ".repeat(Math.max(0, COLS - r.length))}${r}`;
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
      (ln) => `<pre class="mono">${esc(ln.itemName)}</pre>
<pre class="mono amt">${esc(fitLine(`${ln.quantity} x`, money(ln.lineTotal)))}</pre>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>COMMANDE / ORDER</title>
  <style>
    @page { size: 72mm auto; margin: 1mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 68mm;
      color: #000;
      background: #fff;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      font-weight: 700;
    }
    .center { text-align: center; word-break: break-word; }
    .bold { font-weight: 700; }
    .sep { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
    h1 { font-size: 14px; margin: 0 0 2px; }
    .sub { font-size: 11px; margin: 0; }
    pre.mono {
      margin: 0;
      font-family: "Courier New", Courier, monospace;
      font-size: 12px;
      font-weight: 700;
      white-space: pre;
      line-height: 1.25;
    }
    pre.amt, pre.total { font-weight: 900; }
  </style>
</head>
<body>
  <div class="center">
    <h1>${esc(company)}</h1>
    ${payload.phone ? `<p class="sub">Phone : ${esc(payload.phone)}</p>` : ""}
    ${payload.tin ? `<p class="sub">TIN: ${esc(payload.tin)}</p>` : ""}
  </div>
  <hr class="sep" />
  <div class="center">
    <p class="bold" style="margin:0;font-size:13px;">COMMANDE / ORDER</p>
    <p class="sub" style="margin:2px 0 0;">NOT OFFICIAL RECEIPT</p>
  </div>
  <hr class="sep" />
  <pre class="mono">${esc(fitLine("Item", "Total"))}</pre>
  ${rows || `<pre class="mono center">No items</pre>`}
  <hr class="sep" />
  <pre class="mono total">${esc(fitLine("TOTAL", money(payload.totalAmount)))}</pre>
  <hr class="sep" />
  <pre class="mono">${esc(fitLine("Table", table))}</pre>
  ${payload.outletName ? `<pre class="mono">${esc(fitLine("Outlet", payload.outletName))}</pre>` : ""}
  ${payload.customerName ? `<pre class="mono">${esc(fitLine("Customer", payload.customerName))}</pre>` : ""}
  <pre class="mono">${esc(fitLine("Served by", servedBy))}</pre>
  <p class="center bold" style="margin:8px 0;">*** THANKS ***</p>
  <pre class="mono">${esc(fitLine(dateLabel, timeLabel))}</pre>
  <p class="center stars">***************************</p>
  <p class="center footer">Powered by HMS HotelERP</p>
</body>
</html>`;
}

export function printPosOrderSlip(payload: PosOrderSlipPayload): void {
  const html = buildPosOrderSlipHtml(payload);
  const bytes = encodeEscPosOrderSlip({
    companyName: payload.companyName,
    phone: payload.phone,
    tableLabel: payload.tableLabel,
    customerName: payload.customerName,
    outletName: payload.outletName,
    servedBy: payload.servedBy,
    lines: payload.lines,
    totalAmount: payload.totalAmount,
  });
  void tryDirectThermalPrint(bytes).then((ok) => {
    if (!ok) printPosSlipIframe(html);
  });
}

function printPosSlipIframe(html: string): void {
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
