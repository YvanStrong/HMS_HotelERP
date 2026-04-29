"use client";

import { useEffect } from "react";
import { getToken } from "@/lib/api";
import { isSuperAdmin, loadAuthUser } from "@/lib/auth";
import { writeSessionCookies } from "@/lib/sessionCookies";

/** Syncs middleware hint cookies when a session exists in localStorage (e.g. after deploy or legacy tab). */
export function AuthCookieSync() {
  useEffect(() => {
    if (!getToken()) return;
    const u = loadAuthUser();
    if (u) {
      writeSessionCookies({
        role: u.role,
        hotelId: u.hotelId,
        platformAdmin: isSuperAdmin(u),
      });
    }
  }, []);
  return null;
}
