import { apiClient } from "./client";
import { money } from "./tickets";

export type PosDailySummary = {
  totalRevenue: number | string;
  orderCount: number;
  avgTicketValue: number | string;
  revenueByDepot: {
    depotId: string;
    depotName: string;
    revenue: number | string;
    orderCount: number;
  }[];
  topItems: { productName: string; quantity: number; revenue: number | string }[];
  waiterStats: {
    waiterId: string;
    waiterName: string;
    orderCount: number;
    revenue: number | string;
    avgServeMinutes: number;
  }[];
  activeShifts?: number;
  shiftCount?: number;
};

export type AnalyticsSummary = {
  totalRevenue: number | string;
  totalOrders: number;
  avgTicketValue: number | string;
  avgServeTimeMinutes: number;
  totalCovers: number;
  revenueByPaymentMethod: Record<string, number | string>;
  revenueByDepot: { depotName: string; revenue: number | string; orders: number }[];
};

export type AnalyticsTopItem = {
  productName: string;
  qtySold: number;
  revenue: number | string;
  avgOrdersPerDay?: number | string;
};

export type AnalyticsWaiter = {
  waiterName: string;
  ordersCount: number;
  revenue: number | string;
  avgTicketValue: number | string;
  avgServeTimeMin: number;
};

export type EndOfDayShiftRow = {
  shiftId: string;
  waiterName: string;
  depotName: string;
  openingFloat: number | string;
  closingCash: number | string;
  cashVariance: number | string;
  varianceStatus: string;
  totalCash: number | string;
  totalCard: number | string;
  totalRevenue: number | string;
  totalTips: number | string;
  orderCount: number;
};

export type EndOfDayReport = {
  date: string;
  totalCash: number | string;
  totalCard: number | string;
  totalRoomCharge: number | string;
  totalTips: number | string;
  totalRevenue: number | string;
  totalDiscounts: number | string;
  totalVoids: number;
  shiftCount: number;
  openShiftCount: number;
  perShift: EndOfDayShiftRow[];
  expectedCashInDrawers: number | string;
  totalCashVariance: number | string;
  cashVarianceStatus: "BALANCED" | "HAS_SHORTAGES" | "HAS_OVERAGES" | "MIXED";
};

export async function fetchDailySummary(hotelId: string, date?: string): Promise<PosDailySummary> {
  const params = date ? { date } : {};
  const { data } = await apiClient.get<PosDailySummary>(
    `/api/v1/hotels/${hotelId}/pos/daily-summary`,
    { params },
  );
  return data;
}

export async function fetchAnalyticsSummary(
  hotelId: string,
  from: string,
  to: string,
): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<AnalyticsSummary>(
    `/api/v1/hotels/${hotelId}/pos/analytics/summary`,
    { params: { from, to } },
  );
  return data;
}

export async function fetchAnalyticsTopItems(
  hotelId: string,
  from: string,
  to: string,
  limit = 5,
): Promise<AnalyticsTopItem[]> {
  const { data } = await apiClient.get<AnalyticsTopItem[]>(
    `/api/v1/hotels/${hotelId}/pos/analytics/top-items`,
    { params: { from, to, limit } },
  );
  return data ?? [];
}

export async function fetchAnalyticsWaiters(
  hotelId: string,
  from: string,
  to: string,
): Promise<AnalyticsWaiter[]> {
  const { data } = await apiClient.get<AnalyticsWaiter[]>(
    `/api/v1/hotels/${hotelId}/pos/analytics/waiters`,
    { params: { from, to } },
  );
  return data ?? [];
}

export async function fetchAnalyticsExportCsv(hotelId: string, from: string, to: string): Promise<string> {
  const { data } = await apiClient.get<string>(`/api/v1/hotels/${hotelId}/pos/analytics/export`, {
    params: { from, to },
    responseType: "text",
  });
  return data;
}

export async function fetchEndOfDayReport(hotelId: string, date: string): Promise<EndOfDayReport> {
  const { data } = await apiClient.get<EndOfDayReport>(`/api/v1/hotels/${hotelId}/pos/end-of-day`, {
    params: { date },
  });
  return data;
}

export function fmtRwf(v: number | string | null | undefined): string {
  return `RWF ${money(v).toLocaleString()}`;
}

export { money };
