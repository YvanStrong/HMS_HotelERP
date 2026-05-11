"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { SelfOrderGuestMetaProvider } from "@/components/self-order/SelfOrderGuestMetaContext";
import { SelfOrderGuestShell } from "@/components/self-order/SelfOrderGuestShell";

function BookOrderGuestLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const hotelId = String(params.hotelId);
  return (
    <SelfOrderGuestMetaProvider hotelId={hotelId}>
      <SelfOrderGuestShell>{children}</SelfOrderGuestShell>
    </SelfOrderGuestMetaProvider>
  );
}

export default function BookOrderGuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-zinc-950 text-zinc-500 flex items-center justify-center px-4">Loading…</div>
      }
    >
      <BookOrderGuestLayoutInner>{children}</BookOrderGuestLayoutInner>
    </Suspense>
  );
}
