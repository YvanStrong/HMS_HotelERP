/** ESC/POS bytes for 80mm Epson TM USB printers. */

const ENC = new TextEncoder();
const W = 42;

function push(out: number[], ...bytes: number[]) {
  out.push(...bytes);
}

function textBytes(s: string): number[] {
  const normalized = s.replace(/[^\x09\x0a\x0d\x20-\x7e]/g, (ch) => {
    const map: Record<string, string> = {
      "’": "'",
      "‘": "'",
      "“": '"',
      "”": '"',
      "–": "-",
      "—": "-",
      "€": "EUR",
      "°": " ",
    };
    return map[ch] ?? "?";
  });
  return Array.from(ENC.encode(normalized));
}

function padLine(left: string, right: string, width = W): string {
  const l = left.slice(0, Math.max(0, width - right.length - 1));
  const spaces = Math.max(1, width - l.length - right.length);
  return `${l}${" ".repeat(spaces)}${right}`;
}

function money(n: number): string {
  return Math.round(Number.isFinite(n) ? n : 0).toString();
}

function money2(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function boldTitle(title: string): string {
  const t = title.trim().toUpperCase();
  if (t === "DELIVERY" || t === "DELIVERIES") return "DELIVERY";
  if (t === "INVOICE" || t === "") return "INVOICE";
  return t.slice(0, 16);
}

export type EscPosInvoiceInput = {
  title: string;
  issuerName?: string | null;
  issuerTin?: string | null;
  issuerPhone?: string | null;
  issuerAddress?: string | null;
  customerName?: string | null;
  customerTin?: string | null;
  saleNumber: string;
  soldAt?: string | null;
  paymentMethod?: string | null;
  lines: { productName: string; quantity: number; unitPrice: number; lineTotal: number }[];
  totalAmount: number;
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
  ebmReceiptNo?: string | null;
  ebmSignature?: string | null;
  ebmInternalData?: string | null;
  ebmQrPayload?: string | null;
  ebmMrcNo?: string | null;
  /** Prebuilt GS v 0 raster, already including the command header. Kept short so the logo does not eat the roll. */
  logoRaster?: number[] | null;
};

export function encodeEscPosInvoice(input: EscPosInvoiceInput): Uint8Array {
  const out: number[] = [];
  push(out, 0x1b, 0x40); // init
  push(out, 0x1b, 0x74, 0x00); // PC437
  push(out, 0x1b, 0x61, 0x01); // center
  if (input.logoRaster && input.logoRaster.length > 0) {
    push(out, ...input.logoRaster);
    push(out, 0x0a);
  }
  push(out, 0x1b, 0x45, 0x01); // bold on
  push(out, 0x1b, 0x21, 0x08); // emphasized
  push(out, ...textBytes(`${input.issuerName?.trim() || "Hotel"}\n`));
  push(out, 0x1b, 0x21, 0x00);
  push(out, 0x1d, 0x21, 0x11); // double width and height
  push(out, ...textBytes(`${boldTitle(input.title)}\n`));
  push(out, 0x1d, 0x21, 0x00);
  push(out, 0x1b, 0x45, 0x00);
  push(out, ...textBytes(`${input.saleNumber}\n`));
  push(out, 0x1b, 0x61, 0x00);
  push(out, ...textBytes(`${"-".repeat(W)}\n`));
  if (input.issuerTin) push(out, ...textBytes(padLine("TIN", input.issuerTin) + "\n"));
  if (input.issuerPhone) push(out, ...textBytes(padLine("Phone", input.issuerPhone) + "\n"));
  if (input.issuerAddress) push(out, ...textBytes(`${input.issuerAddress.trim().slice(0, W)}\n`));
  push(out, ...textBytes(padLine("Client", (input.customerName || "Walk-in").slice(0, 24)) + "\n"));
  push(out, ...textBytes(padLine("Client TIN", input.customerTin?.trim() || "None") + "\n"));
  if (input.soldAt) {
    const d = new Date(input.soldAt);
    if (!Number.isNaN(d.getTime())) {
      push(out, ...textBytes(padLine("Date", d.toLocaleString("en-GB")) + "\n"));
    }
  }
  push(out, ...textBytes(`${"-".repeat(W)}\n`));
  for (const ln of input.lines) {
    const name = (ln.productName || "Item").slice(0, W);
    push(out, ...textBytes(`${name}\n`));
    push(
      out,
      ...textBytes(
        padLine(`  ${ln.quantity} x ${money2(ln.unitPrice)}`, money(ln.lineTotal)) + "\n",
      ),
    );
  }
  push(out, ...textBytes(`${"-".repeat(W)}\n`));
  const discount = Number(input.discountAmount ?? 0);
  if (discount > 0) {
    push(
      out,
      ...textBytes(padLine(`DISCOUNT${input.promoCode ? ` ${input.promoCode}` : ""}`, `-${money(discount)}`) + "\n"),
    );
  }
  push(out, 0x1b, 0x21, 0x08);
  push(out, ...textBytes(padLine("TOTAL", money(input.totalAmount)) + "\n"));
  push(out, 0x1b, 0x21, 0x00);
  if (input.paymentMethod) {
    push(out, ...textBytes(padLine("Payment", input.paymentMethod) + "\n"));
  }
  push(out, ...textBytes(padLine("ITEMS", String(input.lines.length)) + "\n"));
  if (input.ebmReceiptNo) push(out, ...textBytes(padLine("Receipt", input.ebmReceiptNo) + "\n"));
  if (input.ebmMrcNo) push(out, ...textBytes(padLine("MRC", input.ebmMrcNo) + "\n"));
  if (input.ebmInternalData) {
    push(out, 0x1b, 0x61, 0x01);
    push(out, ...textBytes("Internal data\n"));
    push(out, ...textBytes(`${input.ebmInternalData.slice(0, 84)}\n`));
    push(out, 0x1b, 0x61, 0x00);
  }
  if (input.ebmQrPayload?.trim()) {
    appendQr(out, input.ebmQrPayload.trim());
  }
  push(out, 0x1b, 0x61, 0x01);
  push(out, ...textBytes("Thank you\n"));
  push(out, 0x1b, 0x61, 0x00);
  push(out, 0x0a, 0x0a, 0x0a);
  push(out, 0x1d, 0x56, 0x41, 0x10); // partial cut
  return new Uint8Array(out);
}

export type EscPosSlipInput = {
  companyName: string;
  phone?: string | null;
  tableLabel?: string | null;
  customerName?: string | null;
  outletName?: string | null;
  servedBy?: string | null;
  lines: { itemName: string; quantity: number; lineTotal: number }[];
  totalAmount: number;
};

export function encodeEscPosOrderSlip(input: EscPosSlipInput): Uint8Array {
  const out: number[] = [];
  push(out, 0x1b, 0x40);
  push(out, 0x1b, 0x61, 0x01);
  push(out, 0x1b, 0x21, 0x30);
  push(out, ...textBytes("COMMANDE / ORDER\n"));
  push(out, 0x1b, 0x21, 0x00);
  push(out, ...textBytes(`${input.companyName}\n`));
  if (input.phone) push(out, ...textBytes(`${input.phone}\n`));
  push(out, 0x1b, 0x61, 0x00);
  push(out, ...textBytes(`${"-".repeat(W)}\n`));
  for (const ln of input.lines) {
    push(out, ...textBytes(`${(ln.itemName || "Item").slice(0, W)}\n`));
    push(out, ...textBytes(padLine(`${ln.quantity} x`, money(ln.lineTotal)) + "\n"));
  }
  push(out, ...textBytes(`${"-".repeat(W)}\n`));
  push(out, 0x1b, 0x45, 0x01);
  push(out, 0x1d, 0x21, 0x11);
  push(out, ...textBytes(padLine("TOTAL", money(input.totalAmount), 21) + "\n"));
  push(out, 0x1d, 0x21, 0x00);
  push(out, 0x1b, 0x45, 0x00);
  if (input.tableLabel) push(out, ...textBytes(padLine("Table", input.tableLabel) + "\n"));
  if (input.outletName) push(out, ...textBytes(padLine("Outlet", input.outletName.slice(0, 24)) + "\n"));
  if (input.customerName) push(out, ...textBytes(padLine("Customer", input.customerName.slice(0, 24)) + "\n"));
  if (input.servedBy) push(out, ...textBytes(padLine("Served by", input.servedBy.slice(0, 24)) + "\n"));
  push(out, 0x0a, 0x0a, 0x0a);
  push(out, 0x1d, 0x56, 0x41, 0x10);
  return new Uint8Array(out);
}

function appendQr(out: number[], data: string) {
  const payload = Array.from(ENC.encode(data.slice(0, 256)));
  // Model 2
  push(out, 0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
  // Size
  push(out, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06);
  // Error correction M
  push(out, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31);
  const storeLen = payload.length + 3;
  push(out, 0x1d, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30, ...payload);
  push(out, 0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
  push(out, 0x0a);
}
