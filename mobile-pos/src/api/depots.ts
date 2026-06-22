import type { Depot, DepotProduct } from "../types";
import { normalizeDepotProduct } from "../lib/productMoney";
import { apiClient } from "./client";

export async function setActiveDepot(hotelId: string, depotId: string): Promise<void> {
  await apiClient.patch(`/api/v1/hotels/${hotelId}/staff/active-depot`, { depotId });
}

export async function fetchDepots(hotelId: string): Promise<Depot[]> {
  const { data } = await apiClient.get<Depot[]>(`/api/v1/hotels/${hotelId}/inventory/depots`);
  return (data ?? []).filter((d) => d.active);
}

export async function fetchDepotProducts(hotelId: string, depotId: string): Promise<DepotProduct[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>(
    `/api/v1/hotels/${hotelId}/inventory/depot-products`,
    { params: { depotId, activeOnly: true } },
  );
  return (data ?? []).map(normalizeDepotProduct);
}

export async function countProductsByDepot(hotelId: string): Promise<Record<string, number>> {
  const products = await fetchDepotProductsAll(hotelId);
  const counts: Record<string, number> = {};
  for (const p of products) {
    if (!p.active) continue;
    counts[p.depotId] = (counts[p.depotId] ?? 0) + 1;
  }
  return counts;
}

async function fetchDepotProductsAll(hotelId: string): Promise<DepotProduct[]> {
  const { data } = await apiClient.get<Record<string, unknown>[]>(
    `/api/v1/hotels/${hotelId}/inventory/depot-products`,
    { params: { activeOnly: true } },
  );
  return (data ?? []).map(normalizeDepotProduct);
}
