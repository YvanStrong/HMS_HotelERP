"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo, Suspense } from "react";
import { KitchenBoardPanel } from "@/components/self-order/KitchenBoardPanel";

function ScreenInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const boardKey = useMemo(() => searchParams.get("key")?.trim() || "", [searchParams]);

  return (
    <KitchenBoardPanel
      hotelId={hotelId}
      boardKey={boardKey || undefined}
      fillViewport
      title="Kitchen display — live orders"
    />
  );
}

export default function SelfOrderBigScreenPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-lg">Loading…</div>
      }
    >
      <ScreenInner />
    </Suspense>
  );
}
