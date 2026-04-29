"use client";

import { useEffect, useState } from "react";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { apiFetch, getToken } from "@/lib/api";

type TenantsPayload = {
  data?: Record<string, unknown>[];
  summary?: Record<string, unknown>;
};

export default function PlatformTenantsPage() {
  const [data, setData] = useState<TenantsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      try {
        const json = await apiFetch<TenantsPayload>("/api/v1/platform/tenants?status=ACTIVE");
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Tenants</h1>
        <p className="text-muted-foreground mt-1">
          Manage all hotel tenants across the platform
        </p>
      </div>

      {error && <div className="error">{error}</div>}

      {data?.summary && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Summary</h2>
          <KeyValueTable title="Overview" rows={recordToRows(data.summary)} />
        </div>
      )}

      {data?.data && data.data.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft">
          <h2 className="text-lg font-semibold mb-4">Tenants ({data.data.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.data.slice(0, 50).map((row, i) => (
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
      )}
    </div>
  );
}
