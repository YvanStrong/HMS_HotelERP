"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
  nights?: number;
};

export default function InHouseGuestsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<ReservationRow[]>(
        `/api/v1/hotels/${hotelId}/reservations?status=CHECKED_IN`,
      );
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">In-house guests</h1>
            <p className="mt-1 text-sm text-muted-foreground">Active stays ({rows.length}) — links open folio and guest profile.</p>
          </div>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No in-house guests right now (no reservations with status CHECKED_IN for this property).
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Room</th>
                <th className="p-3">Guest</th>
                <th className="p-3">Departure</th>
                <th className="p-3">Flags</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dueOut = r.checkOutDate === today;
                return (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-3 font-semibold">{r.roomNumber || "—"}</td>
                    <td className="p-3">{r.guestName}</td>
                    <td className="p-3 whitespace-nowrap">{r.checkOutDate}</td>
                    <td className="p-3">
                      {dueOut && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Due out today
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link href={staffAppPath("guests", r.guestId)} className="hms-btn-outline text-xs">
                        Guest profile
                      </Link>
                      <Link href={staffAppPath("reservations", r.id)} className="hms-btn-solid text-xs">
                        Folio / stay
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
