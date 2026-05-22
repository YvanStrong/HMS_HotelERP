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
  registry?: Record<string, unknown>;
  loyalty?: {
    tier: string;
    points: number;
    nextTier?: string;
    pointsToNextTier?: number;
    tierBenefits?: string[];
  };
  preferences?: Record<string, unknown>;
  stayHistory?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  flags?: {
    isVIP: boolean;
    requiresSpecialAttention: boolean;
    blacklisted: boolean;
    blacklistReason?: string;
    returningGuest?: boolean;
    open_operational_complaints?: number;
  };
  feedback?: {
    history: Array<{
      rating: number | null;
      category?: string;
      comment: string;
      date: string;
      resolved: boolean;
      resolutionNotes?: string;
    }>;
    averageRating: number;
  };
  operational_complaints?: {
    cases: Array<{
      id: string;
      type: string;
      severity: string;
      status: string;
      description: string;
      resolution: string | null;
      opened_at: string;
      resolved_at: string | null;
      reservation_id: string;
      assigned_to: string | null;
      assigned_to_name: string | null;
    }>;
    open_count: number;
  };
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

type RegistryListItem = Record<string, unknown>;

function prettyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? value.toLocaleString() : "—";
  if (typeof value === "string") {
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
    return value.replaceAll("_", " ");
  }
  return "—";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asList(value: unknown): RegistryListItem[] {
  return Array.isArray(value) ? value.filter((item): item is RegistryListItem => !!item && typeof item === "object") : [];
}

function loyaltyProgress(points: number, nextTier?: string | null, pointsToNextTier?: number | null): number {
  if (!nextTier || !Number.isFinite(pointsToNextTier ?? NaN)) return 100;
  const next = points + Number(pointsToNextTier);
  const previous = nextTier === "SILVER" ? 0 : nextTier === "GOLD" ? 1000 : 3000;
  return Math.min(100, Math.max(0, ((points - previous) / Math.max(1, next - previous)) * 100));
}

