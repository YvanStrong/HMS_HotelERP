import { apiClient } from "./client";
import type { ReservationHint, ReservationListItem } from "../types";

export async function fetchCheckedInReservations(hotelId: string): Promise<ReservationListItem[]> {
  const { data } = await apiClient.get<ReservationListItem[]>(`/api/v1/hotels/${hotelId}/reservations`, {
    params: { status: "CHECKED_IN" },
  });
  return data ?? [];
}

export async function getTableReservationHint(
  hotelId: string,
  tableId: string,
): Promise<ReservationHint | null> {
  const { data } = await apiClient.get<ReservationHint | null>(
    `/api/v1/hotels/${hotelId}/pos/tables/${tableId}/reservation-hint`,
  );
  return data ?? null;
}
