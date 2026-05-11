"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAuthUser } from "@/lib/auth";

export default function AppSettingsPage() {
  const router = useRouter();
  useEffect(() => {
    const user = loadAuthUser();
    if (!user?.hotelId) {
      router.replace("/login");
      return;
    }
    router.replace(`/hotels/${user.hotelId}/settings`);
  }, [router]);
  return null;
}

