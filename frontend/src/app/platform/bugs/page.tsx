"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

type BugStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "WONT_FIX";
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type BugReport = {
  id: string;
  reporterUserId?: string | null;
  hotelId?: string | null;
  reporterUsername?: string | null;
  reporterEmail?: string | null;
  reporterRole?: string | null;
  pageUrl?: string | null;
  title: string;
  description: string;
  severity: Severity;
  status: BugStatus;
  adminNotes?: string | null;
  emailSent: boolean;
  emailError?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};

const STATUSES: BugStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "WONT_FIX"];

function severityClass(s: Severity) {
  switch (s) {
    case "CRITICAL":
      return "bg-red-100 text-red-800";
    case "HIGH":
      return "bg-orange-100 text-orange-800";
    case "LOW":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-amber-100 text-amber-900";
  }
}

export default function PlatformBugsPage() {
  const [rows, setRows] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | BugStatus>("");
  const [selected, setSelected] = useState<BugReport | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<BugStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = statusFilter ? `?status=${statusFilter}` : "";
      const data = await apiFetch<BugReport[]>(`/api/v1/platform/bug-reports${q}`, { quiet: true });
      setRows(data ?? []);
      setError(null);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not load bug reports.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selected) {
      setNotes(selected.adminNotes ?? "");
      setStatus(selected.status);
    }
  }, [selected]);

  const openCount = useMemo(() => rows.filter((r) => r.status === "OPEN").length, [rows]);

  async function saveSelected() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiFetch<BugReport>(`/api/v1/platform/bug-reports/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNotes: notes }),
      });
      setSelected(updated);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bug reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issues submitted by staff. Each report is also emailed to the support inbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | BugStatus)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button type="button" className="hms-btn-outline" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Loaded</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open in view</p>
          <p className="mt-1 text-2xl font-bold">{openCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email delivered</p>
          <p className="mt-1 text-2xl font-bold">{rows.filter((r) => r.emailSent).length}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No bug reports yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className={`w-full bg-transparent px-4 py-3 text-left hover:bg-slate-50 ${
                      selected?.id === row.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${severityClass(row.severity)}`}>
                        {row.severity}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {row.status.replace(/_/g, " ")}
                      </span>
                      {!row.emailSent && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Email pending/failed
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{row.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.reporterUsername || "Unknown"} · {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-white p-5">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a report to review and update status.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold">{selected.title}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selected.description}</p>
              </div>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Reporter</dt>
                  <dd>
                    {selected.reporterUsername || "—"}
                    {selected.reporterEmail ? ` · ${selected.reporterEmail}` : ""}
                    {selected.reporterRole ? ` · ${selected.reporterRole}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Page</dt>
                  <dd className="break-all">{selected.pageUrl || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-muted-foreground">Hotel ID</dt>
                  <dd className="break-all">{selected.hotelId || "—"}</dd>
                </div>
                {selected.emailError && (
                  <div>
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">Email error</dt>
                    <dd className="text-amber-800">{selected.emailError}</dd>
                  </div>
                )}
              </dl>
              <label className="block text-sm">
                <span className="font-medium">Status</span>
                <select
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BugStatus)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium">Admin notes</span>
                <textarea
                  className="mt-1 w-full min-h-[100px] rounded-xl border border-border px-3 py-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button type="button" className="hms-btn-solid" disabled={saving} onClick={() => void saveSelected()}>
                {saving ? "Saving…" : "Save updates"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
