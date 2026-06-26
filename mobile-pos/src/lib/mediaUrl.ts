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
  // Bare base64 from some clients (no data: prefix).
  if (url.length > 80 && /^[A-Za-z0-9+/=\s]+$/.test(url)) {
    const compact = url.replace(/\s/g, "");
    const mime = compact.startsWith("/9j/") ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${compact}`;
  }
  return url;
}

/** Base64 data URIs from inventory must not use disk cache in expo-image. */
export function imageCachePolicy(uri: string | null | undefined): "disk" | "memory" {
  const resolved = resolveMediaUrl(uri);
  if (resolved?.startsWith("data:")) return "memory";
  return "disk";
}
