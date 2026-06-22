import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getApiBaseUrl } from "./settings";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "hms_access_token";
const REFRESH_KEY = "hms_refresh_token";

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let hotelIdGetter: (() => string | null) | null = null;
let onUnauthorized: (() => void) | null = null;

export function configureApiClient(opts: {
  getHotelId: () => string | null;
  onUnauthorized: () => void;
}) {
  hotelIdGetter = opts.getHotelId;
  onUnauthorized = opts.onUnauthorized;
}

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function storeTokens(access: string, refresh: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearStoredTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export const apiClient = axios.create({
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  config.headers["X-Client-Type"] = "mobile";
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const hotelId = hotelIdGetter?.();
  if (hotelId) {
    config.headers["X-Hotel-ID"] = hotelId;
  }
  const { bumpSessionActivity } = await import("../lib/sessionActivity");
  bumpSessionActivity();
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (!original || error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;
    const refresh = await getStoredRefreshToken();
    if (!refresh) {
      await clearStoredTokens();
      onUnauthorized?.();
      return Promise.reject(error);
    }
    try {
      const res = await axios.post(
        `${getApiBaseUrl()}/api/v1/auth/refresh`,
        { refreshToken: refresh },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Client-Type": "mobile",
          },
        },
      );
      const accessToken = res.data.accessToken as string;
      const refreshToken = res.data.refreshToken as string;
      await storeTokens(accessToken, refreshToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(original);
    } catch {
      await clearStoredTokens();
      onUnauthorized?.();
      return Promise.reject(error);
    }
  },
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ECONNABORTED") {
      return "Request timed out. Check your connection and try again.";
    }
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message ?? data?.error ?? err.message;
  }
  return err instanceof Error ? err.message : "Request failed";
}
