import { getApiBaseUrl } from "../api/settings";

/** Turn API-relative or absolute image paths into a URI expo-image can load. */
export function resolveMediaUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const url = raw.trim();
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${getApiBaseUrl().replace(/\/$/, "")}${url}`;
  }
  return url;
}
