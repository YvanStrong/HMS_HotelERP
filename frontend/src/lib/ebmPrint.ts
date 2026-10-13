import { loadEbmSaleEventBySource, loadEbmStatus, type EbmSaleEventRow } from "@/lib/ebmApi";
import { qrSvgMarkup } from "@/lib/qrSvg";

export type EbmFiscalPrintFields = {
  /** Hotel EBM feature + at least one active/registered device. */
  ebmActivated: boolean;
  trainingMode?: boolean;
  ebmReceiptNo?: string | null;
  ebmSignature?: string | null;
  ebmInternalData?: string | null;
  ebmInvoiceNo?: string | null;
  ebmQrPayload?: string | null;
  ebmSdcId?: string | null;
  ebmMrcNo?: string | null;
  ebmStatus?: string | null;
  /** Fiscalization / ACK timestamp when known. */
  ebmDate?: string | null;
};

export function hasEbmFiscalAck(f: Partial<EbmFiscalPrintFields> | null | undefined): boolean {
  if (!f) return false;
  return Boolean(
    f.ebmReceiptNo ||
      f.ebmSdcId ||
      f.ebmMrcNo ||
      f.ebmQrPayload ||
      f.ebmSignature ||
      f.ebmInternalData ||
      f.ebmInvoiceNo,
  );
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatEbmDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return iso;
  }
}

/** RRA logos only when EBM is activated for the hotel. */
export function buildRraLogoHtml(assetUrl: (path: string) => string, ebmActivated: boolean): string {
  if (!ebmActivated) return "";
  return `<div class="brand rra-brand">
        <img class="logo-img" src="${esc(assetUrl("/images/RRA_LOGO.png"))}" alt="RRA" />
        <img class="logo-img" src="${esc(assetUrl("/images/rraLogo2.png"))}" alt="RRA" />
      </div>`;
}

/**
 * SDC INFORMATION + QR block (end of invoice/refund), shown only after EBM ACK data exists.
 */
export function buildSdcInformationHtml(
  f: Partial<EbmFiscalPrintFields>,
  opts?: { invoiceNumberFallback?: string | null; serviceCount?: number },
): string {
  if (!hasEbmFiscalAck(f)) {
    if (f.ebmStatus) {
      return `<p class="sdc-pending">EBM fiscalization status: ${esc(f.ebmStatus)} (SDC details appear after VSDC acknowledgement).</p>`;
    }
    return "";
  }

  const printedAt = formatEbmDate(new Date().toISOString());
  const fiscalDate = formatEbmDate(f.ebmDate) !== "—" ? formatEbmDate(f.ebmDate) : printedAt;
  const invoiceNo = f.ebmInvoiceNo?.trim() || opts?.invoiceNumberFallback?.trim() || "—";
  const services =
    opts?.serviceCount != null && Number.isFinite(opts.serviceCount) ? String(opts.serviceCount) : "";

  const qr = f.ebmQrPayload?.trim()
    ? `<div class="sdc-qr">${qrSvgMarkup(f.ebmQrPayload.trim(), 140)}</div>`
    : "";

  return `<div class="sdc-block">
  <div class="sdc-grid">
    <div class="sdc-info">
      <h3 class="sdc-title">SDC INFORMATION</h3>
      <div class="sdc-row"><span class="sdc-label">Date:</span><span>${esc(fiscalDate)}</span></div>
      <div class="sdc-row"><span class="sdc-label">SDC ID:</span><span>${esc(f.ebmSdcId || "—")}</span></div>
      <div class="sdc-row"><span class="sdc-label">SDC Receipt Number:</span><span>${esc(f.ebmReceiptNo || "—")}</span></div>
      <div class="sdc-row"><span class="sdc-label">Invoice Number:</span><span>${esc(invoiceNo)}</span></div>
      <div class="sdc-row"><span class="sdc-label">Internal Data:</span><span class="sdc-mono">${esc(f.ebmInternalData || "—")}</span></div>
      <div class="sdc-row"><span class="sdc-label">Receipt Signature:</span><span class="sdc-mono">${esc(f.ebmSignature || "—")}</span></div>
      <div class="sdc-row"><span class="sdc-label">Date Time of Printing:</span><span>${esc(printedAt)}</span></div>
      <div class="sdc-row"><span class="sdc-label">MRC:</span><span>${esc(f.ebmMrcNo || "—")}</span></div>
    </div>
    <div class="sdc-aside">
      ${services ? `<div class="sdc-services">Number of Services Billed: <strong>${esc(services)}</strong></div>` : ""}
      ${qr}
    </div>
  </div>
</div>`;
}

