"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type SubscriptionStatus = {
  hotelId: string;
  hotelName: string;
  billingStatus: string;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  daysRemaining?: number | null;
  suspended: boolean;
  manuallyBlocked: boolean;
  manualBlockReason?: string | null;
  lastPaymentConfirmedAt?: string | null;
  monthlyPrice?: number | null;
  currency?: string | null;
};

function money(value?: number | null, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}

function prettyDate(value?: string | null) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function HotelSubscriptionPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<SubscriptionStatus>(`/api/v1/hotels/${hotelId}/subscription-status`);
        if (!cancelled) {
          setSubscription(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load subscription billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const currency = subscription?.currency || "USD";
  const amountDue = subscription?.monthlyPrice ?? 0;
  const health = useMemo(() => {
    if (!subscription) return { label: "Loading", className: "bg-slate-100 text-slate-700", note: "" };
    if (subscription.manuallyBlocked) {
      return {
        label: "Manually blocked",
        className: "bg-red-100 text-red-700",
        note: subscription.manualBlockReason || "Contact the platform team to resolve the hold.",
      };
    }
    if (subscription.suspended || subscription.billingStatus === "EXPIRED") {
      return { label: "Expired", className: "bg-red-100 text-red-700", note: "Renewal is required to keep hotel access open." };
    }
    if ((subscription.daysRemaining ?? 999) <= 15) {
      return { label: "Due soon", className: "bg-amber-100 text-amber-700", note: "Prepare payment before the renewal date." };
    }
    return { label: "Active", className: "bg-emerald-100 text-emerald-700", note: "Your hotel account is in good standing." };
  }, [subscription]);

  if (loading) {
    return <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-soft">Loading subscription billing...</div>;
  }

  if (error || !subscription) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
        {error || "Subscription billing is not available for this hotel."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>{health.label}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Subscription billing</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              View what your hotel owes for the HMS platform, the next renewal date, and payment status. Platform admins confirm payments and renew access after payment is received.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Mini label="Amount to pay" value={money(amountDue, currency)} />
              <Mini label="Next billing" value={prettyDate(subscription.subscriptionEndDate)} />
              <Mini label="Days remaining" value={subscription.daysRemaining == null ? "n/a" : `${subscription.daysRemaining} days`} />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
            <p className="text-sm font-semibold">Payment guidance</p>
            <p className="mt-3 text-sm text-muted-foreground">{health.note}</p>
            <div className="mt-5 space-y-3 text-sm">
              <Row label="Hotel" value={subscription.hotelName} />
              <Row label="Billing status" value={subscription.billingStatus.replaceAll("_", " ")} />
              <Row label="Last payment" value={prettyDate(subscription.lastPaymentConfirmedAt)} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold">What happens next?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pay the platform subscription before the next billing date. Once the platform admin confirms it, your subscription expiry is extended automatically.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold">If payment is late</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Access becomes restricted after expiry. The system is designed to fail closed so hotel data stays protected until renewal is confirmed.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <p className="text-sm font-semibold">Need support?</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Contact the platform billing team with your hotel name and payment reference so they can confirm the renewal quickly.
          </p>
        </div>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
