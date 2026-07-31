"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type PlanOption = {
  tier: string;
  label: string;
  monthlyPrice: number;
  maxRooms: number;
  maxUsers: number;
};

type RenewQuote = { months: number; amount: number; newExpiryDate: string };
type UpgradeQuote = {
  targetTier: string;
  label: string;
  monthlyPrice: number;
  proratedAmountDue: number;
  daysRemaining: number;
  note: string;
};

type BillingRequest = {
  id: string;
  requestType: string;
  targetTier?: string | null;
  months?: number | null;
  quotedAmount: number;
  currency?: string | null;
  paymentReference?: string | null;
  status: string;
  requestedAt?: string | null;
};

type SubscriptionStatus = {
  hotelId: string;
  hotelName: string;
  billingStatus: string;
  tier?: string | null;
  subscriptionStartDate?: string | null;
  subscriptionEndDate?: string | null;
  daysRemaining?: number | null;
  suspended: boolean;
  manuallyBlocked: boolean;
  manualBlockReason?: string | null;
  lastPaymentConfirmedAt?: string | null;
  monthlyPrice?: number | null;
  currency?: string | null;
  availablePlans?: PlanOption[];
  renewQuotes?: RenewQuote[];
  upgradeQuotes?: UpgradeQuote[];
  pendingRequests?: BillingRequest[];
};

function money(value?: number | null, currency = "RWF") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(
      Number(value ?? 0),
    );
  } catch {
    return `${currency} ${Number(value ?? 0).toLocaleString()}`;
  }
}

