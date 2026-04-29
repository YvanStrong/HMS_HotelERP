/**
 * Lightweight cookies for Edge middleware (role / hotel scope). Real auth remains JWT in localStorage.
 * Cleared on logout alongside token storage.
 */

export const ROLE_COOKIE = "hms_role";
export const HOTEL_COOKIE = "hms_hotel_id";
export const PLATFORM_ADMIN_COOKIE = "hms_platform_admin";

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function cookieSuffix(): string {
  if (typeof window === "undefined") return "; path=/; SameSite=Lax";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  return `; path=/; SameSite=Lax; max-age=${MAX_AGE}${secure}`;
}

export function writeSessionCookies(opts: {
  role: string;
  hotelId: string | null;
  platformAdmin: boolean;
}): void {
  if (typeof document === "undefined") return;
  const suf = cookieSuffix();
  document.cookie = `${ROLE_COOKIE}=${encodeURIComponent(opts.role)}${suf}`;
  document.cookie = `${PLATFORM_ADMIN_COOKIE}=${opts.platformAdmin ? "1" : "0"}${suf}`;
  if (opts.hotelId) {
    document.cookie = `${HOTEL_COOKIE}=${encodeURIComponent(opts.hotelId)}${suf}`;
  } else {
    document.cookie = `${HOTEL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function clearSessionCookies(): void {
  if (typeof document === "undefined") return;
  const expire = "; path=/; max-age=0; SameSite=Lax";
  document.cookie = `${ROLE_COOKIE}=${expire}`;
  document.cookie = `${HOTEL_COOKIE}=${expire}`;
  document.cookie = `${PLATFORM_ADMIN_COOKIE}=${expire}`;
}
