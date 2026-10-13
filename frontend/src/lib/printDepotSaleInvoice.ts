/** 80mm Epson thermal POS invoice (RRA / EBM SDC layout). */

import { tryDirectThermalPrint } from "@/lib/directThermalPrint";
import { encodeEscPosInvoice } from "@/lib/escposReceipt";
import { buildRraLogoHtml, hasEbmFiscalAck } from "@/lib/ebmPrint";
import { qrSvgMarkup } from "@/lib/qrSvg";

export type DepotSaleLine = {
  productName: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** When true, line total is treated as VAT-inclusive at `vatPercent` (default 18%). */
  taxable?: boolean;
};

export const CIS_VERSION = "HotelERP 1.0.0";

export type DepotSalePrintPayload = {
  saleId: string;
  saleNumber: string;
  documentTitle?: "INVOICE" | "PROFORMA" | "DELIVERY" | "REFUND" | "COPY" | "TRAINING";
  /** Reprint of an existing NS/NR — prints CS/CR + COPY watermark. */
  isCopy?: boolean;
  /** Training mode (Settings → EBM) — prints TS/TR and is not a fiscal original. */
  trainingMode?: boolean;
  depotName: string;
  customerName: string | null;
  customerTin?: string | null;
  customerPhone?: string | null;
  totalAmount: number;
  /** Cart total before promotion discount (VAT-inclusive). */
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
  paymentCurrency?: string | null;
  exchangeRate?: number | null;
  foreignAmount?: number | null;
  baseCurrency?: string | null;
  soldAt: string;
  lines: DepotSaleLine[];
  /** VAT rate for extraction from VAT-inclusive line totals (Rwanda default 18). */
  vatPercent?: number;
  /** Payment method shown on invoice (e.g. MOMO, CASH, CREDIT CARD, BANK). */
  paymentMethod?: string | null;
  issuerName?: string | null;
  issuerTin?: string | null;
  issuerPhone?: string | null;
  issuerEmail?: string | null;
  issuerAddress?: string | null;
  issuerLogoUrl?: string | null;
  /** Show RRA logos when hotel EBM is activated. */
  ebmActivated?: boolean;
  /** EBM fiscal fields from VSDC/OSDC ACK (when available). */
  ebmReceiptNo?: string | null;
  ebmSignature?: string | null;
  ebmInternalData?: string | null;
  ebmInvoiceNo?: string | null;
  ebmQrPayload?: string | null;
  ebmSdcId?: string | null;
  ebmMrcNo?: string | null;
  ebmStatus?: string | null;
  ebmDate?: string | null;
};

export function issuerFieldsFromHotel(hotel: {
  name?: string | null;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  tinNumber?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}): Pick<
  DepotSalePrintPayload,
  "issuerName" | "issuerTin" | "issuerPhone" | "issuerEmail" | "issuerAddress" | "issuerLogoUrl"
