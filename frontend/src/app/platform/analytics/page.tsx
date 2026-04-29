"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

type RevenueMetrics = {
  totalRevenue: number;
  totalReservations: number;
  averageBookingValue: number;
  revenueByHotel?: { hotelName: string; revenue: number; reservations: number }[];
  revenueByMonth?: { month: string; revenue: number }[];
  topPerformingHotels?: { hotelName: string; revenue: number; growth: number }[];
};

export default function PlatformAnalyticsPage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        const data = await apiFetch<RevenueMetrics>(
          `/api/v1/platform/analytics/revenue?period=${period}&groupBy=tier`,
        );
        if (!cancelled) setMetrics(data);
      } catch (e) {
        // API might not exist, show empty state
        if (!cancelled) setMetrics(null);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Revenue Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Revenue metrics and reporting across all tenants
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
                <span className="text-sm text-muted-foreground">Total Reservations</span>
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
                <span className="text-sm text-muted-foreground">Avg. Booking Value</span>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(metrics?.averageBookingValue ?? 0)}</p>
            </div>
          </div>

          {/* Revenue by Hotel */}
          {metrics.revenueByHotel && metrics.revenueByHotel.length > 0 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
              <h2 className="text-lg font-semibold mb-4">Revenue by Hotel</h2>
              <div className="space-y-3">
                {metrics.revenueByHotel.map((hotel) => (
                  <div key={hotel.hotelName} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{hotel.hotelName}</p>
                      <p className="text-sm text-muted-foreground">{hotel.reservations} reservations</p>
                    </div>
                    <p className="font-bold text-lg">{formatCurrency(hotel.revenue)}</p>
                  </div>
                ))}
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
