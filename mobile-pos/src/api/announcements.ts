import { apiClient } from "./client";

export type AnnouncementType = "INFO" | "WARNING" | "URGENT";

export type PosAnnouncement = {
  id: string;
  message: string;
  type: AnnouncementType;
  depotId?: string | null;
  depotName?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export async function fetchActiveAnnouncements(
  hotelId: string,
  depotId?: string,
): Promise<PosAnnouncement[]> {
  const { data } = await apiClient.get<PosAnnouncement[]>(
    `/api/v1/hotels/${hotelId}/pos/announcements/active`,
    { params: depotId ? { depotId } : {} },
  );
  return data ?? [];
}

export async function markAnnouncementRead(hotelId: string, announcementId: string): Promise<void> {
  await apiClient.post(`/api/v1/hotels/${hotelId}/pos/announcements/${announcementId}/read`);
}

export async function listAnnouncements(hotelId: string): Promise<PosAnnouncement[]> {
  const { data } = await apiClient.get<PosAnnouncement[]>(`/api/v1/hotels/${hotelId}/pos/announcements`);
  return data ?? [];
}

export async function createAnnouncement(
  hotelId: string,
  body: { message: string; type: AnnouncementType; depotId?: string; expiresAt?: string },
): Promise<PosAnnouncement> {
  const { data } = await apiClient.post<PosAnnouncement>(`/api/v1/hotels/${hotelId}/pos/announcements`, body);
  return data;
}

export async function deleteAnnouncement(hotelId: string, announcementId: string): Promise<void> {
  await apiClient.delete(`/api/v1/hotels/${hotelId}/pos/announcements/${announcementId}`);
}
