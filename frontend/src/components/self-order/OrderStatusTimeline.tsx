"use client";

import type { TrackOrderResponse } from "@/lib/selfOrderApi";
import { formatTime } from "@/components/self-order/selfOrderGuestUtils";

export function OrderStatusTimeline({ data }: { data: TrackOrderResponse }) {
  const st = data.status;
  const unpaid = data.paymentStatus === "UNPAID";
  const paid = !unpaid;
  const dine = data.serviceType === "DINE_IN";

  if (st === "CANCELLED") {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-100 text-center">
        This order was cancelled.
      </div>
    );
  }

  const step2Done = paid && (st === "IN_PROGRESS" || st === "READY" || st === "COMPLETED");
  const step2Pending = !step2Done;
  const step2Sub = unpaid
    ? "Pay at counter (or use demo pay) so the kitchen can start."
    : st === "PLACED"
      ? "Waiting for kitchen to start."
      : st === "IN_PROGRESS"
        ? "Est. 12–18 minutes"
        : "Prepared";

  const step3Done = st === "READY" || st === "COMPLETED";
  const step3Pending = paid && !step3Done && st === "IN_PROGRESS";

  const step4Done = st === "COMPLETED";
  const step4Pending = paid && !step4Done && st === "READY";

  const who = (data.pickupDisplayName ?? "").trim();
  const loc = (data.pickupLocation ?? "").trim();
  const step3Sub =
    dine && loc
      ? `Deliver / find table ${loc}. Listen for ${who || "your"} order — code ${data.displayCode}.`
      : dine
        ? `Listen for ${who || "guest"} — code ${data.displayCode}.`
        : who
          ? `Listen for ${who} — order ${data.displayCode}.`
          : `Pick up when code ${data.displayCode} is called.`;

  const steps: { title: string; sub: string; done: boolean; pending: boolean }[] = [
    {
      title: "Order placed",
      sub: `Received at ${formatTime(data.createdAt)}`,
      done: true,
      pending: false,
    },
    {
      title: "Kitchen preparing",
      sub: step2Sub,
      done: step2Done,
      pending: step2Pending,
    },
    {
      title: "Ready for pickup",
      sub: step3Sub,
      done: step3Done,
      pending: step3Pending,
    },
    {
      title: "Served",
      sub: "Enjoy your meal!",
      done: step4Done,
      pending: step4Pending,
    },
  ];

  return (
    <ol className="relative pl-6 sm:pl-8 space-y-5 sm:space-y-8 border-l border-zinc-800 ml-2 sm:ml-3 text-left">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span
            className={`absolute -left-[21px] sm:-left-[25px] top-0 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border-2 text-[10px] sm:text-xs ${
              s.done
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                : s.pending
                  ? "border-amber-600/60 bg-zinc-900 text-amber-500/90"
                  : "border-zinc-700 bg-zinc-900 text-zinc-600"
            }`}
          >
            {s.done ? "✓" : i + 1}
          </span>
          <p className={`font-semibold ${s.done ? "text-white" : s.pending ? "text-zinc-200" : "text-zinc-500"}`}>{s.title}</p>
          <p className="text-sm text-zinc-500 mt-1">{s.sub}</p>
        </li>
      ))}
    </ol>
  );
}
