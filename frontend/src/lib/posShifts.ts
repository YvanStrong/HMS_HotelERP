import { apiFetch, getToken } from "./api";

export type ShiftStatus = "OPEN" | "CLOSED";

export type PosShiftDTO = {
  id: string;
  hotelId: string;
  depotId: string;
  depotName: string;
  waiterUserId: string;
  waiterName: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt?: string | null;
  openingFloat: number | string;
  totalOrders: number;
  totalRevenue: number | string;
  durationMinutes: number;
  cashVariance?: number | string | null;
  cashVarianceStatus?: "BALANCED" | "OVERAGE" | "SHORTAGE" | null;
};

export type ShiftTopItem = {
  productName: string;
  qtySold: number;
  revenue: number | string;
};

export type ShiftDepotRow = {
  depotId: string;
  depotName: string;
  orderCount: number;
  revenue: number | string;
  cash: number | string;
};

export type ShiftTicketSummary = {
  ticketId: string;
  depotName?: string;
  tableLabel: string;
  closedAt?: string | null;
  totalAmount: number | string;
  paymentMethod?: string | null;
  lineCount: number;
};

export type PosShiftSummaryDTO = PosShiftDTO & {
  totalCovers: number;
  totalCash: number | string;
  totalCard: number | string;
  totalRoomCharge: number | string;
  totalTax: number | string;
  totalCancelled: number;
  totalDiscounts?: number | string;
  totalTips?: number | string;
  avgTicketValue: number | string;
  avgServeTimeMin: number | string;
  expectedCash?: number | string | null;
  closingCash?: number | string | null;
  cashVariance?: number | string | null;
  closingNotes?: string | null;
  cashVarianceStatus?: "BALANCED" | "OVERAGE" | "SHORTAGE" | null;
  topItems: ShiftTopItem[];
  revenueByDepot?: ShiftDepotRow[];
  tickets: ShiftTicketSummary[];
};

export type ShiftPage = {
  content: PosShiftDTO[];
  totalElements: number;
  totalPages: number;
  number: number;
};

export function shiftMoney(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function formatShiftDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export async function fetchOpenShifts(hotelId: string, depotId?: string): Promise<PosShiftDTO[]> {
  const q = depotId ? `?depotId=${encodeURIComponent(depotId)}` : "";
  return apiFetch<PosShiftDTO[]>(`/api/v1/hotels/${hotelId}/pos/shifts/open${q}`, { quiet: true });
}

export async function fetchShiftHistory(
  hotelId: string,
  opts: {
    depotId?: string;
    waiterId?: string;
    from: string;
    to: string;
    status?: ShiftStatus;
    page?: number;
    size?: number;
  },
): Promise<ShiftPage> {
  const q = new URLSearchParams({
    from: opts.from,
    to: opts.to,
    page: String(opts.page ?? 0),
    size: String(opts.size ?? 20),
  });
  if (opts.depotId) q.set("depotId", opts.depotId);
  if (opts.waiterId) q.set("waiterId", opts.waiterId);
  if (opts.status) q.set("status", opts.status);
  return apiFetch<ShiftPage>(`/api/v1/hotels/${hotelId}/pos/shifts?${q}`, { quiet: true });
}

export async function fetchShiftSummary(hotelId: string, shiftId: string): Promise<PosShiftSummaryDTO> {
  return apiFetch<PosShiftSummaryDTO>(`/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/summary`, {
    quiet: true,
  });
}

export async function closeShift(
  hotelId: string,
  shiftId: string,
  closingCash: number,
  closingNotes?: string,
): Promise<PosShiftSummaryDTO> {
  return apiFetch<PosShiftSummaryDTO>(`/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/close`, {
    method: "POST",
    body: JSON.stringify({ closingCash, closingNotes: closingNotes ?? "" }),
  });
}

export function shiftExportUrl(hotelId: string, shiftId: string): string {
  const token = getToken();
  const base = `/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/export?format=csv`;
  return token ? `${base}&access_token=${encodeURIComponent(token)}` : base;
}
