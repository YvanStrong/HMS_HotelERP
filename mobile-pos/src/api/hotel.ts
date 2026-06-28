import { apiClient } from "./client";

export type HotelContext = {
  id: string;
  name: string;
  currency: string;
  taxRate?: number | string;
  posRequireShift: boolean;
  posLowStockThreshold?: number;
};

export async function fetchHotelContext(hotelId: string): Promise<HotelContext> {
  const { data } = await apiClient.get<HotelContext>(`/api/v1/hotels/${hotelId}`);
  return data;
}
