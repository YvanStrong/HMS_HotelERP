"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type CorporateRow = {
  id: string;
  companyName: string;
  billingEmail: string | null;
  creditLimit: number | null;
  paymentTerms: string | null;
  status: string;
  createdAt: string;
};

type BillingDashboard = {
  groupId: string;
  groupName: string;
  groupCode: string | null;
  billingPreference: string | null;
  corporateAccount: {
    id: string;
    companyName: string;
    billingEmail: string | null;
    creditLimit: number;
    paymentTerms: string | null;
    status: string;
  } | null;
  masterFolio: {
    reservationId: string;
    confirmationCode: string;
    guestName: string;
    balanceDue: number;
    currency: string;
  } | null;
  members: Array<{
    reservationId: string;
    confirmationCode: string;
    guestName: string;
    roomNumber: string;
    status: string;
    folioBalanceDue: number;
    isMaster: boolean;
  }>;
};

export default function GroupBillingDashboardPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const [dash, setDash] = useState<BillingDashboard | null>(null);
  const [corporate, setCorporate] = useState<CorporateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [masterId, setMasterId] = useState("");
  const [corpId, setCorpId] = useState("");
  const [pref, setPref] = useState("MASTER_PAYS_ALL");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        apiFetch<BillingDashboard>(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing-dashboard`),
        apiFetch<CorporateRow[]>(`/api/v1/hotels/${hotelId}/corporate-accounts`).catch(() => [] as CorporateRow[]),
      ]);
      setDash(d);
      setCorporate(Array.isArray(c) ? c : []);
      setPref(d.billingPreference || "MASTER_PAYS_ALL");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load group billing");
      setDash(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveBilling() {
    setSaving(true);
    setBanner(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        billing_preference: pref || null,
      };
      if (masterId.trim()) {
        body.master_reservation_id = masterId.trim();
      }
      if (corpId === "__clear__") {
        body.clear_corporate_account = true;
      } else if (corpId) {
        body.corporate_account_id = corpId;
      }
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMasterId("");
      setCorpId("");
      setBanner("Billing settings saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearMasterLink() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing`, {
        method: "PATCH",
        body: JSON.stringify({ clear_master_reservation: true }),
      });
      setBanner("Master link cleared.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear master");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link href={staffAppPath("groups")} className="text-primary hover:underline">
              ← Groups
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Group billing & routing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Master folio receives routed charges per preference. Members cannot check out while the master folio still
            owes (unless a manager overrides checkout on the reservation).
          </p>
        </div>
        <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {banner && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{banner}</div>}

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && dash && (
        <>
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{dash.groupName}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-1">{dash.groupCode || "—"}</p>
            <p className="text-sm mt-2">
              Active preference:{" "}
              <span className="font-semibold">{dash.billingPreference?.replaceAll("_", " ") || "Not set"}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold mb-2">Master folio</h3>
              {dash.masterFolio ? (
                <>
                  <p className="text-sm">
                    {dash.masterFolio.guestName} ·{" "}
                    <span className="font-mono text-xs">{dash.masterFolio.confirmationCode}</span>
                  </p>
                  <p className="text-2xl font-bold mt-2 text-rose-600">
                    {Number(dash.masterFolio.balanceDue).toFixed(2)} {dash.masterFolio.currency}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Balance due on consolidated bill</p>
                  <Link
                    href={staffAppPath("reservations", dash.masterFolio.reservationId)}
                    className="inline-block mt-3 hms-btn-outline text-xs"
                  >
                    Open master reservation
                  </Link>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No master reservation linked yet.</p>
              )}
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold mb-2">Corporate account</h3>
              {dash.corporateAccount ? (
                <>
                  <p className="font-medium">{dash.corporateAccount.companyName}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dash.corporateAccount.billingEmail || "—"}</p>
                  <p className="text-xs mt-2">
                    Credit limit: {dash.corporateAccount.creditLimit} · Terms:{" "}
                    {dash.corporateAccount.paymentTerms || "—"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">None linked. Use corporate accounts API or extend UI to create.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold mb-3">Member reservations</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/60">
                    <th className="pb-2">Room</th>
                    <th className="pb-2">Guest</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Folio due</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.members.map((m) => (
                    <tr key={m.reservationId} className="border-t border-border/40">
                      <td className="py-2 font-mono">{m.roomNumber || "—"}</td>
                      <td className="py-2">
                        {m.guestName}
                        {m.isMaster && (
                          <span className="ml-2 text-[10px] font-bold uppercase text-indigo-600">Master</span>
                        )}
                      </td>
                      <td className="py-2">{m.status.replaceAll("_", " ")}</td>
                      <td className="py-2 text-right font-mono">{Number(m.folioBalanceDue).toFixed(2)}</td>
                      <td className="py-2 text-right">
                        <Link href={staffAppPath("reservations", m.reservationId)} className="hms-btn-outline text-xs">
                          Folio
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold">Configure routing</h3>
            <p className="text-xs text-muted-foreground">
              Link a master reservation that is already in this group. Post room nights and routed charges to the
              master folio; incidentals stay on members when the preference says so.
            </p>
            <label className="block text-xs font-semibold text-muted-foreground">
              Master reservation ID
              <input
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 font-mono text-xs"
                placeholder="UUID (reservation must belong to this group)"
                value={masterId}
                onChange={(e) => setMasterId(e.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Corporate account
              <select
                className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
                value={corpId}
                onChange={(e) => setCorpId(e.target.value)}
              >
                <option value="">— keep / no change —</option>
                <option value="__clear__">Clear link</option>
                {corporate.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.companyName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-muted-foreground">
              Billing preference
              <select className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm" value={pref} onChange={(e) => setPref(e.target.value)}>
                <option value="MASTER_PAYS_ALL">MASTER_PAYS_ALL</option>
                <option value="SPLIT_BILLING">SPLIT_BILLING</option>
                <option value="GUEST_PAYS_INCIDENTALS">GUEST_PAYS_INCIDENTALS</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="hms-btn-solid text-sm" disabled={saving} onClick={() => void saveBilling()}>
                {saving ? "Saving…" : "Save billing"}
              </button>
              <button type="button" className="hms-btn-outline text-sm" disabled={saving} onClick={() => void clearMasterLink()}>
                Clear master link
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
