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
