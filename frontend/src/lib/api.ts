import { clearSessionCookies } from "./sessionCookies";
import { showErrorPopup } from "./errorPopup";

/**
 * Optional path prefix when the API is served under the same host as the site, e.g.
 * `https://hotelerp.rw/Hotel/api/v1/...` → set `NEXT_PUBLIC_API_BASE_PATH=/Hotel`.
 * Must start with `/`; no trailing slash. Ignored when `NEXT_PUBLIC_API_URL` is set.
 */
function normalizeApiBasePath(raw: string | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim();
  if (s === "") return "";
  if (!s.startsWith("/")) s = `/${s}`;
  return s.replace(/\/+$/, "");
}

/**
 * Resolves the base URL prepended to paths like `/api/v1/...` (see `apiFetch` / `publicFetch`).
 *
 * Production (recommended): set **`NEXT_PUBLIC_API_URL`** at build time, e.g.
 * `https://hotelerp.rw/Hotel` — no trailing slash. The JAR file name does not matter; match whatever
 * path Spring or Nginx exposes (often `server.servlet.context-path=/Hotel` on the backend).
 *
 * Same host + subpath without full URL: set only **`NEXT_PUBLIC_API_BASE_PATH=/Hotel`**; in the
 * browser the API base becomes `window.location.origin + "/Hotel"`. For SSR/build-time fetches,
 * prefer setting the full `NEXT_PUBLIC_API_URL` instead.
 */
function resolveApiBase(): string {
  const rawUrl = process.env.NEXT_PUBLIC_API_URL;
  if (rawUrl != null && String(rawUrl).trim() !== "") {
    return String(rawUrl).trim().replace(/\/$/, "");
  }

  const basePath = normalizeApiBasePath(process.env.NEXT_PUBLIC_API_BASE_PATH);

  if (typeof window !== "undefined") {
    if (basePath) {
      return `${window.location.origin}${basePath}`.replace(/\/$/, "");
    }
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  if (basePath) {
    return `http://127.0.0.1:8080${basePath}`.replace(/\/$/, "");
  }
  return "http://127.0.0.1:8080";
}

export const API_BASE = resolveApiBase();

const HOTEL_UUID_IN_API_PATH =
  /^\/api\/v1\/hotels\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\//;

/** Backend Swagger UI (same origin as API). */
export function swaggerUiUrl(): string {
  return `${API_BASE.replace(/\/$/, "")}/swagger-ui/index.html`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hms_token");
}

export function setToken(token: string) {
  localStorage.setItem("hms_token", token);
}

export function clearToken() {
  localStorage.removeItem("hms_token");
  localStorage.removeItem("hms_user");
  localStorage.removeItem("hms_hotel_id");
  clearSessionCookies();
}

function resolveXHotelId(path: string, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const m = path.match(HOTEL_UUID_IN_API_PATH);
  if (m) return m[1];
  if (typeof window === "undefined") return undefined;
  return localStorage.getItem("hms_hotel_id") ?? undefined;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { hotelId?: string; /** When true, failed requests do not open the global error popup. */ quiet?: boolean } = {},
): Promise<T> {
  const { hotelId, quiet, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const xHotel = resolveXHotelId(path, hotelId);
  if (xHotel) headers.set("X-Hotel-ID", xHotel);
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      const code = typeof body?.error === "string" ? body.error : null;
      const message = typeof body?.message === "string" ? body.message : null;
      if (code && message) msg = `${code}: ${message}`;
      else if (message) msg = message;
      else if (code) msg = code;
    } catch {
      /* ignore */
    }
    if (!quiet) {
      showErrorPopup({ message: msg, title: `Request failed (${res.status})` });
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
