"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSuperAdmin, loadAuthUser } from "@/lib/auth";

const envHotel = process.env.NEXT_PUBLIC_DEFAULT_HOTEL_ID?.trim() ?? "";

export function HomeLinks() {
  const [hotelId, setHotelId] = useState(envHotel);
  const [showPlatform, setShowPlatform] = useState(false);

  useEffect(() => {
    if (envHotel) {
      setShowPlatform(isSuperAdmin(loadAuthUser()));
      return;
    }
    setHotelId(localStorage.getItem("hms_hotel_id") ?? "");
    setShowPlatform(isSuperAdmin(loadAuthUser()));
  }, []);

  return (
    <ul className="landing-link-list">
      <li>
        <Link href="/setup">Setup docs</Link>
      </li>
      {showPlatform && (
        <li>
          <Link href="/platform/hotels">Platform (super admin)</Link>
        </li>
      )}
      <li>
        {hotelId ? (
          <Link href="/app">Hotel workspace (all modules)</Link>
        ) : (
          <p className="landing-hint">
            After you sign in as hotel staff, your dashboard link appears here automatically. You can also set{" "}
            <code>NEXT_PUBLIC_DEFAULT_HOTEL_ID</code> for a fixed shortcut in dev.
          </p>
        )}
      </li>
    </ul>
  );
}