function prettyDate(value?: string | null) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function HotelSubscriptionPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renewMonths, setRenewMonths] = useState(1);
  const [upgradeTier, setUpgradeTier] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const data = await apiFetch<SubscriptionStatus>(`/api/v1/hotels/${hotelId}/subscription-status`);
    setSubscription(data);
    setUpgradeTier((prev) => prev || data.upgradeQuotes?.[0]?.targetTier || "");
    return data;
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load subscription billing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const currency = subscription?.currency || "RWF";
  const renewQuote = subscription?.renewQuotes?.find((q) => q.months === renewMonths);
  const upgradeQuote = subscription?.upgradeQuotes?.find((q) => q.targetTier === upgradeTier);

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
      return { label: "Expired", className: "bg-red-100 text-red-700", note: "Submit a renewal request to restore access." };
    }
    if ((subscription.daysRemaining ?? 999) <= 15) {
      return {
        label: "Due soon",
        className: "bg-amber-100 text-amber-700",
        note: "You can renew or upgrade now — no need to wait for expiry.",
      };
    }
    return {
      label: "Active",
      className: "bg-emerald-100 text-emerald-700",
      note: "Renew early or upgrade mid-cycle anytime. Upgrades are prorated for remaining days.",
    };
  }, [subscription]);

  async function submitRequest(requestType: "RENEW" | "UPGRADE") {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const body =
        requestType === "RENEW"
          ? { requestType, months: renewMonths, paymentReference: paymentRef || null, note: note || null }
          : {
              requestType,
              targetTier: upgradeTier,
              paymentReference: paymentRef || null,
              note: note || null,
            };
      const updated = await apiFetch<SubscriptionStatus>(`/api/v1/hotels/${hotelId}/subscription/billing-request`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSubscription(updated);
      setPaymentRef("");
      setNote("");
      setMessage(
        requestType === "RENEW"
          ? "Renewal request submitted. Platform admin will confirm payment and extend your subscription."
          : "Upgrade request submitted with prorated amount. Platform admin will confirm payment and apply the new plan.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit billing request");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-border/60 bg-card p-8 shadow-soft">Loading subscription billing...</div>;
  }

  if (error && !subscription) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-800">
        {error}
      </div>
    );
  }

  if (!subscription) return null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${health.className}`}>{health.label}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Subscription billing</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Renew or upgrade at any time in the billing cycle. Upgrades charge only the prorated difference for days left;
              platform admins confirm payment to apply changes.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Mini label="Current plan" value={subscription.tier?.replaceAll("_", " ") || "STARTER"} />
              <Mini label="Monthly price" value={money(subscription.monthlyPrice, currency)} />
              <Mini label="Days remaining" value={subscription.daysRemaining == null ? "n/a" : `${subscription.daysRemaining} days`} />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-5">
            <p className="text-sm font-semibold">Payment guidance</p>
            <p className="mt-3 text-sm text-muted-foreground">{health.note}</p>
            <div className="mt-5 space-y-3 text-sm">
              <Row label="Hotel" value={subscription.hotelName} />
              <Row label="Billing status" value={subscription.billingStatus.replaceAll("_", " ")} />
              <Row label="Next billing" value={prettyDate(subscription.subscriptionEndDate)} />
              <Row label="Last payment" value={prettyDate(subscription.lastPaymentConfirmedAt)} />
            </div>
          </div>
        </div>
      </section>

      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <h2 className="text-lg font-bold">Renew now</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Extend from your current expiry (or today if already expired). Available mid-cycle.
          </p>
          <label className="mt-4 block text-sm font-medium">Period</label>
          <select className="mt-1 w-full" value={renewMonths} onChange={(e) => setRenewMonths(Number(e.target.value))}>
            {(subscription.renewQuotes ?? []).map((q) => (
              <option key={q.months} value={q.months}>
                {q.months} month{q.months > 1 ? "s" : ""} — {money(q.amount, currency)} (new expiry {prettyDate(q.newExpiryDate)})
              </option>
            ))}
          </select>
          <p className="mt-3 text-sm">
            Amount due: <strong>{money(renewQuote?.amount, currency)}</strong>
          </p>
          <button
            type="button"
            className="hms-btn-solid mt-4"
            disabled={busy || subscription.manuallyBlocked}
            onClick={() => void submitRequest("RENEW")}
          >
            {busy ? "Submitting…" : "Request renewal"}
          </button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <h2 className="text-lg font-bold">Upgrade plan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch to a higher plan immediately. You pay only the prorated difference for remaining days; expiry stays the same.
          </p>
          {(subscription.upgradeQuotes?.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">You are already on the highest plan.</p>
          ) : (
            <>
              <label className="mt-4 block text-sm font-medium">New plan</label>
              <select className="mt-1 w-full" value={upgradeTier} onChange={(e) => setUpgradeTier(e.target.value)}>
                {(subscription.upgradeQuotes ?? []).map((q) => (
                  <option key={q.targetTier} value={q.targetTier}>
                    {q.label} — {money(q.monthlyPrice, currency)}/mo · upgrade due {money(q.proratedAmountDue, currency)}
                  </option>
                ))}
              </select>
              {upgradeQuote && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                  <p className="font-semibold">Prorated amount due: {money(upgradeQuote.proratedAmountDue, currency)}</p>
                  <p className="mt-1 text-sky-800">{upgradeQuote.note}</p>
                </div>
              )}
              <button
                type="button"
                className="hms-btn-solid mt-4"
                disabled={busy || !upgradeTier || subscription.manuallyBlocked}
                onClick={() => void submitRequest("UPGRADE")}
              >
                {busy ? "Submitting…" : "Request upgrade"}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Payment reference</h2>
        <p className="mt-1 text-sm text-muted-foreground">Optional — include bank / MoMo reference so admin can match your payment.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Payment reference
            <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="e.g. TXN-12345" />
          </label>
          <label className="text-sm">
            Note
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note for billing team" />
          </label>
        </div>
      </section>

      {(subscription.pendingRequests?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">Pending requests</h2>
          <ul className="mt-3 space-y-2 text-sm text-amber-950">
            {subscription.pendingRequests!.map((r) => (
              <li key={r.id} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                <strong>{r.requestType}</strong>
                {r.targetTier ? ` → ${r.targetTier}` : r.months ? ` · ${r.months} mo` : ""} ·{" "}
                {money(r.quotedAmount, r.currency || currency)}
                {r.paymentReference ? ` · ref ${r.paymentReference}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        {(subscription.availablePlans ?? []).map((plan) => (
          <div
            key={plan.tier}
            className={`rounded-2xl border p-5 shadow-soft ${
              plan.tier === subscription.tier ? "border-primary bg-primary/5" : "border-border/60 bg-card"
            }`}
          >
            <p className="text-sm font-semibold">{plan.label}</p>
            <p className="mt-2 text-2xl font-bold">{money(plan.monthlyPrice, currency)}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Up to {plan.maxRooms} rooms · {plan.maxUsers} users
            </p>
            {plan.tier === subscription.tier && (
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">Current plan</p>
            )}
          </div>
        ))}
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
