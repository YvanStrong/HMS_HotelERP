import type { LoginResponse } from "../types";

import { apiClient } from "./client";



export async function pinLogin(hotelId: string, email: string, pin: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    `/api/v1/hotels/${hotelId}/auth/pos/pin-login`,
    { email, pin },
  );
  return data;
}

/** Re-authenticate after idle timeout; uses a separate server rate-limit bucket. */
export async function pinUnlock(hotelId: string, email: string, pin: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    `/api/v1/hotels/${hotelId}/auth/pos/pin-unlock`,
    { email, pin },
  );
  return data;
}



export async function setPosPin(hotelId: string, pin: string): Promise<void> {

  await apiClient.post(`/api/v1/hotels/${hotelId}/auth/pos/set-pin`, { pin });

}



export async function fetchHasPin(hotelId: string): Promise<boolean> {

  const { data } = await apiClient.get<{ hasPin: boolean }>(

    `/api/v1/hotels/${hotelId}/auth/pos/has-pin`,

  );

  return data.hasPin;

}


