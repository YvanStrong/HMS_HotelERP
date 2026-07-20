"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { staffAppPath } from "@/lib/staffAppRoutes";

/** Legacy route — unified into Dashboard. */
export default function HotelReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(staffAppPath("dashboard"));
  }, [router]);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
      Redirecting to dashboard…
    </div>
  );
}
