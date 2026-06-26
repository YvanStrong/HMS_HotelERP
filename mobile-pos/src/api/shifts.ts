import { apiClient } from "./client";

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
  totalTips?: number | string;
  totalCancelled: number;
  totalDiscounts?: number | string;
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

export function money(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function openShift(
  hotelId: string,
  depotId: string,
  openingFloat: number,
): Promise<PosShiftDTO> {
  const { data } = await apiClient.post<PosShiftDTO>(`/api/v1/hotels/${hotelId}/pos/shifts`, {
    depotId,
    openingFloat,
  });
  return data;
}

/** Returns the waiter's single open shift for this hotel (all outlets). Never throws. */
export async function getActiveShift(hotelId: string): Promise<PosShiftDTO | null> {
  try {
    const res = await apiClient.get<PosShiftDTO>(`/api/v1/hotels/${hotelId}/pos/shifts/active`, {
      validateStatus: (s) => s === 200 || s === 204 || s === 403 || s === 404,
    });
    if (res.status === 204 || res.status === 403 || res.status === 404) return null;
    return res.data;
  } catch {
    return null;
  }
}

export async function getShiftSummary(hotelId: string, shiftId: string): Promise<PosShiftSummaryDTO> {
  const { data } = await apiClient.get<PosShiftSummaryDTO>(
    `/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/summary`,
  );
  return data;
}

export async function closeShift(
  hotelId: string,
  shiftId: string,
  closingCash: number,
  closingNotes?: string,
): Promise<PosShiftSummaryDTO> {
  const { data } = await apiClient.post<PosShiftSummaryDTO>(
    `/api/v1/hotels/${hotelId}/pos/shifts/${shiftId}/close`,
    { closingCash, closingNotes: closingNotes ?? "" },
  );
  return data;
}
