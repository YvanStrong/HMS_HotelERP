import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HOTEL_COOKIE, PLATFORM_ADMIN_COOKIE, ROLE_COOKIE } from "./lib/sessionCookies";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const platformAdmin = request.cookies.get(PLATFORM_ADMIN_COOKIE)?.value === "1";
  const role = request.cookies.get(ROLE_COOKIE)?.value ?? "";
  const hotelCookie = request.cookies.get(HOTEL_COOKIE)?.value ?? "";

  if (pathname.startsWith("/platform")) {
    if (!platformAdmin) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return NextResponse.next();
  }

  const hotelsMatch = pathname.match(new RegExp(`^/hotels/(${UUID})(?:/(.*))?$`));
  if (hotelsMatch) {
    return NextResponse.next();
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    if (role === "GUEST") {
      return NextResponse.redirect(new URL("/book/me", request.url));
    }
    if (!hotelCookie) {
      if (platformAdmin) {
        return NextResponse.redirect(new URL("/platform/hotels", request.url));
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
    const rest = pathname.replace(/^\/app/, "") || "/dashboard";
    const dest = `/hotels/${hotelCookie}${rest}`;
    return NextResponse.rewrite(new URL(dest, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/platform/:path*", "/hotels/:path*"],
};
