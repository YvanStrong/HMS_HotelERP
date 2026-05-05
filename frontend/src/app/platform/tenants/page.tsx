"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { apiFetch, getToken } from "@/lib/api";

type TenantsPayload = {
  data?: Record<string, unknown>[];
  summary?: Record<string, unknown>;
};

export default function PlatformTenantsPage() {
  const [data, setData] = useState<TenantsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        const json = await apiFetch<TenantsPayload>("/api/v1/platform/tenants?status=ACTIVE");
        if (!cancelled) setData(json);
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

  const tenantRows = data?.data ?? [];
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tenantRows;
    return tenantRows.filter((row) => {
      const label = String(row.hotelName ?? row.name ?? row.code ?? row.id ?? "").toLowerCase();
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredRows.slice(0, 100).map((row, i) => (
              <div
                key={i}
                className="p-3 bg-muted/50 rounded-lg border border-border/50 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {String(row.hotelName ?? row.name ?? "T").charAt(0)}
                  </span>
                </div>
                <span className="font-medium text-sm truncate">
                  {String(row.hotelName ?? row.name ?? row.code ?? row.id ?? JSON.stringify(row))}
                </span>
              </div>
            ))}
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
