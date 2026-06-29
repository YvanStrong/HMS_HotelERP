"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { staffAppPath } from "@/lib/staffAppRoutes";

/** Legacy route — guest metrics live on the unified Dashboard. */
export default function GuestAnalyticsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${staffAppPath("dashboard")}#rooms`);
  }, [router]);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
      Redirecting to dashboard…
    </div>
  );
}
