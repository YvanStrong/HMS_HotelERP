"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { apiFetch, getToken } from "@/lib/api";

type TenantRow = {
  tenantId?: string;
  hotelName?: string;
  subdomain?: string;
  subscription?: {
    status?: string;
    nextBillingDate?: string | null;
    daysRemaining?: number | null;
    suspended?: boolean;
    manuallyBlocked?: boolean;
    manualBlockReason?: string | null;
    lastPaymentConfirmedAt?: string | null;
    monthlyPrice?: number | string | null;
  };
};

type SubscriptionDraft = {
  monthlyPrice: string;
  subscriptionEndDate: string;
};

type TenantsPayload = {
  data?: TenantRow[];
  summary?: Record<string, unknown>;
};

export default function PlatformTenantsPage() {
  const [data, setData] = useState<TenantsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busyTenant, setBusyTenant] = useState<string | null>(null);
  const [renewMonths, setRenewMonths] = useState<Record<string, string>>({});
  const [subscriptionDrafts, setSubscriptionDrafts] = useState<Record<string, SubscriptionDraft>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        const json = await apiFetch<TenantsPayload>("/api/v1/platform/tenants");
        if (!cancelled) {
          setData(json);
          seedDrafts(json.data ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadTenants() {
    const json = await apiFetch<TenantsPayload>("/api/v1/platform/tenants", { quiet: true });
    setData(json);
    seedDrafts(json.data ?? []);
  }

  function seedDrafts(rows: TenantRow[]) {
    setSubscriptionDrafts(() => {
      const next: Record<string, SubscriptionDraft> = {};
      for (const row of rows) {
        if (!row.tenantId) continue;
        next[row.tenantId] = {
          monthlyPrice: row.subscription?.monthlyPrice == null ? "" : String(row.subscription.monthlyPrice),
          subscriptionEndDate: row.subscription?.nextBillingDate ?? "",
        };
      }
      return next;
    });
  }

  function updateDraft(tenantId: string, patch: Partial<SubscriptionDraft>) {
    setSubscriptionDrafts((prev) => ({
      ...prev,
      [tenantId]: {
        monthlyPrice: prev[tenantId]?.monthlyPrice ?? "",
        subscriptionEndDate: prev[tenantId]?.subscriptionEndDate ?? "",
        ...patch,
      },
    }));
  }

  function formatDays(value?: number | null) {
    if (value == null) return "n/a";
    if (!Number.isFinite(value) || Math.abs(value) > 1000000) return "n/a";
    return String(value);
  }

  async function saveSubscriptionSettings(tenantId: string) {
    const draft = subscriptionDrafts[tenantId] ?? { monthlyPrice: "", subscriptionEndDate: "" };
    const monthlyPrice = draft.monthlyPrice.trim() === "" ? null : Number(draft.monthlyPrice);
    if (monthlyPrice != null && (!Number.isFinite(monthlyPrice) || monthlyPrice < 0)) {
      setError("Monthly price must be a valid non-negative number.");
      return;
    }
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          monthlyPrice,
          subscriptionEndDate: draft.subscriptionEndDate || null,
          note: "Manual subscription settings update from platform tenants page",
        }),
        quiet: true,
      });
      await loadTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save subscription settings.");
    } finally {
      setBusyTenant(null);
    }
  }

  async function renewTenant(tenantId: string) {
    const months = Number(renewMonths[tenantId] || "1");
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/renew`, {
        method: "POST",
        body: JSON.stringify({ months, note: "Manual external payment confirmed by platform admin" }),
        quiet: true,
      });
      await loadTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not renew subscription.");
    } finally {
      setBusyTenant(null);
    }
  }

  async function blockTenant(tenantId: string) {
    const reason = window.prompt("Reason for blocking this hotel?");
    if (!reason?.trim()) return;
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/block`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
        quiet: true,
      });
      await loadTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not block tenant.");
    } finally {
      setBusyTenant(null);
    }
  }

  async function unblockTenant(tenantId: string) {
    setBusyTenant(tenantId);
    setError(null);
    try {
      await apiFetch(`/api/v1/platform/tenants/${tenantId}/subscription/unblock`, {
        method: "POST",
        body: JSON.stringify({ note: "Manual unblock by platform admin" }),
        quiet: true,
      });
      await loadTenants();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unblock tenant. Expired tenants must be renewed first.");
    } finally {
      setBusyTenant(null);
    }
  }

  const tenantRows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tenantRows;
    return tenantRows.filter((row) => {
      const label = String(row.hotelName ?? row.tenantId ?? "").toLowerCase();
      return label.includes(normalized);
    });
  }, [tenantRows, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Tenants</h1>
        <p className="text-muted-foreground mt-1">
          Manage all hotel tenants across the platform
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {data?.summary && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <KeyValueTable title="Overview" rows={recordToRows(data.summary)} />
        </div>
      )}

      <section className="hms-section-card">
        <div className="hms-section-head">
          <h2 className="hms-section-title">Find Tenants</h2>
          <p className="hms-section-sub">Search active tenants by hotel name, code, or ID.</p>
        </div>
        <div className="max-w-md">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tenants..."
          />
        </div>
      </section>

      {loading ? (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ) : filteredRows.length > 0 ? (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">
            Tenants ({filteredRows.length}
            {query.trim() ? ` of ${tenantRows.length}` : ""})
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filteredRows.slice(0, 100).map((row, i) => {
              const tenantId = row.tenantId;
              const draft = tenantId ? subscriptionDrafts[tenantId] : undefined;
              return (
                <div
                  key={tenantId ?? i}
                  className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold">{row.hotelName ?? "Hotel tenant"}</p>
                      <p className="break-all text-xs text-muted-foreground">{row.subdomain ?? tenantId}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${row.subscription?.suspended ? "bg-red-50 text-red-700" : row.subscription?.status === "EXPIRING_SOON" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {row.subscription?.status ?? "UNKNOWN"}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <Mini label="Expiry" value={row.subscription?.nextBillingDate ?? "Not set"} />
                    <Mini label="Days left" value={formatDays(row.subscription?.daysRemaining)} />
                    <Mini label="Current price" value={row.subscription?.monthlyPrice == null ? "n/a" : String(row.subscription.monthlyPrice)} />
                  </div>
                  {row.subscription?.manualBlockReason && (
                    <p className="mt-3 rounded-xl bg-red-50 p-2 text-xs text-red-700">{row.subscription.manualBlockReason}</p>
                  )}
                  {tenantId && (
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Manual billing edit</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm">
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Monthly amount</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={draft?.monthlyPrice ?? ""}
                              onChange={(event) => updateDraft(tenantId, { monthlyPrice: event.target.value })}
                              placeholder="99.00"
                              className="w-full"
                            />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Subscription end date</span>
                            <input
                              type="date"
                              value={draft?.subscriptionEndDate ?? ""}
                              onChange={(event) => updateDraft(tenantId, { subscriptionEndDate: event.target.value })}
                              className="w-full"
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          className="hms-btn-solid mt-3 w-full text-sm sm:w-auto"
                          disabled={busyTenant === tenantId}
                          onClick={() => void saveSubscriptionSettings(tenantId)}
                        >
                          Save amount / date
                        </button>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                        <select
                          className="w-full text-sm sm:w-32"
                          value={renewMonths[tenantId] ?? "1"}
                          onChange={(event) => setRenewMonths((prev) => ({ ...prev, [tenantId]: event.target.value }))}
                        >
                          <option value="1">1 month</option>
                          <option value="3">3 months</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                        </select>
                        <button type="button" className="hms-btn-solid w-full text-sm sm:w-auto" disabled={busyTenant === tenantId} onClick={() => void renewTenant(tenantId)}>
                          Renew by months
                        </button>
                        <button type="button" className="hms-btn-outline w-full text-sm sm:w-auto" disabled={busyTenant === tenantId} onClick={() => void blockTenant(tenantId)}>
                          Block
                        </button>
                        <button type="button" className="hms-btn-outline w-full text-sm sm:w-auto" disabled={busyTenant === tenantId} onClick={() => void unblockTenant(tenantId)}>
                          Unblock
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/50 rounded-xl">
          <h3 className="text-lg font-semibold mb-1">No tenants found</h3>
          <p className="text-muted-foreground">
            {query.trim() ? "Try a different search term." : "No active tenants were returned by the API."}
          </p>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
