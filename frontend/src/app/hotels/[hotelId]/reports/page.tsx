"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  defaultRange,
  downloadReportExport,
  labelColumn,
  type GuestDashboard,
  type OccupancyReport,
  type TabularReport,
} from "@/lib/hotelReports";

type ReportKey = "occupancy" | "rooms" | "reservations" | "sales" | "guests";

const REPORT_TABS: { key: ReportKey; label: string; description: string; needsDates: boolean }[] = [
  {
    key: "occupancy",
    label: "Room occupancy",
    description: "Daily occupancy, ADR, and RevPAR",
    needsDates: true,
  },
  {
    key: "rooms",
    label: "Room inventory",
    description: "Current rooms by type, status, and cleanliness",
    needsDates: false,
  },
  {
    key: "reservations",
    label: "Reservations",
    description: "Bookings overlapping the selected period",
    needsDates: true,
  },
  {
    key: "sales",
    label: "Sales",
    description: "Daily room revenue, payments, and invoices",
    needsDates: true,
  },
  {
    key: "guests",
    label: "Guests",
    description: "Nationality mix, repeats, VIP, and stay metrics",
    needsDates: true,
  },
];

function cell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function HotelReportsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [active, setActive] = useState<ReportKey>("occupancy");
  const [range, setRange] = useState(defaultRange);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [tabular, setTabular] = useState<TabularReport | null>(null);
  const [guests, setGuests] = useState<GuestDashboard | null>(null);

  const tab = REPORT_TABS.find((t) => t.key === active)!;

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      if (active === "occupancy") {
        const data = await apiFetch<OccupancyReport>(
          `/api/v1/hotels/${hotelId}/reports/occupancy?startDate=${range.from}&endDate=${range.to}&groupBy=day`,
        );
        setOccupancy(data);
        setTabular(null);
        setGuests(null);
      } else if (active === "rooms") {
        const data = await apiFetch<TabularReport>(`/api/v1/hotels/${hotelId}/reports/rooms`);
        setTabular(data);
        setOccupancy(null);
        setGuests(null);
      } else if (active === "reservations") {
        const data = await apiFetch<TabularReport>(
          `/api/v1/hotels/${hotelId}/reports/reservations?fromDate=${range.from}&toDate=${range.to}`,
        );
        setTabular(data);
        setOccupancy(null);
        setGuests(null);
      } else if (active === "sales") {
        const data = await apiFetch<TabularReport>(
          `/api/v1/hotels/${hotelId}/reports/sales?fromDate=${range.from}&toDate=${range.to}`,
        );
        setTabular(data);
        setOccupancy(null);
        setGuests(null);
      } else {
        const data = await apiFetch<GuestDashboard>(
          `/api/v1/hotels/${hotelId}/reports/guests?fromDate=${range.from}&toDate=${range.to}`,
        );
        setGuests(data);
        setOccupancy(null);
        setTabular(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load report");
    } finally {
      setLoading(false);
    }
  }, [hotelId, active, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportReport(format: "xlsx" | "pdf" | "csv") {
    if (!hotelId) return;
    setExporting(format);
    setError(null);
    try {
      const q = new URLSearchParams({ format });
      if (tab.needsDates) {
        if (active === "occupancy") {
          q.set("startDate", range.from);
          q.set("endDate", range.to);
          q.set("groupBy", "day");
        } else {
          q.set("fromDate", range.from);
          q.set("toDate", range.to);
        }
      }
      const path =
        active === "occupancy"
          ? `/api/v1/hotels/${hotelId}/reports/occupancy/export?${q}`
          : `/api/v1/hotels/${hotelId}/reports/${active}/export?${q}`;
      const ext = format === "pdf" ? "pdf" : format === "csv" ? "csv" : "xlsx";
      await downloadReportExport(path, `${active}-report.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const summaryEntries = useMemo(() => {
    const summary =
      active === "occupancy"
        ? occupancy?.summary
        : active === "guests"
          ? {
              repeatGuests: guests?.repeatGuestCount,
              vipGuests: guests?.vipGuestCount,
              noShowRate: guests?.noShowRatePercent,
              avgStayNights: guests?.averageStayNights,
              avgLifetimeValue: guests?.averageGuestLifetimeValue,
              revenuePerGuest: guests?.revenuePerGuest,
            }
          : tabular?.summary;
    if (!summary) return [];
    return Object.entries(summary).filter(([, v]) => typeof v !== "object");
  }, [active, occupancy, tabular, guests]);

  const tableColumns =
    active === "occupancy"
      ? ["date", "totalRooms", "occupiedRooms", "occupancyRate", "adr", "revpar"]
      : active === "guests"
        ? ["nationality", "count", "percent"]
        : tabular?.columns ?? [];

  const tableRows: Record<string, unknown>[] =
    active === "occupancy"
      ? occupancy?.data ?? []
      : active === "guests"
        ? (guests?.nationalityDistribution as unknown as Record<string, unknown>[]) ?? []
        : tabular?.rows ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a report, set the date range, then export Excel or print a PDF.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActive(item.key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold">{tab.label}</h2>
            <p className="text-sm text-muted-foreground">{tab.description}</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            {tab.needsDates && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">From</span>
                  <input
                    type="date"
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    value={range.from}
                    onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">To</span>
                  <input
                    type="date"
                    className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                    value={range.to}
                    onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
                  />
                </label>
              </>
            )}
            <button type="button" className="hms-btn-outline" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
            <button
              type="button"
              className="hms-btn-solid"
              onClick={() => void exportReport("xlsx")}
              disabled={!!exporting}
            >
              {exporting === "xlsx" ? "Exporting…" : "Export Excel"}
            </button>
            <button
              type="button"
              className="hms-btn-outline"
              onClick={() => void exportReport("pdf")}
              disabled={!!exporting}
            >
              {exporting === "pdf" ? "Exporting…" : "Print PDF"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        {summaryEntries.length > 0 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryEntries.map(([key, value]) => (
              <div key={key} className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {labelColumn(key)}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{cell(value)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {tableColumns.map((col) => (
                  <th key={col} className="px-3 py-2 font-semibold">
                    {labelColumn(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={Math.max(tableColumns.length, 1)} className="px-3 py-8 text-center text-muted-foreground">
                    Loading report…
                  </td>
                </tr>
              ) : tableRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(tableColumns.length, 1)} className="px-3 py-8 text-center text-muted-foreground">
                    No rows for this period.
                  </td>
                </tr>
              ) : (
                tableRows.map((row, idx) => (
                  <tr key={idx} className="border-t border-border/70">
                    {tableColumns.map((col) => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap">
                        {cell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
