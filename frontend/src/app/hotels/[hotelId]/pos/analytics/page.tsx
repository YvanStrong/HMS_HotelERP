"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChartCard,
  HmsBarChart,
  HmsDonutChart,
  HmsLineChart,
  SparkKpiCard,
  paletteAt,
} from "@/components/charts";
import { PaginationBar } from "@/components/PaginationBar";
import { PosOutletSelect } from "@/components/PosOutletSelect";
import { getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { fetchPosDepots, type DepotRow } from "@/lib/posTickets";
import {
  fetchPosDaily,
  fetchPosHourly,
  fetchPosSummary,
  fetchPosTables,
  fetchPosTopItems,
  fetchPosWaiters,
  posAnalyticsExportUrl,
  type DailyRevenueRow,
  type HourlySlot,
  type PosSummary,
  type TableRow,
  type TopItemRow,
  type WaiterRow,
} from "@/lib/posAnalytics";
import { staffAppPath } from "@/lib/staffAppRoutes";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function money(v: unknown): string {
  return num(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type WaiterSortKey = "waiterName" | "ordersCount" | "revenue" | "avgTicketValue" | "avgServeTimeMin";

const PAGE_SIZE = 15;

export default function PosAnalyticsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [range, setRange] = useState(defaultRange);
  const [depotId, setDepotId] = useState("");
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [daily, setDaily] = useState<DailyRevenueRow[]>([]);
  const [hourly, setHourly] = useState<HourlySlot[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [waiters, setWaiters] = useState<WaiterRow[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [waiterSort, setWaiterSort] = useState<{ key: WaiterSortKey; asc: boolean }>({
    key: "revenue",
    asc: false,
  });
  const [waiterPage, setWaiterPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const d = await fetchPosDepots(hotelId);
      setDepots(d);
      const activeDepot = depotId || undefined;
      const [s, day, hr, top, w, tbl] = await Promise.all([
        fetchPosSummary(hotelId, range.from, range.to, activeDepot),
        fetchPosDaily(hotelId, range.from, range.to, activeDepot),
        fetchPosHourly(hotelId, range.to, activeDepot),
        fetchPosTopItems(hotelId, range.from, range.to, activeDepot, 10),
        fetchPosWaiters(hotelId, range.from, range.to),
        fetchPosTables(hotelId, range.from, range.to, activeDepot),
      ]);
      setSummary(s);
      setDaily(day);
      setHourly(hr);
      setTopItems(top);
      setWaiters(w);
      setTables(tbl);
    } finally {
      setLoading(false);
    }
  }, [hotelId, range.from, range.to, depotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedWaiters = useMemo(() => {
    const rows = [...waiters];
    const { key, asc } = waiterSort;
    rows.sort((a, b) => {
      const av = key === "waiterName" ? a.waiterName : num(a[key]);
      const bv = key === "waiterName" ? b.waiterName : num(b[key]);
      if (typeof av === "string" && typeof bv === "string") {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return asc ? num(av) - num(bv) : num(bv) - num(av);
    });
    return rows;
  }, [waiters, waiterSort]);

  const pagedWaiters = useMemo(
    () => paginateSlice(sortedWaiters, waiterPage, PAGE_SIZE),
    [sortedWaiters, waiterPage],
  );
  const pagedTables = useMemo(() => paginateSlice(tables, tablePage, PAGE_SIZE), [tables, tablePage]);

  const paymentBars = useMemo(() => {
    if (!summary?.revenueByPaymentMethod) return [];
    return Object.entries(summary.revenueByPaymentMethod).map(([label, value], i) => ({
      label,
      value: num(value),
      color: paletteAt(i),
    }));
  }, [summary]);

  const depotPie = useMemo(() => {
    if (!summary?.revenueByDepot) return [];
    return summary.revenueByDepot.map((d, i) => ({
      name: d.depotName,
      value: num(d.revenue),
      color: paletteAt(i),
    }));
  }, [summary]);

  const dailyChartData = useMemo(
    () => daily.map((d) => ({ date: d.date, revenue: num(d.revenue) })),
    [daily],
  );

  const hourlyBars = useMemo(
    () =>
      hourly.map((h) => ({
        label: `${String(h.hour).padStart(2, "0")}:00`,
        value: num(h.revenue),
        color: paletteAt(h.hour % 8),
      })),
    [hourly],
  );

  const topItemBars = useMemo(
    () =>
      topItems.map((t, i) => ({
        label: t.productName,
        value: num(t.revenue),
        color: paletteAt(i),
      })),
    [topItems],
  );

  function toggleWaiterSort(key: WaiterSortKey) {
    setWaiterSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: false },
    );
  }

  async function exportCsv() {
    if (!hotelId) return;
    const path = posAnalyticsExportUrl(hotelId, range.from, range.to, depotId || undefined);
    const token = getToken();
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
    const url = `${base}${path}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pos-analytics-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">POS · Analytics</h1>
          <p className="text-sm text-muted-foreground">Revenue, throughput, and staff performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staffAppPath("pos/tables")} className="hms-btn-outline hms-btn-sm">
            Tables
          </Link>
          <Link href={staffAppPath("pos/tickets")} className="hms-btn-outline hms-btn-sm">
            Tickets
          </Link>
          <Link href={staffAppPath("pos/shifts")} className="hms-btn-outline hms-btn-sm">
            Shifts
          </Link>
          <Link href={staffAppPath("pos/kitchen")} className="hms-btn-outline hms-btn-sm">
            Kitchen
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">
          From
          <input
            type="date"
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2"
            value={range.from}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label className="text-sm font-medium">
          To
          <input
            type="date"
            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2"
            value={range.to}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
        <PosOutletSelect
          className="text-sm font-medium"
          selectClassName="mt-1 block min-w-[10rem] rounded-lg border border-border bg-background px-3 py-2"
          depots={depots}
          value={depotId}
          onChange={setDepotId}
        />
        <button type="button" className="hms-btn-primary hms-btn-sm" onClick={() => void load()}>
          Refresh
        </button>
        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SparkKpiCard title="Total revenue" valueDisplay={money(summary?.totalRevenue)} tone="blue" />
            <SparkKpiCard title="Total orders" valueDisplay={String(summary?.totalOrders ?? 0)} tone="green" />
            <SparkKpiCard title="Avg ticket" valueDisplay={money(summary?.avgTicketValue)} tone="violet" />
            <SparkKpiCard
              title="Avg serve time"
              valueDisplay={`${summary?.avgServeTimeMinutes ?? 0} min`}
              tone="amber"
            />
            <SparkKpiCard title="Total covers" valueDisplay={String(summary?.totalCovers ?? 0)} tone="muted" />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Revenue by day" bodyHeight={260}>
              <HmsLineChart
                data={dailyChartData}
                xKey="date"
                series={[{ key: "revenue", label: "Revenue", type: "area", color: paletteAt(0) }]}
              />
            </ChartCard>
            <ChartCard title="Revenue by outlet" bodyHeight={260}>
              <HmsDonutChart data={depotPie} />
            </ChartCard>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title={`Hourly revenue (${range.to})`} bodyHeight={260}>
              <HmsBarChart data={hourlyBars} layout="vertical" />
            </ChartCard>
            <ChartCard title="Payment methods" bodyHeight={260}>
              <HmsBarChart data={paymentBars} layout="horizontal" />
            </ChartCard>
          </div>

          <ChartCard title="Top selling items" className="mb-6" bodyHeight={Math.max(200, topItemBars.length * 36)}>
            <HmsBarChart data={topItemBars} layout="horizontal" />
          </ChartCard>

          <ChartCard title="Waiter performance" className="mb-6" fitContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {(
                      [
                        ["waiterName", "Name"],
                        ["ordersCount", "Orders"],
                        ["revenue", "Revenue"],
                        ["avgTicketValue", "Avg ticket"],
                        ["avgServeTimeMin", "Avg time"],
                      ] as [WaiterSortKey, string][]
                    ).map(([key, label]) => (
                      <th key={key} className="cursor-pointer px-2 py-2" onClick={() => toggleWaiterSort(key)}>
                        {label}
                        {waiterSort.key === key ? (waiterSort.asc ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedWaiters.slice.map((w) => (
                    <tr key={w.waiterName} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{w.waiterName}</td>
                      <td className="px-2 py-2">{w.ordersCount}</td>
                      <td className="px-2 py-2">{money(w.revenue)}</td>
                      <td className="px-2 py-2">{money(w.avgTicketValue)}</td>
                      <td className="px-2 py-2">{w.avgServeTimeMin} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={waiterPage}
              totalPages={pagedWaiters.totalPages}
              totalItems={pagedWaiters.total}
              pageSize={PAGE_SIZE}
              onPageChange={setWaiterPage}
              noun="waiters"
            />
          </ChartCard>

          <ChartCard title="Table turnover" fitContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">Table</th>
                    <th className="px-2 py-2">Uses</th>
                    <th className="px-2 py-2">Avg duration</th>
                    <th className="px-2 py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTables.slice.map((t) => (
                    <tr key={`${t.tableLabel}-${t.turnoverCount}`} className="border-b border-border/60">
                      <td className="px-2 py-2 font-medium">{t.tableLabel}</td>
                      <td className="px-2 py-2">{t.turnoverCount}</td>
                      <td className="px-2 py-2">{t.avgOccupancyMinutes} min</td>
                      <td className="px-2 py-2">{money(t.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={tablePage}
              totalPages={pagedTables.totalPages}
              totalItems={pagedTables.total}
              pageSize={PAGE_SIZE}
              onPageChange={setTablePage}
              noun="tables"
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}
