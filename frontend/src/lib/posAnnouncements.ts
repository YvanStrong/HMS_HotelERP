import { apiFetch } from "./api";

export type PosAnnouncementRow = {
  id: string;
  message: string;
  type: "INFO" | "WARNING" | "URGENT";
  depotId?: string | null;
  depotName?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export async function listPosAnnouncements(hotelId: string): Promise<PosAnnouncementRow[]> {
  return apiFetch<PosAnnouncementRow[]>(`/api/v1/hotels/${hotelId}/pos/announcements`, { quiet: true });
}

export async function createPosAnnouncement(
  hotelId: string,
  body: { message: string; type: string; depotId?: string; expiresAt?: string },
): Promise<PosAnnouncementRow> {
  return apiFetch<PosAnnouncementRow>(`/api/v1/hotels/${hotelId}/pos/announcements`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deletePosAnnouncement(hotelId: string, id: string): Promise<void> {
  await apiFetch(`/api/v1/hotels/${hotelId}/pos/announcements/${id}`, { method: "DELETE" });
}
