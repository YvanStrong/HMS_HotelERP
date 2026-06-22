import type { ReservationListItem } from "../types";
import { apiClient } from "./client";

export async function fetchCheckedInReservations(hotelId: string): Promise<ReservationListItem[]> {
  const { data } = await apiClient.get<ReservationListItem[]>(`/api/v1/hotels/${hotelId}/reservations`, {
    params: { status: "CHECKED_IN" },
  });
  return data ?? [];
}
