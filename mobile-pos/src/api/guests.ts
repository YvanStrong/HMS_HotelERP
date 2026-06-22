import type { GuestSearchHit } from "../types";
import { apiClient } from "./client";

export async function searchGuests(hotelId: string, query: string): Promise<GuestSearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const { data } = await apiClient.get<GuestSearchHit[]>(`/api/v1/hotels/${hotelId}/guests/search`, {
    params: { q },
  });
  return data ?? [];
}

export function guestDisplayName(hit: GuestSearchHit): string {
  return hit.guest.full_name ?? hit.guest.fullName ?? "Guest";
}
