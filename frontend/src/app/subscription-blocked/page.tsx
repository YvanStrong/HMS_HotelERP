"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

export default function SubscriptionBlockedPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-10 text-white">
          <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center text-sm text-white/70">
            Loading…
          </div>
        </main>
      }
    >
      <SubscriptionBlockedContent />
    </Suspense>
  );
}

function SubscriptionBlockedContent() {
  const params = useSearchParams();
  const code = params.get("code") || "SUBSCRIPTION_BLOCKED";
  const reason = params.get("reason") || "ACCESS_BLOCKED";
  const message = params.get("message") || "This hotel subscription is suspended.";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center">
        <section className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/95 text-slate-950 shadow-2xl">
          <div className="border-b border-slate-200 bg-gradient-to-r from-red-50 to-amber-50 p-6">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-700">Subscription Access Control</p>
            <h1 className="mt-3 text-3xl font-black">Hotel access is currently suspended</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
          <div className="space-y-5 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard label="Status code" value={code} />
              <InfoCard label="Reason" value={reason} />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="font-bold">What to do next</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Please contact the platform administrator or billing team. Access can only be restored after a platform admin confirms payment and renews the subscription.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                Back to Login
              </Link>
              <a href="mailto:support@hotelerp.local" className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Contact Support
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}