export const SDC_PRINT_CSS = `
  .sdc-block {
    margin-top: 22px;
    padding-top: 14px;
    border-top: 1px solid #d9cfc4;
    font-size: 12px;
  }
  .sdc-title {
    margin: 0 0 10px;
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1a3a5c;
  }
  .sdc-grid {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    flex-wrap: wrap;
  }
  .sdc-info { flex: 1 1 280px; min-width: 0; }
  .sdc-aside { flex: 0 0 auto; text-align: right; }
  .sdc-row {
    display: grid;
    grid-template-columns: minmax(140px, 42%) 1fr;
    gap: 8px 12px;
    padding: 3px 0;
    align-items: start;
  }
  .sdc-label { color: #7a6a62; font-weight: 600; }
  .sdc-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    word-break: break-all;
  }
  .sdc-services { margin-bottom: 10px; font-size: 12px; color: #2b211c; }
  .sdc-qr img { display: block; margin-left: auto; }
  .sdc-pending {
    margin-top: 14px;
    font-size: 11px;
    color: #7a6a62;
  }
  .rra-brand { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
`;

export function fiscalFromSaleEvent(ev: EbmSaleEventRow): Omit<EbmFiscalPrintFields, "ebmActivated"> {
  return {
    ebmReceiptNo: ev.ebmReceiptNo,
    ebmSignature: ev.ebmSignature,
    ebmInternalData: ev.ebmInternalData,
    ebmInvoiceNo: ev.ebmInvoiceNo,
    ebmQrPayload: ev.ebmQrPayload,
    ebmSdcId: ev.ebmSdcId,
    ebmMrcNo: ev.ebmMrcNo,
    ebmStatus: ev.ebmStatus,
    ebmDate: ev.createdAt,
  };
}

/** Load hotel EBM activation + optional sale-event fiscal fields for print. */
export async function resolveEbmPrintFields(
  hotelId: string,
  sourceType?: string | null,
  sourceId?: string | null,
  opts?: { waitMs?: number },
): Promise<EbmFiscalPrintFields> {
  let ebmActivated = false;
  let trainingMode = false;
  try {
    const status = await loadEbmStatus(hotelId);
    ebmActivated =
      Boolean(status.ebmEnabled) &&
      (status.devices ?? []).some((d) => (d.status || "").toUpperCase() === "ACTIVE");
    // Enabled + any device registered still shows RRA branding (pending init)
    if (!ebmActivated && status.ebmEnabled && (status.devices?.length ?? 0) > 0) {
      ebmActivated = true;
    }
    trainingMode = Boolean(status.trainingMode) || (status.devices ?? []).some((d) => d.trainingMode);
  } catch {
    ebmActivated = false;
  }

  if (!sourceType || !sourceId) {
    return { ebmActivated, trainingMode };
  }

  // Training / non-EBM receipts must print immediately — do not sleep.
  if (!ebmActivated || trainingMode) {
    try {
      const ev = await loadEbmSaleEventBySource(hotelId, sourceType, sourceId);
      return { ebmActivated, trainingMode, ...fiscalFromSaleEvent(ev) };
    } catch {
      return { ebmActivated, trainingMode };
    }
  }

  const deadline = Date.now() + Math.max(0, opts?.waitMs ?? 1200);
  let last: EbmFiscalPrintFields = { ebmActivated, trainingMode };
  do {
    try {
      const ev = await loadEbmSaleEventBySource(hotelId, sourceType, sourceId);
      last = { ebmActivated, trainingMode, ...fiscalFromSaleEvent(ev) };
      if (hasEbmFiscalAck(last) || (last.ebmStatus || "").toUpperCase() === "FAILED") {
        return last;
      }
    } catch {
      /* sale event may not exist yet */
    }
    if (Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 120));
  } while (Date.now() < deadline);
  return last;
}
