import { apiFetch } from "@/lib/api";

export type PosSummary = {
  totalRevenue: number | string;
  totalOrders: number;
  avgTicketValue: number | string;
  avgServeTimeMinutes: number;
  totalCovers: number;
  revenueByPaymentMethod: Record<string, number | string>;
  revenueByDepot: Array<{ depotName: string; revenue: number | string; orders: number }>;
};

export type HourlySlot = { hour: number; revenue: number | string; orders: number };
export type TopItemRow = {
  productName: string;
  qtySold: number;
  revenue: number | string;
  avgOrdersPerDay: number | string;
};
export type WaiterRow = {
  waiterName: string;
  ordersCount: number;
  revenue: number | string;
  avgTicketValue: number | string;
  avgServeTimeMin: number;
};
export type TableRow = {
  tableLabel: string;
  totalOrders: number;
  totalRevenue: number | string;
  avgOccupancyMinutes: number;
  turnoverCount: number;
};
export type DailyRevenueRow = { date: string; revenue: number | string; orders: number };

function qs(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function fetchPosSummary(
  hotelId: string,
  from: string,
  to: string,
  depotId?: string,
): Promise<PosSummary> {
  return apiFetch(
    `/api/v1/hotels/${hotelId}/pos/analytics/summary${qs({ from, to, depotId })}`,
  );
}

export async function fetchPosHourly(
  hotelId: string,
  date: string,
  depotId?: string,
): Promise<HourlySlot[]> {
  return apiFetch(`/api/v1/hotels/${hotelId}/pos/analytics/hourly${qs({ date, depotId })}`);
}

export async function fetchPosTopItems(
  hotelId: string,
  from: string,
  to: string,
  depotId?: string,
  limit = 10,
): Promise<TopItemRow[]> {
  return apiFetch(
    `/api/v1/hotels/${hotelId}/pos/analytics/top-items${qs({ from, to, depotId, limit: String(limit) })}`,
  );
}

export async function fetchPosWaiters(
  hotelId: string,
  from: string,
  to: string,
): Promise<WaiterRow[]> {
  return apiFetch(`/api/v1/hotels/${hotelId}/pos/analytics/waiters${qs({ from, to })}`);
}

export async function fetchPosTables(
  hotelId: string,
  from: string,
  to: string,
  depotId?: string,
): Promise<TableRow[]> {
  return apiFetch(`/api/v1/hotels/${hotelId}/pos/analytics/tables${qs({ from, to, depotId })}`);
}

export async function fetchPosDaily(
  hotelId: string,
  from: string,
  to: string,
  depotId?: string,
): Promise<DailyRevenueRow[]> {
  return apiFetch(`/api/v1/hotels/${hotelId}/pos/analytics/daily${qs({ from, to, depotId })}`);
}

export function posAnalyticsExportUrl(
  hotelId: string,
  from: string,
  to: string,
  depotId?: string,
): string {
  return `/api/v1/hotels/${hotelId}/pos/analytics/export${qs({ from, to, depotId, format: "csv" })}`;
}
