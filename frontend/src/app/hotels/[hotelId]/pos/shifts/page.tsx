"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { PosOutletSelect } from "@/components/PosOutletSelect";
import { ShiftSummaryDrawer } from "@/components/ShiftSummaryDrawer";
import { paginateSlice } from "@/lib/pagination";
import { fetchPosDepots, type DepotRow } from "@/lib/posTickets";
import {
  closeShift,
  fetchOpenShifts,
  fetchShiftHistory,
  formatShiftDuration,
  shiftMoney,
  type PosShiftDTO,
} from "@/lib/posShifts";
import { staffAppPath } from "@/lib/staffAppRoutes";

const PAGE_SIZE = 20;

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function varianceBadge(row: PosShiftDTO, variance?: number | string | null, status?: string | null) {
  if (row.status === "OPEN") return <span className="text-slate-400">—</span>;
  const v = shiftMoney(variance);
  if (status === "BALANCED" || v === 0) {
    return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">BALANCED</span>;
  }
  if (v > 0) {
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
        +{v.toLocaleString()}
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
      {v.toLocaleString()}
    </span>
  );
}

export default function PosShiftsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [depotId, setDepotId] = useState("");
  const [range, setRange] = useState(defaultRange);
  const [waiterFilter, setWaiterFilter] = useState("");
  const [openShifts, setOpenShifts] = useState<PosShiftDTO[]>([]);
  const [history, setHistory] = useState<PosShiftDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [forceClose, setForceClose] = useState<PosShiftDTO | null>(null);
  const [closeCash, setCloseCash] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPage, setOpenPage] = useState(1);
  const [histPage, setHistPage] = useState(1);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      const [open, hist] = await Promise.all([
        fetchOpenShifts(hotelId, depotId || undefined),
        fetchShiftHistory(hotelId, {
          depotId: depotId || undefined,
          from: range.from,
          to: range.to,
          status: "CLOSED",
          page: 0,
          size: 500,
        }),
      ]);
      setOpenShifts(open);
      setHistory(hist.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load shifts");
    } finally {
      setLoading(false);
    }
  }, [hotelId, depotId, range.from, range.to]);

  useEffect(() => {
    void fetchPosDepots(hotelId).then(setDepots);
  }, [hotelId]);

  useEffect(() => {
    setOpenPage(1);
    setHistPage(1);
  }, [depotId, range.from, range.to, waiterFilter]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  const filteredHistory = useMemo(() => {
    if (!waiterFilter.trim()) return history;
    const q = waiterFilter.toLowerCase();
    return history.filter((s) => s.waiterName.toLowerCase().includes(q));
  }, [history, waiterFilter]);

  const pagedOpen = useMemo(() => paginateSlice(openShifts, openPage, PAGE_SIZE), [openShifts, openPage]);
  const pagedHistory = useMemo(
    () => paginateSlice(filteredHistory, histPage, PAGE_SIZE),
    [filteredHistory, histPage],
  );

  async function submitForceClose() {
    if (!forceClose) return;
    setBusy(true);
    setError(null);
    try {
      await closeShift(hotelId, forceClose.id, Number.parseFloat(closeCash) || 0, closeNotes);
      setForceClose(null);
      setCloseCash("");
      setCloseNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not close shift");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hms-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hms-page-title">POS Shifts</h1>
          <p className="text-sm text-slate-600">Open shifts and shift history by outlet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staffAppPath("pos/tables")} className="hms-btn-outline hms-btn-sm">
            Tables
          </Link>
          <Link href={staffAppPath("pos/tickets")} className="hms-btn-outline hms-btn-sm">
            Tickets
          </Link>
          <Link href={staffAppPath("pos/kitchen")} className="hms-btn-outline hms-btn-sm">
            Kitchen
          </Link>
          <Link href={staffAppPath("pos/analytics")} className="hms-btn-outline hms-btn-sm">
            Analytics
          </Link>
          <Link href={staffAppPath("pos/voids")} className="hms-btn-outline hms-btn-sm">
            Voids &amp; Discounts
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <PosOutletSelect depots={depots} value={depotId} onChange={setDepotId} />
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <section className="mb-8 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Currently open shifts</h2>
        {loading ? (
          <p className="text-slate-500">Loading…</p>
        ) : pagedOpen.total === 0 ? (
          <p className="text-slate-500">No open shifts{depotId ? " for this outlet" : ""}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="hms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Waiter</th>
                  <th>Outlet</th>
                  <th>Opened</th>
                  <th>Duration</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pagedOpen.slice.map((s) => (
                  <tr key={s.id}>
                    <td>{s.waiterName}</td>
                    <td>{s.depotName}</td>
                    <td>{new Date(s.openedAt).toLocaleString()}</td>
                    <td>{formatShiftDuration(s.durationMinutes)}</td>
                    <td>{s.totalOrders}</td>
                    <td>RWF {shiftMoney(s.totalRevenue).toLocaleString()}</td>
                    <td className="space-x-2 text-right">
                      <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setDrawerId(s.id)}>
                        View summary
                      </button>
                      <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setForceClose(s)}>
                        Force close
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading ? (
          <PaginationBar
            page={openPage}
            totalPages={pagedOpen.totalPages}
            totalItems={pagedOpen.total}
            pageSize={PAGE_SIZE}
            onPageChange={setOpenPage}
            noun="open shifts"
          />
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Shift history</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            From
            <input
              type="date"
              className="hms-input"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            To
            <input
              type="date"
              className="hms-input"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Waiter
            <input
              className="hms-input"
              placeholder="Search by name"
              value={waiterFilter}
              onChange={(e) => setWaiterFilter(e.target.value)}
            />
          </label>
          <button type="button" className="hms-btn-primary hms-btn-sm self-end" onClick={() => void load()}>
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="hms-table w-full text-sm">
            <thead>
              <tr>
                <th>Waiter</th>
                <th>Outlet</th>
                <th>Date</th>
                <th>Opened</th>
                <th>Closed</th>
                <th>Duration</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Cash variance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pagedHistory.total === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">
                    No closed shifts in this range.
                  </td>
                </tr>
              ) : (
                pagedHistory.slice.map((s) => (
                <tr key={s.id}>
                  <td>{s.waiterName}</td>
                  <td>{s.depotName}</td>
                  <td>{new Date(s.openedAt).toLocaleDateString()}</td>
                  <td>{new Date(s.openedAt).toLocaleTimeString()}</td>
                  <td>{s.closedAt ? new Date(s.closedAt).toLocaleTimeString() : "—"}</td>
                  <td>{formatShiftDuration(s.durationMinutes)}</td>
                  <td>{s.totalOrders}</td>
                  <td>RWF {shiftMoney(s.totalRevenue).toLocaleString()}</td>
                  <td>{varianceBadge(s, s.cashVariance, s.cashVarianceStatus)}</td>
                  <td className="text-right">
                    <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setDrawerId(s.id)}>
                      View report
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading ? (
          <PaginationBar
            page={histPage}
            totalPages={pagedHistory.totalPages}
            totalItems={pagedHistory.total}
            pageSize={PAGE_SIZE}
            onPageChange={setHistPage}
            noun="shifts"
          />
        ) : null}
      </section>

      <ShiftSummaryDrawer hotelId={hotelId} shiftId={drawerId} onClose={() => setDrawerId(null)} />

      {forceClose ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Force close shift</h3>
            <p className="mt-1 text-sm text-slate-600">
              {forceClose.waiterName} · {forceClose.depotName}
            </p>
            <label className="mt-4 block text-sm">
              Closing cash counted
              <input
                className="hms-input mt-1 w-full"
                type="number"
                value={closeCash}
                onChange={(e) => setCloseCash(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm">
              Reason / notes
              <textarea
                className="hms-input mt-1 w-full"
                rows={3}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-ghost" onClick={() => setForceClose(null)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="hms-btn-primary" onClick={() => void submitForceClose()} disabled={busy}>
                Close shift
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
