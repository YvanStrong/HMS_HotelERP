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
        const data = await apiFetch<AuditLog[]>("/api/v1/platform/audit/logs");
        if (!cancelled) setLogs(data);
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

  const filtered = logs?.filter(log => 
    !filter || 
    log.action?.toLowerCase().includes(filter.toLowerCase()) ||
    log.entityType?.toLowerCase().includes(filter.toLowerCase()) ||
    log.username?.toLowerCase().includes(filter.toLowerCase())
  ) ?? [];

  const { slice, total, totalPages } = paginateSlice(filtered, page, PAGE_SIZE);

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
      <div className="max-w-md">
        <div className="relative">
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