export default function GuestDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const guestId = String(params.guestId);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [stays, setStays] = useState<ReservationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "profile" | "stays" | "preferences" | "flags" | "feedback" | "complaints" | "registry"
  >("profile");
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
      const [p, guestReservations] = await Promise.all([
        apiFetch<GuestProfile>(`/api/v1/hotels/${hotelId}/guests/${guestId}/profile`),
        apiFetch<ReservationRow[]>(`/api/v1/hotels/${hotelId}/guests/${guestId}/reservations`),
      ]);
      setProfile(p);
      setStays(guestReservations);
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

  const outstandingBalance = useMemo(() => {
    const sh = profile?.stayHistory as Record<string, unknown> | undefined;
    if (!sh) return null;
    const amt = sh.outstandingBalance;
    const cur = sh.outstandingBalanceCurrency;
    if (typeof amt !== "number" && typeof amt !== "string") return null;
    const n = typeof amt === "number" ? amt : Number(amt);
    if (!Number.isFinite(n)) return null;
    return { amount: n, currency: typeof cur === "string" ? cur : "" };
  }, [profile]);

  const lifetimeValue = useMemo(() => {
    const val = profile?.stayHistory?.lifetimeValue;
    return typeof val === "number" ? val : typeof val === "string" ? val : "—";
  }, [profile]);

  const registry = useMemo(() => asRecord(profile?.registry), [profile?.registry]);
  const emergencyContact = useMemo(() => asRecord(registry.emergencyContact), [registry]);
  const corporate = useMemo(() => asRecord(registry.corporate), [registry]);
  const activeStay = useMemo(() => asRecord(registry.activeStay), [registry]);
  const registryDocuments = useMemo(() => asList(registry.documents), [registry]);
  const registryComms = useMemo(() => asList(registry.communications), [registry]);
  const sensitiveIncidents = useMemo(() => asList(registry.sensitiveIncidents), [registry]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm mb-2">
              <Link href={staffAppPath("guests")} className="text-primary">
                ← Guests
              </Link>
            </p>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              {profile?.name}
              {profile?.flags?.isVIP && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-200">VIP</span>
              )}
              {profile?.flags?.returningGuest && (
                <span className="bg-sky-100 text-sky-800 text-xs px-2 py-0.5 rounded-full border border-sky-200">Returning</span>
              )}
            </h1>
          </div>
          {profile?.loyalty && (
            <div className="text-right">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{profile.loyalty.tier} MEMBER</p>
              <p className="text-2xl font-black text-primary">{profile.loyalty.points} pts</p>
            </div>
          )}
        </div>
      </div>

      {profile?.flags?.requiresSpecialAttention && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-center gap-3 animate-pulse">
          <div className="w-2 h-2 rounded-full bg-rose-600" />
          <p className="text-sm font-semibold text-rose-900 uppercase tracking-wide">
            Action required: unresolved guest feedback or open operational complaints for this guest
          </p>
        </div>
      )}

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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding (open folios)</p>
              <p className="mt-1 text-xl font-bold text-rose-600">
                {outstandingBalance
                  ? `${outstandingBalance.amount.toFixed(2)}${outstandingBalance.currency ? ` ${outstandingBalance.currency}` : ""}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average Rating</p>
              <p className="mt-1 text-lg font-bold text-indigo-600">{profile.feedback?.averageRating?.toFixed(1) || "—"} / 5.0</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open operational complaints</p>
              <p className="mt-1 text-2xl font-bold text-rose-600">
                {typeof profile.flags?.open_operational_complaints === "number"
                  ? profile.flags.open_operational_complaints
                  : "—"}
              </p>
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
                { key: "feedback", label: "Feedback & Sentiment" },
                { key: "complaints", label: "Complaints (ops)" },
                { key: "preferences", label: "Preferences" },
                { key: "flags", label: "Flags & Communication" },
                { key: "registry", label: "Registry & ops" },
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-border/60 p-4">
                    <h3 className="text-sm font-semibold mb-2 flex items-center justify-between">
                      Loyalty: {profile.loyalty?.tier}
                      <span className="text-xs font-normal text-muted-foreground">{profile.loyalty?.points} pts</span>
                    </h3>
                    <div className="w-full bg-slate-100 h-2 rounded-full mb-3 overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{
                          width: `${loyaltyProgress(
                            Number(profile.loyalty?.points ?? 0),
                            profile.loyalty?.nextTier,
                            profile.loyalty?.pointsToNextTier,
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {profile.loyalty?.nextTier ? `${profile.loyalty.pointsToNextTier} more points to reach ${profile.loyalty.nextTier}` : 'Highest tier reached!'}
                    </p>
                    <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-800">
                      Points are calculated automatically from posted loyalty transactions, normally awarded when a
                      checked-out stay generates an invoice. Staff do not need to add points manually.
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 p-4">
                    <h3 className="text-sm font-semibold mb-2">Tier Benefits</h3>
                    <ul className="text-xs space-y-1 text-slate-600">
                      {(profile.loyalty?.tierBenefits || []).map(b => (
                        <li key={b} className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-500" />
                          {b.replaceAll("_", " ")}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Redeem points</label>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input className="text-sm" value={redeemPoints} type="number" min={1} onChange={(e) => setRedeemPoints(e.target.value)} />
                      <button type="button" className="hms-btn-outline text-xs whitespace-nowrap" onClick={() => void submitRedeem()}>
                        Redeem
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "stays" && (
              <div>
                {stays.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No stay history found for this guest.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="pb-3">Booking</th>
                          <th className="pb-3">Stay</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3">Room</th>
                          <th className="pb-3">Total</th>
                          <th className="pb-3 text-right">Folio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stays.map((s) => (
                          <tr key={s.id} className="border-t border-border/50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 font-mono text-xs">{s.booking_reference || s.confirmationCode}</td>
                            <td className="py-3 whitespace-nowrap">{s.checkInDate} → {s.checkOutDate}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'CHECKED_OUT' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {s.status.replaceAll("_", " ")}
                              </span>
                            </td>
                            <td className="py-3">{s.roomNumber || "Unassigned"}</td>
                            <td className="py-3 font-semibold">{s.totalAmount} {s.currency}</td>
                            <td className="py-3 text-right">
                              <Link href={staffAppPath("reservations", s.id)} className="hms-btn-outline text-xs">
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "feedback" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Feedback history</h3>
                  <p className="text-xs text-slate-500">{profile.feedback?.history.length || 0} entries</p>
                </div>
                <div className="space-y-3">
                  {(profile.feedback?.history || []).length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">No feedback submitted by this guest yet.</p>
                  ) : (
                    profile.feedback?.history.map((f, i) => (
                      <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <div
                                key={star}
                                className={`w-3 h-3 rounded-full ${f.rating != null && star <= f.rating ? "bg-amber-400" : "bg-slate-200"}`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(f.date).toLocaleDateString()}</span>
                        </div>
                        {f.category && (
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{f.category}</p>
                        )}
                        <p className="text-sm text-slate-700 italic">{f.comment}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${f.resolved ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {f.resolved ? "Resolved" : "Pending Review"}
                          </span>
                        </div>
                        {f.resolutionNotes && (
                          <p className="mt-2 text-xs text-muted-foreground">Resolution: {f.resolutionNotes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === "complaints" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Operational complaint history</h3>
                  <p className="text-xs text-slate-500">
                    {(profile.operational_complaints?.cases ?? []).length} cases ·{" "}
                    {profile.operational_complaints?.open_count ?? 0} open workflow
                  </p>
                </div>
                {(profile.operational_complaints?.cases ?? []).length === 0 ? (
                  <p className="text-center text-slate-400 italic py-8">No operational complaints for this guest.</p>
                ) : (
                  <div className="space-y-3">
                    {(profile.operational_complaints?.cases ?? []).map((c) => (
                      <div key={c.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-slate-100 text-slate-800 border-slate-200">
                              {c.severity}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700">
                              {c.status.replaceAll("_", " ")}
                            </span>
                            <span className="text-[10px] text-slate-500">{c.type.replaceAll("_", " ")}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(c.opened_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-slate-800">{c.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>Owner: {c.assigned_to_name || "—"}</span>
                          <Link href={staffAppPath("reservations", c.reservation_id)} className="text-primary hover:underline">
                            Linked stay
                          </Link>
                          <Link href={staffAppPath("guests/complaints")} className="text-primary hover:underline">
                            Hotel complaint board
                          </Link>
                        </div>
                        {c.resolution && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">Resolution:</span> {c.resolution}
                          </p>
                        )}
                      </div>
                    ))}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <KeyValueTable title="Flags" rows={recordToRows(profile.flags)} />
                  <KeyValueTable title="Communication" rows={recordToRows(profile.communication)} />
                </div>
              </div>
            )}

            {activeTab === "registry" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Guest type, emergency contact, corporate billing pointers, document index, communication log, active
                  stay summary, and sensitive incidents (managers only).
                </p>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <section className="rounded-xl border border-border/60 bg-slate-50/40 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Guest registry</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Guest type</dt>
                        <dd className="font-semibold">{displayValue(registry.guestType)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Loyalty member #</dt>
                        <dd className="font-mono text-xs">{displayValue(registry.loyaltyMemberNumber)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Internal notes</dt>
                        <dd className="max-w-[12rem] text-right">{displayValue(registry.internalNotes)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Behavior notes</dt>
                        <dd className="max-w-[12rem] text-right">{displayValue(registry.behaviorNotes)}</dd>
                      </div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-border/60 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Emergency contact</p>
                    <dl className="mt-3 space-y-2 text-sm">
                      {["name", "phone", "relation"].map((key) => (
                        <div key={key} className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">{prettyLabel(key)}</dt>
                          <dd className="font-medium">{displayValue(emergencyContact[key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="rounded-xl border border-border/60 bg-white p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Active stay</p>
                    {Object.keys(activeStay).length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No active in-house stay.</p>
                    ) : (
                      <dl className="mt-3 space-y-2 text-sm">
                        {Object.entries(activeStay).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-3">
                            <dt className="text-muted-foreground">{prettyLabel(key)}</dt>
                            <dd className="font-medium">{displayValue(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </section>
                </div>

                <section className="rounded-xl border border-border/60 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Corporate billing</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {["companyName", "accountCode", "billingInstructions", "creditLimit", "negotiatedRateNote"].map((key) => (
                      <div key={key} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{prettyLabel(key)}</p>
                        <p className="mt-1 text-sm font-medium text-slate-800">{displayValue(corporate[key])}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-xl border border-border/60 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Documents</p>
                    <span className="text-xs text-muted-foreground">{registryDocuments.length} file(s)</span>
                  </div>
                  {registryDocuments.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">No documents uploaded for this guest.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                          <tr>
                            <th className="py-2">Type</th>
                            <th className="py-2">File</th>
                            <th className="py-2">Expiry</th>
                            <th className="py-2">Uploaded</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {registryDocuments.map((doc, idx) => (
                            <tr key={String(doc.id ?? idx)}>
                              <td className="py-3 font-medium">{displayValue(doc.document_type)}</td>
                              <td className="py-3">{displayValue(doc.file_name || doc.file_url)}</td>
                              <td className="py-3">{displayValue(doc.expiry_date)}</td>
                              <td className="py-3">{displayValue(doc.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Communication log</p>
                      <span className="text-xs text-muted-foreground">{registryComms.length} message(s)</span>
                    </div>
                    {registryComms.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No communication records yet.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {registryComms.slice(0, 6).map((row, idx) => (
                          <article key={String(row.id ?? idx)} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold">{displayValue(row.subject) || "Message"}</p>
                                <p className="text-xs text-muted-foreground">{displayValue(row.channel)}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{displayValue(row.createdAt)}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-700">{displayValue(row.body)}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Sensitive incidents</p>
                      <span className="text-xs text-muted-foreground">{sensitiveIncidents.length} record(s)</span>
                    </div>
                    {sensitiveIncidents.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No visible sensitive incidents for your role.</p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {sensitiveIncidents.map((row, idx) => (
                          <article key={String(row.id ?? idx)} className="rounded-lg border border-rose-100 bg-rose-50/40 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-rose-950">{displayValue(row.incident_type)}</p>
                                <p className="text-xs font-bold uppercase tracking-wide text-rose-700">{displayValue(row.severity)}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{displayValue(row.reported_at)}</span>
                            </div>
                            <p className="mt-2 text-sm text-slate-700">{displayValue(row.description)}</p>
                            {row.action_taken ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Action:</span> {displayValue(row.action_taken)}
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
