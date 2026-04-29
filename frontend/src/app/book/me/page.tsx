"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { isGuestPortalUser, loadAuthUser, type AuthUser } from "@/lib/auth";

type GuestBookingRow = {
  reservationId: string;
  confirmationCode: string;
  hotelName: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
  roomTypeName: string;
  includesBreakfast: boolean;
  cancellationPolicy: string | null;
  specialRequests: string | null;
  standardArrivalMessage: string | null;
  servicesIncluded: string[];
  totalAmount: number;
  currency: string;
};

export default function GuestTripsPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<GuestBookingRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = loadAuthUser();
    setUser(u);
  }, []);

  useEffect(() => {
    if (!user || !isGuestPortalUser(user) || !user.hotelId) {
      setRows([]);
      return;
    }
    const hotelId = user.hotelId;
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const data = await apiFetch<GuestBookingRow[]>(
          `/api/v1/hotels/${hotelId}/guest-portal/bookings`,
          { hotelId },
        );
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trips");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user === null) {
    return (
      <div className="container-page py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded-lg" />
          <div className="h-32 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!isGuestPortalUser(user) || !user.hotelId) {
    return (
      <div className="container-page py-8">
        <h1 className="text-2xl font-bold tracking-tight mb-6">My trips</h1>
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft">
          <p className="text-foreground mb-4">Sign in with a guest account to see your bookings for that hotel.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/book/register" className="hms-btn-solid">Create guest account</Link>
            <Link href="/login" className="hms-btn-outline">Sign in</Link>
            <Link href="/book/hotels" className="hms-btn-outline">Browse hotels</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My trips</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user.email} · {rows.length} reservation{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href={`/book/hotels/${user.hotelId}`} className="hms-btn-solid">
          Book a stay
        </Link>
      </div>

      {error && <div className="error panel mb-4">{error}</div>}

      {rows.length === 0 && !error && (
        <div className="bg-card rounded-xl border border-border/60 p-8 shadow-soft text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <p className="text-foreground font-medium mb-2">No reservations yet</p>
          <p className="text-muted-foreground text-sm mb-4">Start by booking a stay at your hotel.</p>
          <Link href={`/book/hotels/${user.hotelId}`} className="hms-btn-solid">Book now</Link>
        </div>
      )}

      <div className="grid gap-4">
        {rows.map((r) => (
          <article key={r.reservationId} className="bg-card rounded-xl border border-border/60 p-5 shadow-soft hover:shadow-float transition-shadow">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{r.hotelName}</h2>
                <code className="text-xs bg-muted px-2 py-0.5 rounded-md text-muted-foreground font-mono">{r.confirmationCode}</code>
              </div>
              <span className={`badge ${r.status === "confirmed" ? "badge-success" : r.status === "cancelled" ? "badge-destructive" : "badge-default"}`}>
                {r.status}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Dates</p>
                <p className="text-foreground font-medium">{r.checkInDate} → {r.checkOutDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Room</p>
                <p className="text-foreground">{r.roomTypeName}{r.roomNumber ? ` · Room ${r.roomNumber}` : ""}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Total</p>
                <p className="text-foreground font-bold">{r.totalAmount} {r.currency}</p>
              </div>
            </div>

            {r.standardArrivalMessage && (
              <div className="mt-3 p-3 bg-blue-50/80 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Arrival —</span> {r.standardArrivalMessage}
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {r.includesBreakfast && (
                <span className="badge badge-success">Breakfast included</span>
              )}
              {r.servicesIncluded?.map((s, i) => (
                <span key={`${s}-${i}`} className="badge badge-default">{s}</span>
              ))}
            </div>

            {(r.cancellationPolicy || r.specialRequests) && (
              <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                {r.cancellationPolicy && <p>Cancellation: {r.cancellationPolicy}</p>}
                {r.specialRequests && <p>Requests: {r.specialRequests}</p>}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
