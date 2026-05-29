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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return "View details";
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
                      <div className="bg-primary h-full rounded-full" style={{ width: profile.loyalty?.nextTier ? '45%' : '100%' }} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      {profile.loyalty?.nextTier ? `${profile.loyalty.pointsToNextTier} more points to reach ${profile.loyalty.nextTier}` : 'Highest tier reached!'}
                    </p>
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                      Points are calculated automatically from posted stays, invoices, and eligible guest spend. Staff should not add
                      manual points here.
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
                    <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
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
                  stay summary, and sensitive incidents (managers only). Update fields via{" "}
                  <code className="rounded bg-muted px-1">PATCH /guests/{"{guestId}"}</code> with the staff guest payload.
                </p>
                {(() => {
                  const registry = profile.registry ?? {};
                  const emergency = asRecord(registry.emergencyContact);
                  const corporate = asRecord(registry.corporate);
                  const activeStay = asRecord(registry.activeStay);
                  const documents = asArray(registry.documents);
                  const communications = asArray(registry.communications);
                  const incidents = asArray(registry.sensitiveIncidents);
                  return (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Guest type</p>
                          <p className="mt-2 text-lg font-black text-foreground">{displayValue(registry.guestType)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Loyalty member: {displayValue(registry.loyaltyMemberNumber)}</p>
                        </div>
                        <KeyValueTable title="Emergency contact" rows={recordToRows(emergency)} />
                        <KeyValueTable title="Corporate billing" rows={recordToRows(corporate)} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <KeyValueTable title="Active stay summary" rows={recordToRows(activeStay)} />
                        <KeyValueTable
                          title="Internal notes"
                          rows={recordToRows({
                            internalNotes: registry.internalNotes,
                            behaviorNotes: registry.behaviorNotes,
                          })}
                        />
                      </div>

                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-xl border border-border/60 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Documents</h3>
                            <span className="text-xs text-muted-foreground">{documents.length}</span>
                          </div>
                          {documents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No documents indexed.</p>
                          ) : (
                            <div className="space-y-2">
                              {documents.map((doc, index) => (
                                <div key={String(doc.id ?? index)} className="rounded-lg bg-muted/30 p-3 text-xs">
                                  <p className="font-bold text-foreground">{displayValue(doc.documentType ?? doc.type ?? doc.fileName)}</p>
                                  <p className="text-muted-foreground">{displayValue(doc.fileName ?? doc.fileUrl)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-border/60 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Communication log</h3>
                            <span className="text-xs text-muted-foreground">{communications.length}</span>
                          </div>
                          {communications.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No communication logged.</p>
                          ) : (
                            <div className="space-y-2">
                              {communications.map((item, index) => (
                                <div key={String(item.id ?? index)} className="rounded-lg bg-muted/30 p-3 text-xs">
                                  <p className="font-bold text-foreground">{displayValue(item.subject ?? item.channel)}</p>
                                  <p className="text-muted-foreground">{displayValue(item.body ?? item.notes ?? item.createdAt)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-border/60 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Sensitive incidents</h3>
                            <span className="text-xs text-muted-foreground">{incidents.length}</span>
                          </div>
                          {incidents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No manager-visible incidents.</p>
                          ) : (
                            <div className="space-y-2">
                              {incidents.map((incident, index) => (
                                <div key={String(incident.id ?? index)} className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs text-rose-900">
                                  <p className="font-bold">{displayValue(incident.incidentType ?? incident.type)}</p>
                                  <p>{displayValue(incident.summary ?? incident.description)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
