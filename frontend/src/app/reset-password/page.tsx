"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordRedirectInner() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const token = search.get("token");
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    router.replace(`/login/reset-password${qs}`);
  }, [router, search]);

  return null;
}

export default function ResetPasswordRedirectPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordRedirectInner />
    </Suspense>
  );
}

