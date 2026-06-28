import { apiClient } from "./client";

type InventoryItemRow = {
  id: string;
  imageUrl?: string | null;
  image_url?: string | null;
  active?: boolean;
};

type InventoryItemsResponse = {
  data?: InventoryItemRow[];
};

/** Map inventory item id → image URL for menu photo fallback. */
export async function fetchInventoryImageMap(hotelId: string): Promise<Map<string, string>> {
  const { data } = await apiClient.get<InventoryItemsResponse>(
    `/api/v1/hotels/${hotelId}/inventory/items`,
    { timeout: 60_000 },
  );
  const map = new Map<string, string>();
  for (const row of data?.data ?? []) {
    if (row.active === false) continue;
    const img = (row.imageUrl ?? row.image_url)?.trim();
    if (img) map.set(String(row.id).toLowerCase(), img);
  }
  return map;
}

export async function patchDepotProductPhoto(
  hotelId: string,
  productId: string,
  photoUrl: string,
): Promise<void> {
  await apiClient.patch(`/api/v1/hotels/${hotelId}/inventory/depot-products/${productId}`, {
    photoUrl,
  });
}
