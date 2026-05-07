"use client";

import type { TrackOrderResponse } from "@/lib/selfOrderApi";

/** Prominent “we’ll call … · #code” strip for guest status and dedicated track links. */
export function SelfOrderPickupCallout({
  data,
  tableFromQr,
}: {
  data: TrackOrderResponse;
  tableFromQr?: string;
}) {
  const name = (data.pickupDisplayName ?? "").trim();
  const loc = (data.pickupLocation ?? "").trim();
  const dine = data.serviceType === "DINE_IN";
  const hint = (tableFromQr ?? "").trim();

  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 text-center space-y-1.5">
      <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-amber-200/75">When your order is ready</p>
      <p className="text-base sm:text-lg text-amber-50 leading-snug">
        We’ll call <strong className="text-white">{name || "your order"}</strong>
        <span className="text-zinc-400 font-normal"> · </span>
        <span className="font-mono tabular-nums">#{data.displayCode}</span>
      </p>
      {loc ? (
        <p className="text-xs text-amber-100/90">
          {dine ? "Table / seat" : "Location"}: {loc}
        </p>
      ) : null}
      {hint && !loc ? <p className="text-[11px] text-zinc-500">QR table hint: {hint}</p> : null}
    </div>
  );
}
