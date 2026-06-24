import { apiFetch } from "@/lib/api";

export type PosLineAuditRow = {
  id: string;
  ticketId: string;
  lineId: string;
  action: "VOID" | "DISCOUNT";
  productName?: string;
  tableLabel?: string;
  waiterName?: string;
  originalPrice: number | string;
  originalQty: number;
  discountPct?: number | string | null;
  discountAmount?: number | string | null;
  reason: string;
  authorizedBy: string;
  authorizedByName: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
};

export type VoidReportPage = {
  content: PosLineAuditRow[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function auditImpactAmount(row: PosLineAuditRow): number {
  if (row.action === "DISCOUNT") return num(row.discountAmount);
  return num(row.originalPrice) * row.originalQty;
}

export async function fetchVoidReport(
  hotelId: string,
  from: string,
  to: string,
  page = 0,
  size = 50,
): Promise<VoidReportPage> {
  const q = new URLSearchParams({ from, to, page: String(page), size: String(size) });
  return apiFetch<VoidReportPage>(`/api/v1/hotels/${hotelId}/pos/voids?${q}`, { quiet: true });
}

export function voidReportExportUrl(hotelId: string, from: string, to: string): string {
  const q = new URLSearchParams({ from, to, page: "0", size: "5000" });
  return `/api/v1/hotels/${hotelId}/pos/voids?${q}`;
}
