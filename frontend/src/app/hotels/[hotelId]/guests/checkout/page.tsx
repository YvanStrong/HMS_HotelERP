"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type Folio = {
  summary: { balanceDue?: number; balance_due?: number; currency: string };
};

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

export default function GuestCheckoutDeskPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [balances, setBalances] = useState<Record<string, number | null>>({});
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
      const bal: Record<string, number | null> = {};
      await Promise.all(
        data.map(async (r) => {
          try {
            const folio = await apiFetch<Folio>(`/api/v1/hotels/${hotelId}/folios/${r.id}`);
            const raw = folio.summary.balanceDue ?? folio.summary.balance_due;
            bal[r.id] = typeof raw === "number" ? raw : null;
          } catch {
            bal[r.id] = null;
          }
        }),
      );
      setBalances(bal);
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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Checkout desk</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review folio balance before checkout. Settlement and invoice printing run from the reservation screen.
            </p>
          </div>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading folios…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guests to check out (no CHECKED_IN reservations). Use check-in desk first if arrivals are still
          outstanding.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">Room</th>
                <th className="p-3">Guest</th>
                <th className="p-3">Checkout date</th>
                <th className="p-3">Folio balance</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = balances[r.id];
                const unpaid = b != null && b > 0.009;
                return (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="p-3 font-semibold">{r.roomNumber || "—"}</td>
                    <td className="p-3">{r.guestName}</td>
                    <td className="p-3">{r.checkOutDate}</td>
                    <td className="p-3">
                      {b == null ? (
                        "—"
                      ) : (
                        <span className={unpaid ? "font-semibold text-rose-600" : ""}>{b.toFixed(2)}</span>
                      )}
                      {unpaid && (
                        <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Due</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Link href={staffAppPath("reservations", r.id)} className="hms-btn-solid text-xs">
                        Open checkout
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
