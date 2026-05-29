"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

type RevenueMetrics = {
  totalRevenue: number;
  totalReservations: number;
  averageBookingValue: number;
  revenueByHotel?: { hotelName: string; revenue: number; reservations: number }[];
  revenueByMonth?: { month: string; revenue: number }[];
  topPerformingHotels?: { hotelName: string; revenue: number; growth: number }[];
};

type PlatformRevenueApi = {
  revenue?: {
    mrr?: number;
    arr?: number;
    ltv?: number;
    churnRate?: number;
  };
  byTier?: {
    tier: string;
    tenants: number;
    mrr: number;
    avgRevenuePerTenant: number;
    churnRisk: number;
  }[];
};

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

export default function PlatformAnalyticsPage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");
  const [subscriptions, setSubscriptions] = useState<SubscriptionAnalytics | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        const [raw, subscriptionRaw] = await Promise.all([
          apiFetch<PlatformRevenueApi>(`/api/v1/platform/analytics/revenue?period=${period}&groupBy=tier`),
          apiFetch<SubscriptionAnalytics>("/api/v1/platform/analytics/subscriptions"),
        ]);
        const byTier = raw.byTier ?? [];
        const totalTenants = byTier.reduce((sum, row) => sum + (row.tenants ?? 0), 0);
        const totalMrr = Number(raw.revenue?.mrr ?? 0);
        const normalized: RevenueMetrics = {
          totalRevenue: totalMrr,
          totalReservations: totalTenants,
          averageBookingValue: totalTenants > 0 ? totalMrr / totalTenants : 0,
          revenueByHotel: byTier.map((row) => ({
            hotelName: row.tier,
            revenue: Number(row.mrr ?? 0),
            reservations: Number(row.tenants ?? 0),
          })),
          topPerformingHotels: byTier
            .slice()
            .sort((a, b) => Number(b.mrr ?? 0) - Number(a.mrr ?? 0))
            .slice(0, 3)
            .map((row) => ({
              hotelName: row.tier,
              revenue: Number(row.mrr ?? 0),
              growth: Number(row.churnRisk ?? 0) * -1,
            })),
        };
        if (!cancelled) {
          setError(null);
          setMetrics(normalized);
          setSubscriptions(subscriptionRaw);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load analytics");
          setMetrics(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatDays = (value: number | string) => {
    if (value === "n/a") return "n/a";
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || Math.abs(numeric) > 1000000) return "n/a";
    return `${numeric} day${numeric === 1 ? "" : "s"}`;
  };

  const topHotelRevenue = useMemo(() => {
    if (!metrics?.revenueByHotel?.length) return 0;
    return Math.max(...metrics.revenueByHotel.map((h) => h.revenue));
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Revenue Analytics</h1>
          <p className="text-muted-foreground mt-1">
            SaaS revenue metrics and tenant distribution across the platform
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="w-40"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border/60 p-6 animate-pulse">
              <div className="h-8 bg-muted rounded w-1/2 mb-2" />
              <div className="h-12 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">KPI period</p>
              <p className="mt-2 text-lg font-semibold capitalize">{period}</p>
            </div>
            <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Hotels with revenue</p>
              <p className="mt-2 text-lg font-semibold">{metrics.revenueByHotel?.length ?? 0}</p>
            </div>
            <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Top hotel revenue</p>
              <p className="mt-2 text-lg font-semibold">{formatCurrency(topHotelRevenue)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue concentration</p>
              <p className="mt-2 text-lg font-semibold">
                {metrics.totalRevenue > 0 ? `${Math.round((topHotelRevenue / metrics.totalRevenue) * 100)}%` : "0%"}
              </p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">Total Revenue</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(metrics?.totalRevenue ?? 0)}</p>
            </div>

            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">Active Tenants</span>
              </div>
              <p className="text-3xl font-bold">{(metrics?.totalReservations ?? 0).toLocaleString()}</p>
            </div>

            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <span className="text-sm text-muted-foreground">Avg. Revenue per Tenant</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(metrics?.averageBookingValue ?? 0)}</p>
            </div>
          </div>

          {subscriptions?.summary && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Subscription collections</h2>
                  <p className="text-sm text-muted-foreground">
                    Platform billing control room: collected payments, monthly dues, expiring tenants, and suspended accounts.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {subscriptions.summary.tenantCount ?? 0} tenants tracked
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Collected" value={formatCurrency(Number(subscriptions.summary.totalCollected ?? 0))} />
                <MiniStat label="Monthly due" value={formatCurrency(Number(subscriptions.summary.monthlyDue ?? 0))} />
                <MiniStat label="Expiring soon" value={String(subscriptions.summary.expiringSoon ?? 0)} />
                <MiniStat label="Expired" value={String(subscriptions.summary.expired ?? 0)} />
                <MiniStat label="Manual blocks" value={String(subscriptions.summary.manuallyBlocked ?? 0)} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 p-4">
                  <h3 className="text-sm font-semibold">Due / blocked watchlist</h3>
                  <div className="mt-3 space-y-2">
                    {(subscriptions.dueTenants ?? []).slice(0, 6).map((tenant) => (
                      <div key={tenant.hotelId} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{tenant.hotelName}</p>
                          <p className="text-xs text-muted-foreground">{tenant.status.replaceAll("_", " ")} | {tenant.expiryDate || "No expiry"} | {formatDays(tenant.daysRemaining)}</p>
                        </div>
                        <span className="font-semibold">{formatCurrency(Number(tenant.monthlyPrice ?? 0))}</span>
                      </div>
                    ))}
                    {!(subscriptions.dueTenants ?? []).length && (
                      <p className="text-sm text-muted-foreground">No expiring or blocked tenants right now.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <h3 className="text-sm font-semibold">Recent confirmed payments</h3>
                  <div className="mt-3 space-y-2">
                    {(subscriptions.recentPayments ?? []).slice(0, 6).map((payment) => (
                      <div key={`${payment.hotelId}-${payment.confirmedAt}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">{payment.monthsPaid} month renewal</p>
                          <p className="text-xs text-muted-foreground">{new Date(payment.confirmedAt).toLocaleDateString()} {payment.paymentReference ? `| ${payment.paymentReference}` : ""}</p>
                        </div>
                        <span className="font-semibold">{formatCurrency(Number(payment.amount ?? 0))}</span>
                      </div>
                    ))}
                    {!(subscriptions.recentPayments ?? []).length && (
                      <p className="text-sm text-muted-foreground">No confirmed subscription payments yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Revenue by Hotel */}
          {metrics.revenueByHotel && metrics.revenueByHotel.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <h2 className="text-lg font-semibold mb-4">Revenue by Hotel</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-3 py-2 text-sm font-medium">Tier</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">Tenants</th>
                      <th className="text-left px-3 py-2 text-sm font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {metrics.revenueByHotel.map((hotel) => (
                      <tr key={hotel.hotelName} className="hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2 text-sm font-medium">{hotel.hotelName}</td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">{hotel.reservations.toLocaleString()}</td>
                        <td className="px-3 py-2 text-sm font-semibold">{formatCurrency(hotel.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top Performing Hotels */}
          {metrics.topPerformingHotels && metrics.topPerformingHotels.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <h2 className="text-lg font-semibold mb-4">Top Performing Hotels</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {metrics.topPerformingHotels.map((hotel) => (
                  <div key={hotel.hotelName} className="p-4 border border-border/60 rounded-lg">
                    <p className="font-medium">{hotel.hotelName}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold">{formatCurrency(hotel.revenue)}</span>
                      <span className={`text-sm font-medium ${hotel.growth >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {hotel.growth >= 0 ? "+" : ""}{hotel.growth}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">No analytics data</h3>
          <p className="text-muted-foreground">Analytics API may not be configured on this server</p>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}
