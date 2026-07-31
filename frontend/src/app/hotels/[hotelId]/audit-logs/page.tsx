"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

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

type ActivityRow = {
  timestamp: string;
  staffName: string;
  action: string;
  reference: string;
};

type ExecutiveDashboard = {
  recentActivity?: ActivityRow[];
};

const PAGE_SIZE = 20;

function actionTone(action: string) {
  const a = action.toUpperCase();
  if (a.includes("DELETE") || a.includes("CANCEL") || a.includes("FAILED")) return "bg-red-100 text-red-800";
  if (a.includes("LOGIN") || a.includes("AUTH") || a.includes("ROLE")) return "bg-violet-100 text-violet-800";
  if (a.includes("RESERVATION") || a.includes("CHECK")) return "bg-blue-100 text-blue-800";
  if (a.includes("UPDATE") || a.includes("CREATE")) return "bg-emerald-100 text-emerald-800";
  return "bg-slate-100 text-slate-700";
}

export default function AuditLogsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [targetType, setTargetType] = useState("ALL");
  const [dateScope, setDateScope] = useState("ALL");
  const [page, setPage] = useState(1);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [data, dashboard] = await Promise.all([
        apiFetch<PageResponse>(`/api/v1/hotels/${hotelId}/audit-logs?size=200`),
        apiFetch<ExecutiveDashboard>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`).catch(() => null),
      ]);
      setLogs(data.content || []);
      setRecentActivity(dashboard?.recentActivity || []);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId]);

  const targetTypes = useMemo(() => {
    const values = Array.from(new Set(logs.map((log) => log.targetType).filter(Boolean) as string[]));
    return values.sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter((log) => {
      if (targetType !== "ALL" && log.targetType !== targetType) return false;
      if (dateScope === "TODAY" && !log.createdAt.startsWith(today)) return false;
      if (!needle) return true;
      return [log.action, log.targetType, log.targetId, log.details, log.actorUserId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [dateScope, logs, q, targetType]);

  useEffect(() => {
    setPage(1);
  }, [q, targetType, dateScope]);

  const paged = useMemo(() => paginateSlice(filteredLogs, page, PAGE_SIZE), [filteredLogs, page]);

  const summary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = logs.filter((log) => log.createdAt.startsWith(today)).length;
    const security = logs.filter((log) => /LOGIN|AUTH|ROLE|PASSWORD|SECURITY/i.test(log.action)).length;
    const reservations = logs.filter((log) => /RESERVATION|CHECK_IN|CHECK_OUT/i.test(`${log.action} ${log.targetType ?? ""}`)).length;
    return { total: logs.length, todays, security, reservations };
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Operational memory</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Audit Logs</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Recent activity, compliance trail, and security-sensitive changes in one smart operations view.
            </p>
          </div>
          <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total events", summary.total],
          ["Today", summary.todays],
          ["Security/Admin", summary.security],
          ["Reservations", summary.reservations],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </div>

      {recentActivity.length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="mb-4 flex flex-col gap-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Recent Activity</p>
            <h2 className="text-xl font-black tracking-tight">Latest operational actions</h2>
            <p className="text-sm text-muted-foreground">Moved from the dashboard so managers can review activity in context.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recentActivity.slice(0, 8).map((activity, idx) => (
              <div key={`${activity.reference}-${idx}`} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${actionTone(activity.action)}`}>
                    {activity.action}
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-sm font-bold text-foreground">{activity.reference || "System activity"}</p>
                <p className="mt-1 text-xs text-muted-foreground">By {activity.staffName || "System"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div>
            <label>Search audit trail</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Action, details, actor, target..." type="search" />
          </div>
          <div>
            <label>Target type</label>
            <select value={targetType} onChange={(e) => setTargetType(e.target.value)}>
              <option value="ALL">All targets</option>
              {targetTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Date</label>
            <select value={dateScope} onChange={(e) => setDateScope(e.target.value)}>
              <option value="ALL">All dates</option>
              <option value="TODAY">Today only</option>
            </select>
          </div>
          <div className="lg:ml-auto">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {filteredLogs.length} visible
            </span>
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="hms-section-card">
        <div className="mb-4">
          <h2 className="text-lg font-black tracking-tight">Full audit trail</h2>
          <p className="text-sm text-muted-foreground">Compliance-level record of hotel activity and administrative changes.</p>
        </div>
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
              {paged.slice.map((log) => (
                <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap font-mono text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${actionTone(log.action)}`}>
                      {log.action}
                    </span>
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
              {paged.total === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground italic">No audit records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={paged.totalPages}
          totalItems={paged.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          noun="logs"
        />
      </section>
    </div>
  );
}
