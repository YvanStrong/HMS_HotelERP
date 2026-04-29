"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PublicHotelPicker } from "@/components/PublicHotelPicker";
import { publicFetch } from "@/lib/publicApi";

type LookupResult = {
  confirmationCode: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeName: string;
  hotelName: string;
  balanceDue: number;
  currency: string;
};

export default function BookLookupPage() {
  const sp = useSearchParams();
  const presetHotel = sp.get("hotelId") ?? "";
  const [hotelId, setHotelId] = useState(presetHotel);
  const [manualHotelId, setManualHotelId] = useState("");
  const [catalog, setCatalog] = useState<{ hotelCount: number; loadError: string | null } | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (presetHotel) setHotelId(presetHotel);
  }, [presetHotel]);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    const hid = (catalog && catalog.hotelCount > 0 ? hotelId.trim() : manualHotelId.trim() || hotelId.trim());
    if (!hid || !confirmation.trim() || !email.trim()) {
      setError("Choose your hotel (or paste its id), then enter confirmation code and email.");
      return;
    }
    try {
      const q = new URLSearchParams({ confirmation: confirmation.trim(), email: email.trim() });
      const data = await publicFetch<LookupResult>(
        `/api/v1/public/hotels/${hid}/reservations/lookup?${q.toString()}`,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    }
  }

  const catalogReady = catalog !== null;
  const hasPicker = catalogReady && catalog!.hotelCount > 0;
  const canLookup =
    catalogReady &&
    Boolean((hasPicker ? hotelId.trim() : manualHotelId.trim() || hotelId.trim()) && confirmation.trim() && email.trim());

  return (
    <div className="container-page py-8">
      <Link href="/book/hotels" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        All hotels
      </Link>

      <h1 className="text-2xl font-bold tracking-tight mb-2">Find your reservation</h1>
      <p className="text-muted-foreground max-w-xl mb-6 leading-relaxed">
        Choose the hotel you booked, then enter the confirmation code and the email used when booking.
      </p>

      <form className="bg-card rounded-xl border border-border/60 p-6 shadow-soft max-w-2xl" noValidate onSubmit={lookup}>
        <h2 className="text-lg font-semibold mb-4">Hotel</h2>
        <PublicHotelPicker
          value={hotelId}
          onChange={setHotelId}
          idPrefix="lookup"
          showSelectionSummary={false}
          presetHotelId={presetHotel || undefined}
          onCatalogSettled={setCatalog}
        />

        {catalogReady && !hasPicker && (
          <details className="mt-4 p-4 rounded-lg border border-dashed border-border bg-muted/50">
            <summary className="text-sm font-medium cursor-pointer">Hotel not in the list?</summary>
            <label htmlFor="lookup-manual-hotel" className="mt-3">
              Hotel id from your link
            </label>
            <input
              id="lookup-manual-hotel"
              value={manualHotelId}
              onChange={(e) => setManualHotelId(e.target.value)}
              placeholder="after /book/hotels/ in the URL"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
            />
          </details>
        )}

        <label htmlFor="lookup-confirmation" className="mt-6">
          Confirmation code
        </label>
        <input
          id="lookup-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="HMS-2026-…"
          autoComplete="off"
        />
        <label htmlFor="lookup-email" className="mt-4">
          Email
        </label>
        <input
          id="lookup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <div className="mt-6">
          <button type="submit" disabled={!canLookup} className="w-full sm:w-auto">
            Look up
          </button>
        </div>
      </form>

      {error && <div className="error panel mt-4 max-w-2xl">{error}</div>}

      {result && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft max-w-2xl mt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold">{result.hotelName}</h2>
          </div>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Code</span>
              <span className="font-mono">{result.confirmationCode}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Status</span>
              <span className={`badge ${result.status === "confirmed" ? "badge-success" : result.status === "cancelled" ? "badge-destructive" : "badge-default"}`}>
                {result.status}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Stay</span>
              <span className="font-medium">{result.checkInDate} → {result.checkOutDate}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Room type</span>
              <span>{result.roomTypeName || "—"}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Balance due</span>
              <span className="font-bold">{result.balanceDue} {result.currency}</span>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            <Link href="/login" className="font-medium">Staff</Link> can check you in on arrival. Bring a matching ID.
          </p>
        </div>
      )}
    </div>
  );
}