> {
  return {
    issuerName: (hotel.companyName || hotel.name || "").trim() || null,
    issuerTin: hotel.tinNumber?.trim() || null,
    issuerPhone: hotel.phone?.trim() || null,
    issuerEmail: hotel.email?.trim() || null,
    issuerAddress: hotel.address?.trim() || null,
    issuerLogoUrl: hotel.logoUrl?.trim() || null,
  };
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function money(n: number): string {
  return round2(n).toFixed(1);
}

function money2(n: number): string {
  return round2(n).toFixed(2);
}

/** Split VAT-inclusive gross into net + VAT (per line, 2 dp). */
function splitInclusiveVat(gross: number, taxable: boolean, vatPercent: number): { net: number; vat: number } {
  const g = round2(gross);
  if (!taxable || vatPercent <= 0) return { net: g, vat: 0 };
  const net = round2(g / (1 + vatPercent / 100));
  const vat = round2(g - net);
  return { net, vat };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseWhen(iso: string | null | undefined): Date {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
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

function kv(label: string, value: string): string {
  return `<pre class="mono">${esc(fitLine(label, value))}</pre>`;
}

export function buildDepotSaleInvoiceHtml(payload: DepotSalePrintPayload, currency = "RWF"): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const assetUrl = (path: string) => `${origin}${path.startsWith("/") ? path : `/${path}`}`;
  const vatPercent = payload.vatPercent ?? 18;
  const documentTitle = payload.documentTitle ?? "INVOICE";
  const isRefund = documentTitle === "REFUND";
  const isCopy = Boolean(payload.isCopy) || documentTitle === "COPY";
  const isTraining = Boolean(payload.trainingMode) || documentTitle === "TRAINING";
  const isProforma = documentTitle === "PROFORMA" || documentTitle === "DELIVERY";
  const unofficial = isCopy || isTraining || isProforma;
  const sign = isRefund ? -1 : 1;
  const signed = (n: number) => (sign < 0 ? `-${money(Math.abs(n))}` : money(n));
  const signed2 = (n: number) => (sign < 0 ? `-${money2(Math.abs(n))}` : money2(n));
  const baseCurrency = (payload.baseCurrency || currency || "RWF").trim().toUpperCase();
  const payCurrency = payload.paymentCurrency?.trim().toUpperCase() || "";
  const exchangeRate = round2(Number(payload.exchangeRate ?? 0));
  const foreignAmount = round2(Number(payload.foreignAmount ?? 0));
  const showFx = Boolean(payCurrency && foreignAmount > 0 && exchangeRate > 0 && payCurrency !== baseCurrency);
  const issuerName = payload.issuerName?.trim() || payload.depotName || "Hotel";
  const issuerLogo = payload.issuerLogoUrl?.trim() || assetUrl("/images/kivu-cloud-mark.png");
  const when = parseWhen(payload.ebmDate || payload.soldAt);
  const printed = new Date();
  const dateLabel = fmtDate(when);
  const timeLabel = fmtTime(when);
  const printDate = fmtDate(printed);
  const printTime = fmtTime(printed);
  const paymentLabel = (payload.paymentMethod || "CASH").trim().toUpperCase();
  const receiptNo = payload.ebmReceiptNo?.trim() || payload.saleNumber;
  const receiptKind = isTraining
    ? isRefund
      ? "TR"
      : "TS"
    : isCopy
      ? isRefund
        ? "CR"
        : "CS"
      : isProforma
        ? "PS"
        : isRefund
          ? "NR"
          : "NS";
  const typeLabel =
    documentTitle === "DELIVERY"
      ? "DELIVERY"
      : isTraining
        ? "TRAINING"
        : isCopy
          ? "COPY"
          : documentTitle === "PROFORMA"
            ? "PROFORMA"
            : isRefund
              ? "REFUND"
              : "INVOICE";

  const headerParts = [issuerName];
  if (payload.issuerAddress?.trim()) {
    headerParts.push(
      ...payload.issuerAddress
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  if (payload.issuerPhone?.trim()) headerParts.push(`Tel: ${payload.issuerPhone.trim()}`);
  if (payload.issuerEmail?.trim()) headerParts.push(payload.issuerEmail.trim());
  while (headerParts.length < 3) headerParts.push("Rwanda");
  const headerHtml = headerParts
    .slice(0, 6)
    .map((line, i) => `<div class="center${i === 0 ? " bold" : ""}">${esc(line)}</div>`)
    .join("");

  let totalAex = 0;
  let totalBexcl = 0;
  let totalTaxB = 0;
  const itemRows = payload.lines
    .map((ln) => {
      const taxable = ln.taxable !== false;
      const { net, vat } = splitInclusiveVat(Number(ln.lineTotal), taxable, vatPercent);
      if (taxable) {
        totalBexcl += net;
        totalTaxB += vat;
      } else {
        totalAex += Number(ln.lineTotal) || 0;
      }
      const letter = taxable ? "B" : "A";
      const qty = Number(ln.quantity);
      const unit = Number(ln.unitPrice);
      return `
      <pre class="mono">${esc(ln.productName)}</pre>
      <pre class="mono amt">${esc(fitLine(`${signed(unit)} x ${qty}`, `${signed(Number(ln.lineTotal))}${letter}`))}</pre>`;
    })
    .join("");

  totalAex = round2(totalAex);
  totalBexcl = round2(totalBexcl);
  totalTaxB = round2(totalTaxB);
  const totalIncl = round2(Number(payload.totalAmount));
  const discountAmount = round2(Math.max(0, Number(payload.discountAmount ?? 0)));
  const promoCode = payload.promoCode?.trim() || "";
  const totalTax = round2(totalTaxB);
  const fiscal = hasEbmFiscalAck(payload) && !unofficial;
  const vatLabel = `TOTAL B-${vatPercent.toFixed(2)}%`;
  const unofficialBanner = unofficial
    ? `<div class="center bold">THIS IS NOT AN OFFICIAL RECEIPT</div>`
    : "";

  const sdcHtml = fiscal
    ? `
    <div class="center bold sdc-title">SDC INFORMATION</div>
    ${kv("Date:", dateLabel)}
    ${kv("Time :", timeLabel)}
    ${kv("SDC ID:", payload.ebmSdcId || "—")}
    ${kv("RECEIPT NUMBER:", `${receiptNo} ${receiptKind}`)}
    <div class="center bold">Internal Data:</div>
    <div class="center wrap">${esc(payload.ebmInternalData || "—")}</div>
    <div class="center bold">Receipt Signature:</div>
    <div class="center wrap">${esc(payload.ebmSignature || "—")}</div>
    ${
      payload.ebmQrPayload?.trim()
        ? `<div class="qr">${qrSvgMarkup(payload.ebmQrPayload.trim(), 160)}</div>`
        : ""
    }
    ${kv("RECEIPT NUMBER:", `${receiptNo} ${receiptKind}`)}
    ${kv("Date:", printDate)}
    ${kv("Time :", printTime)}
    ${kv("MRC:", payload.ebmMrcNo || "—")}
    ${kv("CIS VER:", CIS_VERSION)}`
    : `${payload.ebmStatus ? `<div class="center muted">EBM status: ${esc(payload.ebmStatus)}</div>` : ""}
    ${kv("CIS VER:", CIS_VERSION)}
    ${unofficial ? unofficialBanner : ""}`;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(documentTitle)} ${esc(payload.saleNumber)}</title>
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
    line-height: 1.25;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket, .ticket * { font-weight: 700; color: #000; }
  .ticket { width: 68mm; margin: 0 auto; }
  .center { text-align: center; word-break: break-word; }
  pre.mono {
    margin: 0;
    font-family: "Courier New", Courier, monospace;
    font-size: 12px;
    font-weight: 700;
    white-space: pre;
    line-height: 1.25;
  }
  pre.amt, pre.total { font-weight: 900; }
  .bold { font-weight: 700; }
  .muted { font-size: 11px; }
  .wrap { word-break: break-all; font-size: 11px; margin: 2px 0 6px; }
  .logo-wrap { text-align: center; margin: 0 0 1mm; line-height: 0; }
  .company-logo {
    display: inline-block;
    height: 9mm;
    max-height: 9mm;
    width: auto;
    max-width: 22mm;
    object-fit: contain;
  }
  .logos {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    margin: 0 0 1mm;
  }
  .logos img, .logo-img { height: 6mm; max-height: 6mm; width: auto; object-fit: contain; }
  .brand { display: flex; align-items: center; gap: 3px; }
  .doc-title {
    text-align: center;
    font-family: "Arial Black", Arial, Helvetica, sans-serif;
    font-weight: 900;
    font-size: 18px;
    letter-spacing: 0.12em;
    line-height: 1.1;
    margin: 2mm 0 1mm;
    color: #000;
    text-shadow: 0.45px 0 #000, -0.45px 0 #000, 0 0.45px #000, 0 -0.45px #000;
  }
  .item-name { margin-top: 6px; font-weight: 700; }
  .sep { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .sdc-title { margin: 8px 0 4px; }
  .qr { text-align: center; margin: 8px 0; }
  .qr img { width: 38mm; height: 38mm; }
  h1 { font-size: 13px; margin: 4px 0 2px; letter-spacing: 0.04em; }
</style></head><body>
  <div class="ticket">
    <div class="logo-wrap">
      <img class="company-logo" src="${esc(issuerLogo)}" alt="${esc(issuerName)}" />
    </div>
    ${buildRraLogoHtml(assetUrl, Boolean(payload.ebmActivated)) ? `<div class="logos">${buildRraLogoHtml(assetUrl, Boolean(payload.ebmActivated))}</div>` : ""}
    ${headerHtml}
    ${payload.issuerTin ? kv("TIN", payload.issuerTin) : ""}
    <hr class="sep" />
    ${kv("Client Name:", payload.customerName?.trim() || "Walk-in")}
    ${kv("Client TIN:", payload.customerTin?.trim() || "None")}
    ${
      payload.customerPhone?.trim() &&
      payload.customerPhone.trim() !== (payload.issuerPhone?.trim() || "")
        ? kv("Phone No:", payload.customerPhone.trim())
        : ""
    }
    ${kv("Date:", `${dateLabel} ${timeLabel}`)}
    <div class="doc-title">${esc(typeLabel)}</div>
    <div class="center bold">${esc(receiptKind)}</div>
    ${unofficialBanner}
    ${itemRows || `<div class="center">No items</div>`}
    <hr class="sep" />
    <pre class="mono total">${esc(fitLine("TOTAL", signed(totalIncl)))}</pre>
    ${totalAex > 0 ? kv("TOTAL A-EX:", signed2(totalAex)) : ""}
    ${kv(vatLabel, signed2(totalBexcl))}
    ${kv("TOTAL TAX B:", signed2(totalTaxB))}
    ${kv("TOTAL TAX:", signed2(totalTax))}
    ${
      discountAmount > 0
        ? kv(`DISCOUNT${promoCode ? ` ${promoCode}` : ""}`, `-${money2(discountAmount)}`)
        : ""
    }
    ${kv(paymentLabel, signed(showFx ? foreignAmount : totalIncl))}
    ${kv("ITEMS NUMBER:", String(payload.lines.length))}
    ${showFx ? kv(`${payCurrency} @ ${money2(exchangeRate)} ${baseCurrency}`, signed2(foreignAmount)) : ""}
    <hr class="sep" />
    ${sdcHtml}
    ${unofficial ? unofficialBanner : ""}
  </div>
</body></html>`;
}

function printHtmlViaIframe(html: string): void {
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
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        w.focus();
        w.print();
      } finally {
        window.setTimeout(cleanup, 1500);
      }
    };
    const imgs = Array.from(d.images);
    if (imgs.length === 0) {
      window.setTimeout(triggerPrint, 60);
    } else {
      let pending = imgs.length;
      const done = () => {
        pending -= 1;
        if (pending <= 0) window.setTimeout(triggerPrint, 40);
      };
      for (const img of imgs) {
        if (img.complete) done();
        else {
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }
      }
      window.setTimeout(triggerPrint, 700);
    }
  } catch {
    cleanup();
  }
}

/** Small monochrome raster (GS v 0) so the logo stays a short strip on 80mm paper. */
async function smallLogoRaster(url: string): Promise<number[] | null> {
  const img = new Image();
  img.decoding = "async";
  if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!loaded || !img.naturalWidth) return null;
  const maxW = 160;
  const maxH = 64;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = Math.max(8, Math.round(img.naturalWidth * scale));
  const h = Math.max(8, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  let pixels: Uint8ClampedArray;
  try {
    pixels = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  const widthBytes = Math.ceil(w / 8);
  const raster: number[] = [
    0x1d,
    0x76,
    0x30,
    0x00,
    widthBytes & 0xff,
    (widthBytes >> 8) & 0xff,
    h & 0xff,
    (h >> 8) & 0xff,
  ];
  for (let y = 0; y < h; y++) {
    for (let xb = 0; xb < widthBytes; xb++) {
      let bite = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xb * 8 + bit;
        if (x >= w) continue;
        const i = (y * w + x) * 4;
        const lum = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
        if (pixels[i + 3] > 40 && lum < 170) bite |= 0x80 >> bit;
      }
      raster.push(bite);
    }
  }
  return raster;
}

/** Prefers USB receipt printer; falls back to the browser print dialog. */
export function printDepotSaleInvoice(payload: DepotSalePrintPayload, currency = "FRW"): void {
  if (typeof document === "undefined") return;
  const html = buildDepotSaleInvoiceHtml(payload, currency);
  const logoUrl = payload.issuerLogoUrl?.trim() || "";
  void (async () => {
    let logoRaster: number[] | null = null;
    if (logoUrl) {
      try {
        logoRaster = await Promise.race([
          smallLogoRaster(logoUrl),
          new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 800)),
        ]);
      } catch {
        logoRaster = null;
      }
    }
    const bytes = encodeEscPosInvoice({
      title: payload.documentTitle || "INVOICE",
      issuerName: payload.issuerName,
      issuerTin: payload.issuerTin,
      issuerPhone: payload.issuerPhone,
      issuerAddress: payload.issuerAddress,
      customerName: payload.customerName,
      customerTin: payload.customerTin,
      saleNumber: payload.saleNumber,
      soldAt: payload.soldAt,
      paymentMethod: payload.paymentMethod,
      lines: payload.lines.map((ln) => ({
        productName: ln.productName,
        quantity: ln.quantity,
        unitPrice: ln.unitPrice,
        lineTotal: ln.lineTotal,
      })),
      totalAmount: payload.totalAmount,
      subtotalAmount: payload.subtotalAmount,
      discountAmount: payload.discountAmount,
      promoCode: payload.promoCode,
      ebmReceiptNo: payload.ebmReceiptNo,
      ebmSignature: payload.ebmSignature,
      ebmInternalData: payload.ebmInternalData,
      ebmQrPayload: payload.ebmQrPayload,
      ebmMrcNo: payload.ebmMrcNo,
      logoRaster,
    });
    const ok = await tryDirectThermalPrint(bytes);
    if (!ok) printHtmlViaIframe(html);
  })();
}
