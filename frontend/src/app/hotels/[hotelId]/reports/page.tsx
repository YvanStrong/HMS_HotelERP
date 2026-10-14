"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import {
  defaultRange,
  downloadReportExport,
  labelColumn,
  type GuestDashboard,
  type OccupancyReport,
  type TabularReport,
} from "@/lib/hotelReports";

type ReportKey = "occupancy" | "rooms" | "reservations" | "sales" | "guests" | "zreport";

type ZReport = {
  businessDate: string;
  fromDate?: string;
  toDate?: string;
  hotelName: string;
  currency: string;
  totalSales: number;
  totalExpenses: number;
  costOfGoods: number;
  grossProfit: number;
  netProfit: number;
  openCredit: number;
  openDebt: number;
  posSales?: number;
  inventorySales?: number;
  creditSales?: number;
  bossEmails: string[];
};

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
    description: "POS sales plus inventory invoices, cost, expenses, and profit for each business day",
    needsDates: true,
  },
  {
    key: "guests",
    label: "Guests",
    description: "Nationality mix, repeats, VIP, and stay metrics",
    needsDates: true,
  },
  {
    key: "zreport",
    label: "Z Report",
    description: "Sales, expenses, profit, and company credit and debt for a day or a date range",
    needsDates: false,
  },
];

function isZeroish(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (typeof value === "boolean") return false;
  if (typeof value === "number") return !Number.isFinite(value) || value === 0;
  const s = String(value).trim().replace(/%/g, "");
  if (!s || s === "—" || s === "-") return true;
  const n = Number(s);
  return Number.isFinite(n) && n === 0;
}

function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

const PAGE_SIZE = 20;
const ROW_LABEL_KEYS = new Set([
  "date",
  "totalRooms",
  "nationality",
  "roomType",
  "roomNumber",
  "name",
  "code",
  "status",
]);

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
  const [page, setPage] = useState(1);
  const [zFrom, setZFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [zTo, setZTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [zReport, setZReport] = useState<ZReport | null>(null);
  const [zMsg, setZMsg] = useState<string | null>(null);
  const [zBusy, setZBusy] = useState<"pdf" | "email" | null>(null);

  const tab = REPORT_TABS.find((t) => t.key === active)!;

  const load = useCallback(async () => {
    if (!hotelId) return;
    if (active === "zreport") {
      setLoading(true);
      setError(null);
      setZMsg(null);
      try {
        const data = await apiFetch<ZReport>(`/api/v1/hotels/${hotelId}/accounting/z-report?date=${zDate}`);
        setZReport(data);
      } catch (e) {
        setZReport(null);
        setError(e instanceof Error ? e.message : "Could not load the Z Report");
      } finally {
        setLoading(false);
      }
      return;
    }
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
  }, [hotelId, active, range.from, range.to, zDate]);

  useEffect(() => {
    setPage(1);
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
    const hasActivity = Object.entries(summary).some(
      ([k, v]) => !/date|rooms/i.test(k) && typeof v !== "object" && !isZeroish(v),
    );
    return Object.entries(summary).filter(([key, v]) => {
      if (typeof v === "object") return false;
      if (/date|rooms/i.test(key) && !hasActivity) return false;
      return !isZeroish(v);
    });
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

  const visibleRows = useMemo(() => {
    if (active === "rooms") return tableRows;
    return tableRows.filter((row) =>
      tableColumns.some((col) => !ROW_LABEL_KEYS.has(col) && !isZeroish(row[col])),
    );
  }, [active, tableColumns, tableRows]);

  const paged = useMemo(() => paginateSlice(visibleRows, page, PAGE_SIZE), [visibleRows, page]);

  useEffect(() => {
    setPage(1);
  }, [active, range.from, range.to]);

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

      {active === "zreport" && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Z Report</h2>
              <p className="text-sm text-muted-foreground">
                One business day in the hotel timezone. Total sales are POS invoices plus inventory invoices. Refunded sales are left out. Gross profit is sales minus product cost. Net profit is gross profit minus that day’s expenses.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Date</span>
                <input
                  type="date"
                  className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
                  value={zDate}
                  onChange={(e) => setZDate(e.target.value)}
                />
              </label>
              <button type="button" className="hms-btn-outline" onClick={() => void load()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </button>
              <button
                type="button"
                className="hms-btn-outline"
                disabled={!!zBusy}
                onClick={() => void downloadZ()}
              >
                {zBusy === "pdf" ? "Preparing…" : "Download PDF"}
              </button>
              <button type="button" className="hms-btn-solid" disabled={!!zBusy} onClick={() => void emailZ()}>
                {zBusy === "email" ? "Sending…" : "Email to boss"}
              </button>
            </div>
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
          {zMsg && <p className="text-sm text-emerald-700">{zMsg}</p>}
          {zReport && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["POS sales", zReport.posSales ?? 0],
                    ["Inventory invoices", zReport.inventorySales ?? 0],
                    ["Total sales", zReport.totalSales],
                    ["Still on credit", zReport.creditSales ?? 0],
                    ["Cost of goods", zReport.costOfGoods],
                    ["Gross profit", zReport.grossProfit],
                    ["Expenses", zReport.totalExpenses],
                    ["Net profit", zReport.netProfit],
                    ["Open credit", zReport.openCredit],
                    ["Open debt", zReport.openDebt],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-border bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-lg font-bold">
                      {zReport.currency} {Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Gross profit = total sales − cost of goods. Net profit = gross profit − expenses. “Still on credit” is already inside total sales and is money not yet collected. Open credit and open debt are the company balances, including POS credit that is still unpaid.
                {zReport.bossEmails.length > 0
                  ? ` Email goes to ${zReport.bossEmails.join(", ")}.`
                  : " Add a hotel email or a hotel admin email before sending."}
              </p>
            </>
          )}
        </section>
      )}

      {active !== "zreport" && (
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
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(tableColumns.length, 1)} className="px-3 py-8 text-center text-muted-foreground">
                    No activity for this period.
                  </td>
                </tr>
              ) : (
                paged.slice.map((row, idx) => (
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
        <PaginationBar
          page={page}
          totalPages={paged.totalPages}
          totalItems={paged.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          noun="rows"
        />
      </section>
      )}
    </div>
  );

  async function downloadZ() {
    if (!hotelId) return;
    setZBusy("pdf");
    setError(null);
    setZMsg(null);
    try {
      await downloadReportExport(
        `/api/v1/hotels/${hotelId}/accounting/z-report/pdf?date=${zDate}`,
        `z-report-${zDate}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download the PDF");
    } finally {
      setZBusy(null);
    }
  }

  async function emailZ() {
    if (!hotelId) return;
    setZBusy("email");
    setError(null);
    setZMsg(null);
    try {
      const result = await apiFetch<{ message: string }>(
        `/api/v1/hotels/${hotelId}/accounting/z-report/email?date=${zDate}`,
        { method: "POST" },
      );
      setZMsg(result.message || "Z Report emailed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not email the Z Report");
    } finally {
      setZBusy(null);
    }
  }
}
