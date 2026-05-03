"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type GuestProfile = {
  id: string;
  name: string;
  email: string;
  loyalty?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  stayHistory?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  flags?: Record<string, unknown>;
};

type ReservationRow = {
  id: string;
  booking_reference?: string;
  confirmationCode: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  nights?: number;
  roomNumber: string;
  totalAmount: number;
  currency: string;
  guestId: string;
  guestName: string;
  guestEmail: string;
};

export default function GuestDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const guestId = String(params.guestId);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [stays, setStays] = useState<ReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "stays" | "preferences" | "flags">("profile");
  const [earnPoints, setEarnPoints] = useState("100");
  const [redeemPoints, setRedeemPoints] = useState("100");
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setBanner(null);
    if (!getToken()) {
      setError("Not signed in.");
      setIsLoading(false);
      return;
    }
    try {
      const [p, allReservations] = await Promise.all([
        apiFetch<GuestProfile>(`/api/v1/hotels/${hotelId}/guests/${guestId}/profile`),
        apiFetch<ReservationRow[]>(
          `/api/v1/hotels/${hotelId}/reservations?status=CONFIRMED,CHECKED_IN,CHECKED_OUT,CANCELLED,NO_SHOW,PENDING`,
        ),
      ]);
      setProfile(p);
      setStays(allReservations.filter((r) => r.guestId === guestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load guest");
      setProfile(null);
      setStays([]);
    } finally {
      setIsLoading(false);
    }
  }, [guestId, hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitEarn() {
    const points = Number(earnPoints);
    if (!Number.isFinite(points) || points <= 0) {
      setBanner({ kind: "err", text: "Enter a valid positive points amount." });
      return;
    }
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/guests/${guestId}/loyalty/earn`, {
        method: "POST",
        body: JSON.stringify({
          points,
          type: "EARNED",
          description: "Staff loyalty adjustment",
          notifyGuest: false,
        }),
      });
      setBanner({ kind: "ok", text: "Loyalty points added." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Failed to add points" });
    }
  }

  async function submitRedeem() {
    const points = Number(redeemPoints);
    if (!Number.isFinite(points) || points <= 0) {
      setBanner({ kind: "err", text: "Enter a valid positive points amount." });
      return;
    }
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/guests/${guestId}/loyalty/redeem`, {
        method: "POST",
        body: JSON.stringify({
          redemptionType: "DISCOUNT",
          pointsToRedeem: points,
          guestConfirmation: true,
        }),
      });
      setBanner({ kind: "ok", text: "Loyalty points redeemed." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Failed to redeem points" });
    }
  }

  const lifetimeValue = useMemo(() => {
    const val = profile?.stayHistory?.lifetimeValue;
    return typeof val === "number" ? val : typeof val === "string" ? val : "—";
  }, [profile]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-sm mb-2">
          <Link href={staffAppPath("guests")} className="text-primary">
            ← Guests
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Guest profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unified profile, stay history, loyalty actions, and communication details.
        </p>
      </div>

      {error && <div className="error">{error}</div>}
      {banner && (
        <div className={banner.kind === "ok" ? "rounded-lg border border-green-200 bg-green-50 p-3 text-green-800" : "error"}>
          {banner.text}
        </div>
      )}

      {isLoading && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm animate-pulse">
          <div className="h-6 w-48 rounded bg-muted mb-3" />
          <div className="h-4 w-72 rounded bg-muted mb-2" />
          <div className="h-4 w-64 rounded bg-muted" />
        </div>
      )}

      {!isLoading && profile && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Guest</p>
              <p className="mt-1 text-lg font-semibold">{profile.name}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
              <p className="mt-1 text-sm font-medium">{profile.email || "—"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total stays</p>
              <p className="mt-1 text-2xl font-bold">{String(profile.stayHistory?.totalStays ?? "0")}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime value</p>
              <p className="mt-1 text-xl font-bold">{String(lifetimeValue)}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { key: "profile", label: "Profile" },
                { key: "stays", label: "Stay History" },
                { key: "preferences", label: "Preferences" },
                { key: "flags", label: "Flags & Communication" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={activeTab === t.key ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
                  onClick={() => setActiveTab(t.key as typeof activeTab)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === "profile" && (
              <div className="space-y-4">
                <KeyValueTable title="Guest profile" rows={recordToRows({ id: profile.id, name: profile.name, email: profile.email })} />
                <KeyValueTable title="Loyalty" rows={recordToRows(profile.loyalty)} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border/60 p-4">
                    <h3 className="text-sm font-semibold mb-2">Add loyalty points</h3>
                    <label>
                      Points
                      <input value={earnPoints} type="number" min={1} onChange={(e) => setEarnPoints(e.target.value)} />
                    </label>
                    <button type="button" className="hms-btn-solid mt-3" onClick={() => void submitEarn()}>
                      Add points
                    </button>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <h3 className="text-sm font-semibold mb-2">Redeem loyalty points</h3>
                    <label>
                      Points
                      <input value={redeemPoints} type="number" min={1} onChange={(e) => setRedeemPoints(e.target.value)} />
                    </label>
                    <button type="button" className="hms-btn-outline mt-3" onClick={() => void submitRedeem()}>
                      Redeem points
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "stays" && (
              <div>
                {stays.length === 0 ? (
                  <p className="text-muted-foreground">No stay history found for this guest.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th>Booking</th>
                          <th>Stay</th>
                          <th>Status</th>
                          <th>Room</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stays.map((s) => (
                          <tr key={s.id} className="border-t border-border/50">
                            <td className="font-mono text-xs">{s.booking_reference || s.confirmationCode}</td>
                            <td className="whitespace-nowrap">{s.checkInDate} → {s.checkOutDate}</td>
                            <td>{s.status.replaceAll("_", " ")}</td>
                            <td>{s.roomNumber || "Unassigned"}</td>
                            <td>{s.totalAmount} {s.currency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "preferences" && (
              <div className="space-y-4">
                <KeyValueTable title="Preferences" rows={recordToRows(profile.preferences)} />
              </div>
            )}

            {activeTab === "flags" && (
              <div className="space-y-4">
                <KeyValueTable title="Flags" rows={recordToRows(profile.flags)} />
                <KeyValueTable title="Communication" rows={recordToRows(profile.communication)} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
