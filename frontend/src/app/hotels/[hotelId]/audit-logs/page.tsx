"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type AuditLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  actorUserId: string;
  createdAt: string;
};

type PageResponse = {
  content: AuditLog[];
  totalElements: number;
};

export default function AuditLogsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await apiFetch<PageResponse>(`/api/v1/hotels/${hotelId}/audit-logs?size=50`);
      setLogs(data.content || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hotel Audit Trail</h1>
          <p className="text-sm text-muted-foreground">Detailed history of all administrative and security actions.</p>
        </div>
        <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="hms-section-card">
        <div className="hms-table-wrap">
          <table className="hms-table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target</th>
                <th>Actor</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap font-mono text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className="font-bold text-foreground">{log.action}</span>
                  </td>
                  <td>
                    {log.targetType && (
                      <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-medium uppercase">
                        {log.targetType}
                      </span>
                    )}
                  </td>
                  <td className="font-mono text-[10px] text-muted-foreground">
                    {log.actorUserId?.slice(0, 8)}...
                  </td>
                  <td className="max-w-xs truncate text-muted-foreground italic" title={log.details || ""}>
                    {log.details || "—"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground italic">No audit records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
