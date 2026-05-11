"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { KitchenBoardPanel } from "@/components/self-order/KitchenBoardPanel";
import { useSelfOrderGuestMeta } from "@/components/self-order/SelfOrderGuestMetaContext";

export default function SelfOrderGuestKitchenPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const boardKeyFromUrl = searchParams.get("key")?.trim() || "";
  const { boardKeyConfigured } = useSelfOrderGuestMeta();

  const boardKey = useMemo(
    () => (boardKeyConfigured ? boardKeyFromUrl || undefined : undefined),
    [boardKeyConfigured, boardKeyFromUrl],
  );

  return (
    <main className="flex-1 py-4 sm:py-6 px-2 sm:px-4 space-y-3 max-w-7xl mx-auto w-full">
      {boardKeyConfigured && !boardKeyFromUrl && (
        <p className="text-xs text-amber-200/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2">
          Add <code className="text-amber-100">?key=…</code> to this page URL (same secret as the kitchen TV) to load live tickets.
        </p>
      )}
      <KitchenBoardPanel hotelId={hotelId} boardKey={boardKey} fillViewport={false} />
    </main>
  );
}
