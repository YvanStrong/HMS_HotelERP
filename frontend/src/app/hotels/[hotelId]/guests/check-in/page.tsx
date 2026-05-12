"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type ReservationRow = {
  id: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestId: string;
  roomNumber: string;
};

export default function GuestCheckInDeskPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async () => {
    setError(null);
    setRows([]);
    setSearched(false);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    const needle = q.trim();
    if (!needle) {
      setError("Enter confirmation code, booking reference, or guest name.");
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<ReservationRow[]>(
        `/api/v1/hotels/${hotelId}/reservations?status=CONFIRMED&q=${encodeURIComponent(needle)}`,
      );
      setRows(data);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [hotelId, q]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Check-in desk</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find a reservation, verify ID on the reservation screen, capture deposit if needed, then run check-in from the
          reservation detail (room assignment, folio open, and status updates are handled there).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input
            className="min-w-[220px] flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            placeholder="Confirmation, booking ref, or guest name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void search()}
          />
          <button type="button" className="hms-btn-solid text-sm" disabled={loading} onClick={() => void search()}>
            {loading ? "Searching…" : "Find reservation"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {searched && !loading && !error && rows.length === 0 && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
          No matching <strong className="text-foreground">CONFIRMED</strong> reservations for this hotel. Try another
          confirmation or booking reference, or confirm the booking is not still pending cancellation or already
          checked in.
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Booking</th>
                <th className="p-3">Guest</th>
                <th className="p-3">Stay</th>
                <th className="p-3">Room</th>
                <th className="p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="p-3 font-mono text-xs">{r.booking_reference || r.confirmationCode}</td>
                  <td className="p-3">{r.guestName}</td>
                  <td className="p-3 whitespace-nowrap">
                    {r.checkInDate} → {r.checkOutDate}
                  </td>
                  <td className="p-3">{r.roomNumber || "—"}</td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3 text-right">
                    <Link href={staffAppPath("reservations", r.id)} className="hms-btn-solid text-xs">
                      Open reservation
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
