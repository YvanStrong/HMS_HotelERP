"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { getToken } from "@/lib/api";
import {
  auditImpactAmount,
  fetchVoidReport,
  type PosLineAuditRow,
} from "@/lib/posVoids";
import { staffAppPath } from "@/lib/staffAppRoutes";

const PAGE_SIZE = 25;

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
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

export default function PosVoidsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [range, setRange] = useState(defaultRange);
  const [actionFilter, setActionFilter] = useState<"" | "VOID" | "DISCOUNT">("");
  const [rows, setRows] = useState<PosLineAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchVoidReport(hotelId, range.from, range.to, page - 1, PAGE_SIZE);
      setRows(res.content ?? []);
      setTotalPages(Math.max(1, res.totalPages ?? 1));
    } finally {
      setLoading(false);
    }
  }, [hotelId, range.from, range.to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!actionFilter) return rows;
    return rows.filter((r) => r.action === actionFilter);
  }, [rows, actionFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const todayRows = rows.filter((r) => r.createdAt?.slice(0, 10) === today);
  const todayVoids = todayRows.filter((r) => r.action === "VOID").length;
  const todayDiscountTotal = todayRows
    .filter((r) => r.action === "DISCOUNT")
    .reduce((s, r) => s + num(r.discountAmount), 0);

  async function exportCsv() {
    const token = getToken();
    const q = new URLSearchParams({ from: range.from, to: range.to, page: "0", size: "5000" });
    const url = `/api/v1/hotels/${hotelId}/pos/voids?${q}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = (await res.json()) as { content?: PosLineAuditRow[] };
    const all = data.content ?? [];
    const header =
      "date,waiter,table,item,action,amount,authorized_by,reason\n";
    const body = all
      .map((r) =>
        [
          r.createdAt,
          r.waiterName ?? "",
          r.tableLabel ?? "",
          r.productName ?? "",
          r.action,
          auditImpactAmount(r).toFixed(2),
          r.authorizedByName,
          `"${(r.reason ?? "").replace(/"/g, '""')}"`,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pos-voids-${range.from}-${range.to}.csv`;
    a.click();
  }

  return (
    <div className="hms-page">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Voids &amp; Discounts</h1>
          <p className="text-sm text-muted-foreground">Manager-authorized line voids and comps</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staffAppPath("pos/analytics")} className="hms-btn-outline hms-btn-sm">
            Analytics
          </Link>
          <Link href={staffAppPath("pos/shifts")} className="hms-btn-outline hms-btn-sm">
            Shifts
          </Link>
          <Link href={staffAppPath("pos/tickets")} className="hms-btn-outline hms-btn-sm">
            Tickets
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Voids today</p>
          <p className="text-2xl font-bold">{todayVoids}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Discounts given today</p>
          <p className="text-2xl font-bold text-amber-700">RWF {money(todayDiscountTotal)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          From
          <input
            type="date"
            className="ml-2 rounded border px-2 py-1"
            value={range.from}
            onChange={(e) => {
              setPage(1);
              setRange((r) => ({ ...r, from: e.target.value }));
            }}
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            className="ml-2 rounded border px-2 py-1"
            value={range.to}
            onChange={(e) => {
              setPage(1);
              setRange((r) => ({ ...r, to: e.target.value }));
            }}
          />
        </label>
        <select
          className="rounded border px-2 py-1 text-sm"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value as "" | "VOID" | "DISCOUNT")}
        >
          <option value="">All actions</option>
          <option value="VOID">Void only</option>
          <option value="DISCOUNT">Discount only</option>
        </select>
        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void load()}>
          Refresh
        </button>
        <button type="button" className="hms-btn-solid hms-btn-sm" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="hms-table w-full min-w-[800px]">
          <thead>
            <tr>
              <th>Date / Time</th>
              <th>Waiter</th>
              <th>Table</th>
              <th>Item</th>
              <th>Action</th>
              <th>Amount</th>
              <th>Authorized by</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No voids or discounts in this period
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.waiterName ?? "—"}</td>
                  <td>{r.tableLabel ?? "—"}</td>
                  <td>{r.productName ?? "—"}</td>
                  <td>
                    <span
                      className={
                        r.action === "VOID"
                          ? "rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                          : "rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                      }
                    >
                      {r.action}
                    </span>
                  </td>
                  <td className="tabular-nums">RWF {money(auditImpactAmount(r))}</td>
                  <td className="text-sm">{r.authorizedByName}</td>
                  <td className="max-w-xs text-sm">{r.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
    </div>
  );
}
