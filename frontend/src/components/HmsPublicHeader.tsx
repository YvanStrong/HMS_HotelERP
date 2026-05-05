"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { isGuestPortalUser, isSuperAdmin, loadAuthUser } from "@/lib/auth";
import { useHotelContext } from "@/lib/useHotelContext";

/** Shared top bar for guest marketing and auth — adapts when a session is already present. */
export function HmsPublicHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(loadAuthUser());
  }, []);

  function logout() {
    clearToken();
    setUser(null);
    router.push("/book/hotels");
    router.refresh();
  }

  const staffHotel = user && user.hotelId && !isGuestPortalUser(user) ? user.hotelId : null;
  const guestHotel = user && isGuestPortalUser(user) ? user.hotelId : null;
  const viewedHotelMatch = pathname.match(/^\/book\/hotels\/([0-9a-fA-F-]{36})(?:\/|$)/);
  const viewedHotelId = viewedHotelMatch?.[1] ?? null;
  const brandHotelId = viewedHotelId ?? undefined;
  const { hotel } = useHotelContext(brandHotelId);
  const brandLabel = brandHotelId && hotel.name ? hotel.name : "HMS";

  return (
    <header className="hms-public-header">
      <Link href="/" className="hms-public-logo">
        {brandLabel}
      </Link>
      <nav className="hms-public-nav" aria-label="Book">
        <Link href="/book">Book</Link>
        <Link href="/book/hotels">Hotels</Link>
        <Link href="/book/me">My trips</Link>
        <Link href="/book/lookup">Find booking</Link>
        {staffHotel && <span className="hms-public-nav-accent">Staff signed in</span>}
        {user && isSuperAdmin(user) && (
          <Link href="/platform/hotels" className="hms-public-nav-accent">
            Platform
          </Link>
        )}
      </nav>
      <div className="hms-public-actions">
        {user ? (
          <>
            {guestHotel && (
              <Link href={`/book/hotels/${viewedHotelId ?? guestHotel}`} className="hms-btn-outline">
                This hotel
              </Link>
            )}
            <button type="button" className="hms-btn-solid" onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link href="/book/register" className="hms-btn-outline">
              Sign up
            </Link>
            <Link href="/login" className="hms-btn-solid">
              Log in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
