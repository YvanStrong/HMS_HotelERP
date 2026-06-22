import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL_KEY = "api_base_url";

const defaultUrl = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

let cachedUrl: string | null = null;

export function getApiBaseUrl(): string {
  return cachedUrl ?? defaultUrl;
}

export async function hydrateApiBaseUrl(): Promise<void> {
  const saved = (await AsyncStorage.getItem(API_URL_KEY))?.trim();
  if (saved) {
    cachedUrl = saved.replace(/\/$/, "");
  }
}

export async function setApiBaseUrl(url: string): Promise<void> {
  cachedUrl = url.trim().replace(/\/$/, "");
  await AsyncStorage.setItem(API_URL_KEY, cachedUrl);
}

export function getTaxRate(): number {
  const raw = process.env.EXPO_PUBLIC_TAX_RATE ?? "0.18";
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0.18;
}
