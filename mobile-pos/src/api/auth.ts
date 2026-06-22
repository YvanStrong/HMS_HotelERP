import type { LoginResponse } from "../types";
import { apiClient } from "./client";

export async function loginWithEmail(email: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/api/v1/auth/login", { email, password });
  return data;
}
