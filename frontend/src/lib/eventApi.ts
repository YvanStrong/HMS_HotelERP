import { apiFetch } from "@/lib/api";

export type VenueOption = { id: string; name: string; code: string };
export type DepotProductOption = {
  id: string;
  productName: string;
  productCode: string;
  sellingPrice: number | string;
  taxable: boolean;
};
export type CateringPackage = {
  id: string;
  packageName: string;
  description?: string | null;
  packageType: string;
  pricePerPax: number | string;
  taxable: boolean;
  active: boolean;
};
export type CateringLine = {
  id: string;
  cateringPackageId?: string | null;
  cateringPackageName?: string | null;
  depotProductId?: string | null;
  depotProductCode?: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  taxable: boolean;
};
export type QuoteLine = {
  id: string;
  lineType: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  lineTotal: number | string;
  taxable: boolean;
  chargeReferenceId?: string | null;
};
export type Quote = {
  id: string;
  eventId: string;
  groupId: string;
  status: string;
  subtotal: number | string;
  taxAmount: number | string;
  discountAmount: number | string;
  totalAmount: number | string;
  depositRequired: number | string;
  depositPaid: boolean;
  validUntil?: string | null;
  internalNotes?: string | null;
  clientNotes?: string | null;
  chargesPostedAt?: string | null;
  chargesReversedAt?: string | null;
  lines: QuoteLine[];
};
export type EventListItem = {
  event: {
    id: string;
    eventName: string;
    eventType: string;
    status: string;
    startDatetime: string;
    endDatetime: string;
    venueName?: string | null;
    expectedPax?: number | null;
    guaranteedPax?: number | null;
  };
  quoteStatus?: string | null;
  beoStatus?: string | null;
  quoteId?: string | null;
  beoId?: string | null;
};
export type EventBillingSummary = {
  groupId: string;
  totalQuoted: number | string;
  totalAccepted: number | string;
  totalPosted: number | string;
  depositCollected: number | string;
  outstandingBalance: number | string;
  events: Array<{
    eventId: string;
    eventName: string;
    quoteStatus: string;
    totalAmount: number | string;
    depositPaid: boolean;
    chargesPosted: boolean;
    chargesPostedAt?: string | null;
  }>;
};

export function eventBase(hotelId: string, groupId: string) {
  return `/api/v1/hotels/${hotelId}/groups/${groupId}/events`;
}

export function loadVenues(hotelId: string) {
  return apiFetch<VenueOption[]>(`/api/v1/hotels/${hotelId}/groups/venues`, { quiet: true });
}

export function loadDepotProducts(hotelId: string) {
  return apiFetch<DepotProductOption[]>(`/api/v1/hotels/${hotelId}/groups/depot-products`, { quiet: true });
}

export function loadCateringPackages(hotelId: string) {
  return apiFetch<CateringPackage[]>(`/api/v1/hotels/${hotelId}/catering-packages`, { quiet: true });
}

export function money(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type EventBillingDocumentRow = {
  id: string;
  documentNumber: string;
  documentType: "PROFORMA" | "DELIVERY" | "INVOICE";
  eventId: string;
  eventName: string;
  groupName: string;
  contactPerson?: string | null;
  totalAmount: number | string;
  amountPaid: number | string;
  balanceDue: number | string;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

export function eventBillingDocumentLabel(type: EventBillingDocumentRow["documentType"]): string {
  switch (type) {
    case "INVOICE":
      return "Event invoice";
    case "PROFORMA":
      return "Event proforma";
    case "DELIVERY":
      return "Event delivery note";
    default:
      return "Event billing";
  }
}

export function loadEventBillingDocuments(hotelId: string) {
  return apiFetch<EventBillingDocumentRow[]>(`/api/v1/hotels/${hotelId}/event-billing-documents`);
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      return star[1].trim();
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain?.[1]?.trim() ?? null;
}

/** Download event billing PDF (proforma / delivery / invoice) for a contracted function. */
export async function downloadEventBillingPdf(
  hotelId: string,
  groupId: string,
  eventId: string,
): Promise<string> {
  return downloadEventPdf(hotelId, groupId, eventId, "quote");
}

function readHotelIdCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)hms_hotel_id=([^;]+)/);
  const raw = match?.[1] ? decodeURIComponent(match[1]).trim() : "";
  return raw.length >= 32 ? raw : undefined;
}

function resolveHotelIdForFetch(hotelId?: string | null): string {
  const trimmed = hotelId?.trim();
  if (trimmed && trimmed !== "undefined" && trimmed.length >= 32) {
    return trimmed;
  }
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("hms_hotel_id")?.trim();
    if (stored && stored.length >= 32) return stored;
    const fromCookie = readHotelIdCookie();
    if (fromCookie) return fromCookie;
  }
  throw new Error("Hotel context not available. Sign in again or reselect your hotel.");
}

export async function downloadEventBillingDocumentPdf(hotelId: string, documentId: string): Promise<string> {
  const { API_BASE, getToken } = await import("@/lib/api");
  const token = getToken();
  if (!token) throw new Error("Not signed in.");
  const resolvedHotelId = resolveHotelIdForFetch(hotelId);
  const path = `/api/v1/hotels/${resolvedHotelId}/event-billing-documents/${documentId}/pdf`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Hotel-ID": resolvedHotelId,
    },
  });
  if (!res.ok) {
    let msg = `PDF download failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      msg = body.message ?? body.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get("Content-Disposition")) ??
    `event-billing-${documentId.slice(0, 8)}.pdf`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
  return filename;
}

/** Download event billing or banquet order PDF from the API (auth + hotel header). */
export async function downloadEventPdf(
  hotelId: string,
  groupId: string,
  eventId: string,
  kind: "quote" | "beo",
): Promise<string> {
  const { API_BASE, getToken } = await import("@/lib/api");
  const token = getToken();
  if (!token) throw new Error("Not signed in.");
  const resolvedHotelId = resolveHotelIdForFetch(hotelId);
  const suffix = kind === "quote" ? "quote/pdf" : "beo/pdf";
  const path = `${eventBase(resolvedHotelId, groupId)}/${eventId}/${suffix}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Hotel-ID": resolvedHotelId,
    },
  });
  if (!res.ok) {
    let msg = `PDF download failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string; error?: string };
      if (body.error === "QUOTE_NOT_CONTRACTED" || res.status === 422) {
        msg = "Contract this quote first — billing PDFs are created when the quote is contracted.";
      } else if (body.error === "X_HOTEL_ID_REQUIRED" || body.error === "X_HOTEL_ID_MISMATCH") {
        msg = "Hotel context missing. Sign in again or reselect your hotel.";
      } else {
        msg = body.message ?? body.error ?? msg;
      }
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get("Content-Disposition")) ??
    `${kind === "quote" ? "event-billing" : "banquet-order"}-${eventId.slice(0, 8)}.pdf`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
  return filename;
}
