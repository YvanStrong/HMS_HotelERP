"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type RateEntry = { rateDate: string; nightlyRate: number };

function defaultFromTo() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function buildDateRangeInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return out;
  const d = new Date(start);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function RoomTypeNightlyRatesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const roomTypeId = String(params.roomTypeId);
  const range = useMemo(() => defaultFromTo(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [rows, setRows] = useState<RateEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(range.from);
  const [editRate, setEditRate] = useState("");
  const [bulkFrom, setBulkFrom] = useState(range.from);
  const [bulkTo, setBulkTo] = useState(range.to);
  const [bulkRate, setBulkRate] = useState("");
  const [ratesPage, setRatesPage] = useState(1);
  const RATES_PAGE_SIZE = 5;
  const rateStats = useMemo(() => {
    if (rows.length === 0) return null;
    const values = rows.map((r) => r.nightlyRate);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { count: rows.length, min, max, avg };
  }, [rows]);
  const totalRatePages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / RATES_PAGE_SIZE)),
    [rows.length],
  );
  const visibleRows = useMemo(() => {
    const start = (ratesPage - 1) * RATES_PAGE_SIZE;
    return rows.slice(start, start + RATES_PAGE_SIZE);
  }, [rows, ratesPage]);

  useEffect(() => {
    setRatesPage(1);
  }, [from, to, rows.length]);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const data = await apiFetch<RateEntry[]>(
        `/api/v1/hotels/${hotelId}/room-types/${roomTypeId}/nightly-rates?from=${from}&to=${to}`,
      );
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load rates");
    }
  }, [hotelId, roomTypeId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function upsertOne(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = Number(editRate);
    if (Number.isNaN(n) || n < 0) {
      setMsg("Enter a valid nightly rate.");
      return;
    }
    try {
      const res = await apiFetch<{ upsertedCount: number; message: string }>(
        `/api/v1/hotels/${hotelId}/room-types/${roomTypeId}/nightly-rates`,
        {
          method: "PUT",
          body: JSON.stringify({ rates: [{ rateDate: editDate, nightlyRate: n }] }),
        },
      );
      setMsg(res.message ?? "Saved.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function upsertRange(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const n = Number(bulkRate);
    if (Number.isNaN(n) || n < 0) {
      setMsg("Enter a valid bulk nightly rate.");
      return;
    }
    const dates = buildDateRangeInclusive(bulkFrom, bulkTo);
    if (dates.length === 0) {
      setMsg("Select a valid date range.");
      return;
    }
    if (dates.length > 366) {
      setMsg("Bulk update supports up to 366 dates at once.");
      return;
    }
    try {
      const rates = dates.map((rateDate) => ({ rateDate, nightlyRate: n }));
      const res = await apiFetch<{ upsertedCount: number; message: string }>(
        `/api/v1/hotels/${hotelId}/room-types/${roomTypeId}/nightly-rates`,
        {
          method: "PUT",
          body: JSON.stringify({ rates }),
        },
      );
      setMsg(res.message ?? `Saved ${rates.length} nightly overrides.`);
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Bulk save failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-sm mb-2">
          <Link href={staffAppPath("room-types")} className="text-primary">
            ← Room types
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Nightly rate overrides</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set special nightly prices for specific dates. When no override exists, the base room-type rate is used.
        </p>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="panel rounded-xl border border-border/60 bg-card p-3">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">View range</h2>
          <label>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label className="mt-3 block">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <div className="mt-4">
            <button type="button" onClick={() => load()} className="hms-btn-outline">
              Refresh rates
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-3">Set one night</h2>
          <form onSubmit={upsertOne}>
            <label>Date</label>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <label className="mt-3 block">Nightly rate</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editRate}
              onChange={(e) => setEditRate(e.target.value)}
              placeholder="Enter amount"
            />
            <div className="mt-4">
              <button type="submit" className="hms-btn-solid">
                Save nightly override
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold mb-3">Bulk update date range</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Apply one nightly rate across many dates in one action (useful for seasons, holidays, or promotions).
        </p>
        <form onSubmit={upsertRange} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label>
            From
            <input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
          </label>
          <label>
            Nightly rate
            <input
              type="number"
              step="0.01"
              min="0"
              value={bulkRate}
              onChange={(e) => setBulkRate(e.target.value)}
              placeholder="Enter amount"
            />
          </label>
          <div className="md:col-span-3">
            <button type="submit" className="hms-btn-solid">
              Apply bulk override
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold mb-3">Overrides in selected range</h2>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-muted-foreground">
            No nightly overrides found in this range.
          </div>
        ) : (
          <div className="space-y-4">
            {rateStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Days</p>
                  <p className="text-lg font-semibold">{rateStats.count}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Min rate</p>
                  <p className="text-lg font-semibold">{rateStats.min}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Max rate</p>
                  <p className="text-lg font-semibold">{rateStats.max}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg rate</p>
                  <p className="text-lg font-semibold">{rateStats.avg.toFixed(2)}</p>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th>Date</th>
                    <th>Nightly rate</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.rateDate} className="border-t border-border/50">
                      <td>{r.rateDate}</td>
                      <td className="font-medium">{r.nightlyRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-muted-foreground">
                Page {ratesPage} of {totalRatePages} · showing {visibleRows.length} of {rows.length} override
                {rows.length === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  disabled={ratesPage === 1}
                  onClick={() => setRatesPage(1)}
                >
                  Prev Prev
                </button>
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  disabled={ratesPage === 1}
                  onClick={() => setRatesPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  disabled={ratesPage >= totalRatePages}
                  onClick={() => setRatesPage((p) => Math.min(totalRatePages, p + 1))}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="hms-btn-outline text-sm"
                  disabled={ratesPage >= totalRatePages}
                  onClick={() => setRatesPage(totalRatePages)}
                >
                  Next Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
