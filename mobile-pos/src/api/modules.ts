import { apiClient } from "./client";



export async function fetchModuleEntitlements(hotelId: string): Promise<string[]> {

  const { data } = await apiClient.get<{ enabledModules: string[] }>(

    `/api/v1/hotels/${hotelId}/module-entitlements`,

  );

  return data.enabledModules ?? [];

}


