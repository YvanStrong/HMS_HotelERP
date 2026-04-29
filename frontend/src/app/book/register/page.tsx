"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { saveAuthSession } from "@/lib/auth";
import { PublicHotelPicker } from "@/components/PublicHotelPicker";

export default function GuestRegisterPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const presetHotel = sp.get("hotelId") ?? "";

  const [hotelId, setHotelId] = useState(presetHotel);
  const [manualHotelId, setManualHotelId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<{ hotelCount: number; loadError: string | null } | null>(null);

  useEffect(() => {
    if (presetHotel) setHotelId(presetHotel);
  }, [presetHotel]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const hasPicker = catalog !== null && catalog.hotelCount > 0;
    const resolvedId = hasPicker ? hotelId.trim() : (manualHotelId.trim() || hotelId.trim());
    if (!resolvedId) {
      setError(
        hasPicker
          ? "Choose your hotel from the list."
          : "Choose a hotel from the list, or paste a hotel ID from your invitation.",
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register-guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: resolvedId,
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
        }),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const j = await res.json();
          if (j?.message) msg = j.message;
          else if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as {
        accessToken: string;
        user: AuthUser;
      };
      saveAuthSession(data.accessToken, data.user);
      router.push("/book/me");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const catalogReady = catalog !== null;
  const hasPicker = catalogReady && catalog!.hotelCount > 0;
  const catalogError = catalog?.loadError ?? null;
  const canSubmit =
    catalogReady &&
    !loading &&
    (hasPicker ? Boolean(hotelId.trim()) : Boolean(manualHotelId.trim() || hotelId.trim()));

  return (
    <div className="container-page py-8">
      <Link href="/book/hotels" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 mb-6">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        All hotels
      </Link>

      <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Create guest account</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Pick the hotel you stay with — you do <strong>not</strong> need to know any IDs. Your account is scoped to
          that property so you can use <strong>My trips</strong> for bookings, services, and arrival details.
        </p>
      </div>

      <form className="bg-card rounded-xl border border-border/60 p-6 shadow-soft max-w-2xl" noValidate onSubmit={onSubmit}>
        <h2 className="text-lg font-semibold mb-4">Your hotel</h2>

        <PublicHotelPicker
          value={hotelId}
          onChange={setHotelId}
          idPrefix="reg"
          presetHotelId={presetHotel || undefined}
          onCatalogSettled={setCatalog}
          selectRequired={Boolean(catalog && catalog.hotelCount > 0)}
        />

        {catalogReady && catalog!.hotelCount === 0 && !catalogError && (
          <p className="text-muted-foreground text-sm mt-3">
            No hotels are published for guest signup yet. Ask the property for a registration link, or use an ID from
            their invitation below.
          </p>
        )}

        {catalogReady && (catalog!.hotelCount === 0 || catalogError) && (
          <details className="mt-4 p-4 rounded-lg border border-dashed border-border bg-muted/50">
            <summary className="text-sm font-medium cursor-pointer">Have a hotel link or ID only?</summary>
            <p className="text-muted-foreground text-sm mt-2">
              Paste the id from a booking link (the part after <code>/book/hotels/</code>) only if the list above is
              empty or support sent you one.
            </p>
            <label htmlFor="manual-hotel" className="mt-3">Hotel id from link</label>
            <input
              id="manual-hotel"
              value={manualHotelId}
              onChange={(e) => setManualHotelId(e.target.value)}
              placeholder="from URL or email"
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-sm"
            />
          </details>
        )}

        <h2 className="text-lg font-semibold mt-8 mb-4">Your details</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="reg-fn">First name</label>
            <input
              id="reg-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </div>
          <div>
            <label htmlFor="reg-ln">Last name</label>
            <input
              id="reg-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>
        </div>

        <label htmlFor="reg-email" className="mt-4">Email</label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <label htmlFor="reg-pw" className="mt-4">Password</label>
        <input
          id="reg-pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />

        <label htmlFor="reg-phone" className="mt-4">Phone (optional)</label>
        <input id="reg-phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />

        <div className="mt-6">
          <button type="submit" disabled={loading || !canSubmit} className="w-full sm:w-auto">
            {loading ? "Creating…" : "Create account & sign in"}
          </button>
        </div>
        {error && <div className="error mt-4">{error}</div>}
      </form>

      <p className="text-sm text-muted-foreground mt-6">
        Already have access?{" "}
        <Link href="/login" className="font-medium">Sign in</Link>
        {" · "}
        <Link href="/book/hotels" className="font-medium">Browse hotels</Link>
      </p>
    </div>
  );
}
