"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type SubscriptionAnalytics = {
  summary?: {
    totalCollected?: number;
    monthlyDue?: number;
    expiringSoon?: number;
    expired?: number;
    manuallyBlocked?: number;
    tenantCount?: number;
  };
  dueTenants?: {
    hotelId: string;
    hotelName: string;
    status: string;
    daysRemaining: number | string;
    expiryDate: string;
    monthlyPrice: number;
  }[];
  recentPayments?: {
    hotelId: string;
    monthsPaid: number;
    amount: number;
    currency: string;
    paymentReference: string;
    confirmedAt: string;
  }[];
};

function money(value?: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(value ?? 0));
}

function formatDays(value: number | string) {
  if (value === "n/a") return "n/a";
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > 1000000) return "n/a";
  return `${numeric} day${numeric === 1 ? "" : "s"}`;
}

export default function PlatformSubscriptionsPage() {
  const [data, setData] = useState<SubscriptionAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void loadData(cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = data?.summary;

  async function loadData(cancelled = false) {
    try {
      const raw = await apiFetch<SubscriptionAnalytics>("/api/v1/platform/analytics/subscriptions");
      if (!cancelled) {
        setData(raw);
        setError(null);
      }
    } catch (e) {
      if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load subscription analytics");
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  async function renewTenant(tenantId: string) {
    const months = Number(renewMonths[tenantId] || "1");
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/renew`, {
        method: "POST",
        body: JSON.stringify({ months, note: "Subscription enabled from platform billing control room" }),
        quiet: true,
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable or renew this hotel subscription.");
    } finally {
      setBusyTenant(null);
    }
  }

  async function unblockTenant(tenantId: string) {
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/unblock`, {
        method: "POST",
        body: JSON.stringify({ note: "Manual unblock from platform billing control room" }),
        quiet: true,
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unblock this tenant. Expired tenants must be renewed first.");
    } finally {
      setBusyTenant(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Platform billing</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">Subscription control room</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Track collected platform subscription payments, expected monthly due, expiring tenants, expired accounts, and manual blocks in one place.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
            <span className="text-muted-foreground">Tenants tracked</span>
            <strong className="ml-2">{summary?.tenantCount ?? 0}</strong>
          </div>
        </div>
      </section>

      {loading && <div className="rounded-2xl border border-border/60 bg-card p-6">Loading subscription billing...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">{error}</div>}

      {summary && (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Collected total" value={money(summary.totalCollected)} tone="emerald" />
            <Metric label="Monthly due" value={money(summary.monthlyDue)} tone="blue" />
            <Metric label="Expiring soon" value={String(summary.expiringSoon ?? 0)} tone="amber" />
            <Metric label="Expired" value={String(summary.expired ?? 0)} tone="red" />
            <Metric label="Manual blocks" value={String(summary.manuallyBlocked ?? 0)} tone="slate" />
          </section>

          <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-lg font-semibold">Due, expiring, and blocked tenants</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose a renewal period and enable access directly from this list.</p>
              <div className="mt-4 divide-y divide-border/60">
                {(data?.dueTenants ?? []).map((tenant) => (
                  <div key={tenant.hotelId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{tenant.hotelName}</p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.status.replaceAll("_", " ")} | {tenant.expiryDate || "No expiry"} | {formatDays(tenant.daysRemaining)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold">{money(Number(tenant.monthlyPrice ?? 0))}</span>
                      <select
                        className="h-9 w-32 rounded-lg border border-border bg-background px-2 text-sm"
                        value={renewMonths[tenant.hotelId] ?? "1"}
                        onChange={(event) => setRenewMonths((prev) => ({ ...prev, [tenant.hotelId]: event.target.value }))}
                      >
                        <option value="1">1 month</option>
                        <option value="3">3 months</option>
                        <option value="6">6 months</option>
                        <option value="12">12 months</option>
                      </select>
                      <button
                        type="button"
                        className="hms-btn-solid text-sm"
                        disabled={busyTenant === tenant.hotelId}
                        onClick={() => void renewTenant(tenant.hotelId)}
                      >
                        {tenant.status === "EXPIRED" ? "Enable / Renew" : "Renew"}
                      </button>
                      {tenant.status === "MANUALLY_BLOCKED" && (
                        <button
                          type="button"
                          className="hms-btn-outline text-sm"
                          disabled={busyTenant === tenant.hotelId}
                          onClick={() => void unblockTenant(tenant.hotelId)}
                        >
                          Unblock
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!(data?.dueTenants ?? []).length && <p className="py-4 text-sm text-muted-foreground">No due or blocked tenants right now.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
              <h2 className="text-lg font-semibold">Recent collections</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest payment confirmations recorded by platform admins.</p>
              <div className="mt-4 space-y-3">
                {(data?.recentPayments ?? []).map((payment) => (
                  <div key={`${payment.hotelId}-${payment.confirmedAt}`} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{payment.monthsPaid} month renewal</p>
                      <p className="font-bold">{money(Number(payment.amount ?? 0), payment.currency || "USD")}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(payment.confirmedAt).toLocaleString()} {payment.paymentReference ? `| Ref ${payment.paymentReference}` : ""}
                    </p>
                  </div>
                ))}
                {!(data?.recentPayments ?? []).length && <p className="text-sm text-muted-foreground">No subscription payments confirmed yet.</p>}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "emerald" | "blue" | "amber" | "red" | "slate" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  }[tone];
  return (
    <div className={`rounded-2xl border p-5 shadow-soft ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </div>
  );
}
