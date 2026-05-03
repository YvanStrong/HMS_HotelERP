import { clearSessionCookies } from "./sessionCookies";
import { showErrorPopup } from "./errorPopup";

/** Empty env string would otherwise make fetch hit the Next origin instead of the Java API. */
function resolveApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw == null || String(raw).trim() === "") return "http://localhost:8080";
  return String(raw).trim().replace(/\/$/, "");
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
      if (body?.message) msg = body.message;
      else if (body?.error) msg = body.error;
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
