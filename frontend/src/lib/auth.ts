import { setToken } from "./api";
import { writeSessionCookies } from "./sessionCookies";

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  hotelId: string | null;
  permissions: string[];
};

const USER_KEY = "hms_user";

export function isSuperAdmin(user: AuthUser | null): boolean {
  return user?.role === "SUPER_ADMIN" || (user?.permissions ?? []).includes("platform:*");
}

export function isGuestPortalUser(user: AuthUser | null): boolean {
  return user?.role === "GUEST";
}

export function saveAuthSession(accessToken: string, user: AuthUser): void {
  setToken(accessToken);
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.hotelId) {
    localStorage.setItem("hms_hotel_id", user.hotelId);
  } else {
    localStorage.removeItem("hms_hotel_id");
  }
  writeSessionCookies({
    role: user.role,
    hotelId: user.hotelId,
    platformAdmin: isSuperAdmin(user),
  });
}

export function loadAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as AuthUser;
    if (!u || typeof u.role !== "string" || !Array.isArray(u.permissions)) return null;
    return u;
  } catch {
    return null;
  }
}

/** First route after successful login (role + hotel scope). */
export function postLoginRedirectPath(user: AuthUser): string {
  if (isSuperAdmin(user)) {
    return "/platform/hotels";
  }
  if (user.role === "GUEST") {
    if (user.hotelId) return "/book/me";
    return "/book/hotels";
  }
  if (user.hotelId) {
    return "/app/dashboard";
  }
  return "/book/hotels";
}
