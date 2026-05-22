"use client";

import { useEffect, useMemo, useState } from "react";
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

type ActivityRow = {
  timestamp: string;
  staffName: string;
  action: string;
  reference: string;
};

type ExecutiveDashboard = {
  recentActivity: ActivityRow[];
};

type Category = "security" | "staff" | "folio" | "operations" | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  security: "Security",
  staff: "Staff",
  folio: "Folio",
  operations: "Operations",
  other: "Other",
};

function titleCaseAction(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function categoryFor(action: string): Category {
  const a = action.toUpperCase();
  if (a.includes("LOGIN") || a.includes("PASSWORD") || a.includes("MFA")) return "security";
  if (a.includes("STAFF") || a.includes("ROLE") || a.includes("USER")) return "staff";
  if (a.includes("FOLIO") || a.includes("PAYMENT") || a.includes("BALANCE")) return "folio";
  if (a.includes("RESERVATION") || a.includes("CHECKOUT") || a.includes("ROOM")) return "operations";
  return "other";
}

function categoryClass(category: Category): string {
  switch (category) {
    case "security":
      return "border-violet-200 bg-violet-50 text-violet-800";
    case "staff":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "folio":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "operations":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function actionClass(action: string): string {
  const category = categoryFor(action);
  return categoryClass(category);
}

function formatDateTime(raw: string): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(raw: string | null | undefined): string {
  if (!raw) return "—";
  return raw.length > 12 ? `${raw.slice(0, 8)}…` : raw;
}

function parseDetails(raw: string | null): { label: string; value: string }[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "{}") return [];

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) return [];
    return body
      .split(",")
      .map((part) => {
        const eq = part.indexOf("=");
        if (eq === -1) return { label: "detail", value: part.trim() };
        return { label: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
      })
      .filter((item) => item.value !== "");
  }

  return [{ label: "details", value: trimmed }];
}

function detailPreview(raw: string | null): string {
  const details = parseDetails(raw);
  if (details.length === 0) return "No extra details recorded";
  return details
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.value}`)
    .join(" · ");
}

function activityActorLabel(staffName: string | null | undefined): string {
  const value = staffName?.trim();
  if (!value) return "No staff recorded";
  if (value === "No staff recorded" || value === "Guest web booking") return value;
  return `By ${value}`;
}

export default function AuditLogsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityRow[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | Category>("all");

  async function loadData() {
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [auditData, dashboardData] = await Promise.all([
        apiFetch<PageResponse>(`/api/v1/hotels/${hotelId}/audit-logs?size=100`),
        apiFetch<ExecutiveDashboard>(`/api/v1/hotels/${hotelId}/reports/executive-dashboard`, { quiet: true }).catch(
          () => null,
        ),
      ]);
      setLogs(auditData.content || []);
      setTotalElements(auditData.totalElements || auditData.content?.length || 0);
      setRecentActivity(dashboardData?.recentActivity || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [hotelId]);

  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return logs.filter((log) => {
      const logCategory = categoryFor(log.action);
      if (category !== "all" && logCategory !== category) return false;
      if (!needle) return true;
      return [
        log.action,
        titleCaseAction(log.action),
        log.targetType ?? "",
        log.targetId ?? "",
        log.actorUserId ?? "",
        log.details ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [logs, query, category]);

  const counts = useMemo(() => {
    const next: Record<Category, number> = { security: 0, staff: 0, folio: 0, operations: 0, other: 0 };
    for (const log of logs) next[categoryFor(log.action)] += 1;
    return next;
  }, [logs]);

  const latestLog = logs[0];
  const lastActivity = recentActivity[0];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Hotel control log</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Security, staff, folio, and operational actions in one place. The activity strip below is the same
              recent activity that used to live on the dashboard.
            </p>
          </div>
          <button onClick={() => void loadData()} className="hms-btn-outline hms-btn-sm w-full sm:w-auto" disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total events</p>
          <p className="mt-2 text-3xl font-black">{totalElements}</p>
          <p className="mt-1 text-xs text-muted-foreground">{filteredLogs.length} shown after filters</p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Security</p>
          <p className="mt-2 text-3xl font-black text-violet-900">{counts.security}</p>
          <p className="mt-1 text-xs text-violet-700">Logins, passwords, access checks</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Folio / payments</p>
          <p className="mt-2 text-3xl font-black text-emerald-900">{counts.folio}</p>
          <p className="mt-1 text-xs text-emerald-700">Payments, voids, balance overrides</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Latest event</p>
          <p className="mt-2 truncate text-lg font-black text-amber-950">
            {latestLog ? titleCaseAction(latestLog.action) : "No events yet"}
          </p>
          <p className="mt-1 text-xs text-amber-800">{latestLog ? formatDateTime(latestLog.createdAt) : "—"}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <p className="text-sm text-muted-foreground">Fast operational feed moved from the dashboard.</p>
          </div>
          {lastActivity && (
            <p className="text-xs text-muted-foreground">Latest: {formatDateTime(lastActivity.timestamp)}</p>
          )}
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No recent dashboard activity yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {recentActivity.slice(0, 8).map((item, idx) => (
              <article key={`${item.reference}-${idx}`} className="rounded-xl border border-border/70 bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.action}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{activityActorLabel(item.staffName)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                    {formatDateTime(item.timestamp)}
                  </span>
                </div>
                <p className="mt-3 break-words font-mono text-xs text-muted-foreground">{item.reference || "—"}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="border-b border-border/70 p-4 md:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Event Explorer</h2>
              <p className="text-sm text-muted-foreground">Search by action, target, actor id, or detail value.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search audit logs..."
                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-72"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as "all" | Category)}
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="all">All categories</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 p-4 md:p-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold">No audit records match your filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search term or category.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              <div className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const logCategory = categoryFor(log.action);
                  return (
                    <article key={log.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{titleCaseAction(log.action)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${categoryClass(logCategory)}`}>
                          {CATEGORY_LABELS[logCategory]}
                        </span>
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex gap-2">
                          <dt className="w-16 shrink-0 text-muted-foreground">Target</dt>
                          <dd className="min-w-0 break-words font-medium">
                            {log.targetType || "Hotel"} · {shortId(log.targetId)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="w-16 shrink-0 text-muted-foreground">Actor</dt>
                          <dd className="font-mono text-xs text-muted-foreground">{shortId(log.actorUserId)}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                        {detailPreview(log.details)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground">When</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Target</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Actor</th>
                    <th className="px-4 py-3 text-xs font-black uppercase tracking-wide text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${actionClass(log.action)}`}>
                          {titleCaseAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <p className="font-medium">{log.targetType || "Hotel"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{shortId(log.targetId)}</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{shortId(log.actorUserId)}</td>
                      <td className="max-w-md px-4 py-4 text-sm text-muted-foreground" title={log.details || ""}>
                        <span className="line-clamp-2">{detailPreview(log.details)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
