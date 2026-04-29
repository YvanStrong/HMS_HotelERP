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

  return (
    <>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href={staffAppPath("room-types")}>← Room types</Link>
      </p>
      <h1>Nightly rate overrides</h1>
      <p style={{ color: "var(--muted)" }}>
        <code>GET/PUT …/room-types/{"{id}"}/nightly-rates</code> — overrides merge with base rate for availability
        pricing. Hotel admin or manager required to save.
      </p>
      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}
      <div className="panel" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Date range</h2>
        <label>From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label style={{ marginTop: "0.75rem" }}>To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={() => load()}>
            Reload
          </button>
        </div>
      </div>
      <div className="panel" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Set one night</h2>
        <form onSubmit={upsertOne}>
          <label>Date</label>
          <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          <label style={{ marginTop: "0.75rem" }}>Nightly rate</label>
          <input type="number" step="0.01" min="0" value={editRate} onChange={(e) => setEditRate(e.target.value)} />
          <div style={{ marginTop: "1rem" }}>
            <button type="submit">Upsert</button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Rates in range</h2>
        {rows.length === 0 ? (
          <p style={{ color: "var(--muted)", margin: 0 }}>No overrides in this window (base rate applies).</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Nightly</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rateDate}>
                  <td>{r.rateDate}</td>
                  <td>{r.nightlyRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
