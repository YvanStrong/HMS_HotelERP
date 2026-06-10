import { apiClient } from "./client";



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



export async function fetchDailySummary(hotelId: string, date?: string): Promise<PosDailySummary> {

  const params = date ? { date } : {};

  const { data } = await apiClient.get<PosDailySummary>(

    `/api/v1/hotels/${hotelId}/pos/daily-summary`,

    { params },

  );

  return data;

}


