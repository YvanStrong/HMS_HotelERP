"use client";

import { useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { PaginationBar } from "@/components/PaginationBar";
import { paginateSlice } from "@/lib/pagination";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  username: string;
  timestamp: string;
  details?: string;
  ipAddress?: string;
};

const PAGE_SIZE = 10;

export default function PlatformAuditPage() {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        // Try to fetch audit logs, fallback to empty if API doesn't exist
        const data = await apiFetch<Record<string, unknown>[]>("/api/v1/platform/audit/logs");
        if (!cancelled) {
          const normalized: AuditLog[] = (data ?? []).map((row, index) => ({
            id: String(row.id ?? index),
            action: String(row.action ?? "UNKNOWN"),
            entityType: String(row.entityType ?? row.targetTenantId ?? "TENANT"),
            entityId: String(row.entityId ?? row.targetResourceId ?? ""),
            userId: String(row.userId ?? row.actorUserId ?? ""),
            username: String(row.username ?? row.actorUserId ?? "system"),
            timestamp: String(row.timestamp ?? new Date().toISOString()),
            details: String(row.details ?? row.notes ?? row.changes ?? ""),
            ipAddress: row.ipAddress ? String(row.ipAddress) : undefined,
          }));
          setLogs(normalized);
        }
      } catch (e) {
        // API might not exist, show empty state
        if (!cancelled) setLogs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = logs?.filter((log) => {
    const needle = filter.toLowerCase();
    const baseMatch =
      !filter ||
      log.action?.toLowerCase().includes(needle) ||
      String(log.entityType ?? "").toLowerCase().includes(needle) ||
      String(log.username ?? "").toLowerCase().includes(needle);
    if (!baseMatch) return false;
    const ts = new Date(log.timestamp);
    if (fromDate) {
      const from = new Date(`${fromDate}T00:00:00`);
      if (ts < from) return false;
    }
    if (toDate) {
      const to = new Date(`${toDate}T23:59:59`);
      if (ts > to) return false;
    }
    return true;
  }) ?? [];

  const { slice, total, totalPages } = paginateSlice(filtered, page, PAGE_SIZE);
  const loginEvents = logs?.filter((log) => log.action?.toUpperCase() === "LOGIN").length ?? 0;
  const destructiveEvents = logs?.filter((log) => log.action?.toUpperCase() === "DELETE").length ?? 0;

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE": return "bg-green-100 text-green-700";
      case "UPDATE": return "bg-blue-100 text-blue-700";
      case "DELETE": return "bg-red-100 text-red-700";
      case "LOGIN": return "bg-purple-100 text-purple-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            System audit trail and activity monitoring
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {logs?.length ?? 0} total events
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Filtered events</p>
          <p className="mt-2 text-2xl font-semibold">{total}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Login events</p>
          <p className="mt-2 text-2xl font-semibold text-purple-700">{loginEvents}</p>
        </div>
        <div className="bg-card rounded-xl border border-border/60 p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Delete events</p>
          <p className="mt-2 text-2xl font-semibold text-red-700">{destructiveEvents}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
        <div className="relative max-w-md">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Filter by action, entity, or user..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-12 pr-4 py-2.5"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border/60 p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      ) : logs?.length === 0 ? (
        <div className="text-center py-12 bg-muted/50 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-1">No audit logs</h3>
          <p className="text-muted-foreground">Audit logging may not be enabled on this server</p>
        </div>
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border/60 shadow-soft overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-sm font-medium">Timestamp</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Entity</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">User</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">IP</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {slice.map((log) => (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="text-muted-foreground text-xs block">
                        {log.entityId ? `${log.entityId.slice(0, 8)}...` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{log.username || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{log.ipAddress || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={PAGE_SIZE}
            noun="events"
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
