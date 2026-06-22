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
  /^\/api\/v1\/hotels\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:\/|$)/;

/** Staff-facing titles — avoid raw HTTP jargon in popups. */
function friendlyApiErrorTitle(status: number): string {
  switch (status) {
    case 400:
      return "We couldn't process that";
    case 403:
      return "You don't have access";
    case 404:
      return "Not found";
    case 409:
      return "That isn't available right now";
    case 422:
      return "Please review and try again";
    case 429:
      return "Too many attempts";
    default:
      if (status >= 500) return "Something went wrong";
      return "Request failed";
  }
}

type ApiErrorBody = { error?: unknown; message?: unknown; reason?: unknown };
const SUBSCRIPTION_BLOCK_CODES = new Set([
  "SUBSCRIPTION_EXPIRED",
  "MANUALLY_BLOCKED",
  "HOTEL_MANUALLY_BLOCKED",
  "TENANT_NOT_CONFIGURED",
  "TENANT_SUBSCRIPTION_NOT_CONFIGURED",
]);

function userFacingApiMessage(status: number, body: ApiErrorBody | null): string {
  const code = typeof body?.error === "string" ? body.error : null;
  const message = typeof body?.message === "string" ? body.message.trim() : null;
  if (message) return message;

  const fallbacks: Record<string, string> = {
    GROUP_HAS_RESERVATIONS:
      "This group still has reservations attached. Finish or cancel those stays first, then try deleting the group again.",
  };
  if (code && fallbacks[code]) return fallbacks[code];

  if (code) {
    if (code === "Not Found" || code === "NOT_FOUND") {
      return "The requested item or action was not found. If you just updated the app, restart the backend and try again.";
    }
    return "Something went wrong. Please try again or contact support if it keeps happening.";
  }
  return status >= 500 ? "The server had a problem. Please try again in a moment." : "The request could not be completed.";
}

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

/** Public auth paths that must never trigger a redirect loop. */
const AUTH_PATHS = new Set(["/api/v1/auth/login", "/api/v1/auth/register-guest"]);

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { hotelId?: string; /** When true, failed requests do not open the global error popup. */ quiet?: boolean } = {},
): Promise<T> {
  const { hotelId, quiet, headers: initHeaders, ...rest } = options;
  const headers = new Headers(initHeaders ?? undefined);
  const method = String(rest.method ?? "GET").toUpperCase();
  const rawBody = rest.body;
  const isFormData = typeof FormData !== "undefined" && rawBody instanceof FormData;
  // Spring returns 415 if Content-Type is application/json but there is no body (common for POST-without-body).
  if (isFormData) {
    headers.delete("Content-Type");
  } else if (rawBody != null && method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
  } else {
    headers.delete("Content-Type");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const xHotel = resolveXHotelId(path, hotelId);
  if (xHotel) headers.set("X-Hotel-ID", xHotel);
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  if (!res.ok) {
    let msg = res.statusText;
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
      msg = userFacingApiMessage(res.status, body);
    } catch {
      /* ignore */
    }
    const code = typeof body?.error === "string" ? body.error : "";
    if (SUBSCRIPTION_BLOCK_CODES.has(code) && typeof window !== "undefined") {
      const params = new URLSearchParams();
      params.set("code", code);
      if (typeof body?.reason === "string") params.set("reason", body.reason);
      if (msg) params.set("message", msg);
      clearToken();
      window.location.replace(`/subscription-blocked?${params.toString()}`);
      throw new Error(msg || "Subscription blocked. Redirecting…");
    }
    // Session expired or token invalid — wipe stored credentials and send to login.
    if (res.status === 401 && !AUTH_PATHS.has(path) && typeof window !== "undefined") {
      clearToken();
      window.location.replace("/login");
      throw new Error("Session expired. Redirecting to login…");
    }
    if (!quiet) {
      showErrorPopup({ message: msg, title: friendlyApiErrorTitle(res.status) });
    }
    throw new Error(msg);
  }
  if (res.status === 204 || res.status === 205) return undefined as T;
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return undefined as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error("Invalid JSON from server");
  }
}
