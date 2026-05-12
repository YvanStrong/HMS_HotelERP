"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type OperationalComplaint = {
  id: string;
  guestId: string;
  guestName: string;
  reservationId: string;
  bookingReference: string | null;
  type: string;
  severity: string;
  status: string;
  assignedTo: string | null;
  assigned_to_name: string | null;
  description: string;
  resolution: string | null;
  opened_at: string;
  resolved_at: string | null;
};

type StaffUserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
};

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"] as const;

function severityBadgeClass(sev: string): string {
  switch (sev) {
    case "CRITICAL":
      return "bg-rose-600 text-white border-rose-700";
    case "HIGH":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function statusBadgeClass(st: string): string {
  switch (st) {
    case "OPEN":
      return "text-rose-700 bg-rose-50 border-rose-200";
    case "IN_PROGRESS":
      return "text-sky-800 bg-sky-50 border-sky-200";
    case "ESCALATED":
      return "text-violet-800 bg-violet-50 border-violet-200";
    case "RESOLVED":
      return "text-emerald-800 bg-emerald-50 border-emerald-200";
    case "CLOSED":
      return "text-slate-600 bg-slate-100 border-slate-200";
    default:
      return "text-slate-600 bg-muted border-border";
  }
}

function formatAging(openedAt: string, resolvedAt: string | null, status: string): string {
  const closed = status === "RESOLVED" || status === "CLOSED";
  const endMs = closed && resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const startMs = new Date(openedAt).getTime();
  const ms = Math.max(0, endMs - startMs);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return `${d}d ${rh}h${closed ? "" : " open"}`;
  }
  if (h >= 1) return `${h}h ${m}m${closed ? "" : " open"}`;
  return `${m}m${closed ? "" : " open"}`;
}

export default function OperationalComplaintsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<OperationalComplaint[]>([]);
  const [staff, setStaff] = useState<StaffUserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [cGuest, setCGuest] = useState("");
  const [cRes, setCRes] = useState("");
  const [cType, setCType] = useState("SERVICE");
  const [cSev, setCSev] = useState<string>("MEDIUM");
  const [cDesc, setCDesc] = useState("");
  const [cAssign, setCAssign] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filterStatus) qs.set("status", filterStatus);
      if (filterSeverity) qs.set("severity", filterSeverity);
      qs.set("limit", "200");
      const q = qs.toString();
      const [data, s] = await Promise.all([
        apiFetch<OperationalComplaint[]>(`/api/v1/hotels/${hotelId}/complaints${q ? `?${q}` : ""}`),
        apiFetch<StaffUserRow[]>(`/api/v1/hotels/${hotelId}/staff-users`).catch(() => [] as StaffUserRow[]),
      ]);
      setRows(data);
      setStaff(Array.isArray(s) ? s.filter((u) => u.isActive) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load complaints");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [hotelId, filterStatus, filterSeverity]);

  useEffect(() => {
    void load();
  }, [load]);

  const staffOptions = useMemo(() => staff, [staff]);

  async function createComplaint() {
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        guestId: cGuest.trim(),
        reservationId: cRes.trim(),
        type: cType.trim(),
        severity: cSev,
        description: cDesc.trim(),
      };
      if (cSev === "CRITICAL") {
        if (!cAssign) throw new Error("CRITICAL complaints require an assignee.");
        body.assignedTo = cAssign;
      } else if (cAssign) {
        body.assignedTo = cAssign;
      }
      await apiFetch<OperationalComplaint>(`/api/v1/hotels/${hotelId}/complaints`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCDesc("");
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Operational complaints</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Severity, assignment, and resolution workflow. Linked to guest stays (active or historical). CRITICAL cases
              must have an owner until resolved.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              For star ratings and ad-hoc feedback entries, use the guest profile{" "}
              <span className="font-medium text-foreground">Feedback &amp; Sentiment</span> tab.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
              Refresh
            </button>
            <button
              type="button"
              className="hms-btn-solid text-sm"
              onClick={() => setCreateOpen((v) => !v)}
            >
              {createOpen ? "Hide form" : "New complaint"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Status
            <select
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Severity
            <select
              className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
            >
              <option value="">All</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </div>

      {createOpen && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold">Open a case</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Guest ID (UUID)</span>
              <input className="w-full rounded-md border border-border px-2 py-1.5 font-mono text-xs" value={cGuest} onChange={(e) => setCGuest(e.target.value)} placeholder="Guest UUID" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Reservation ID (UUID)</span>
              <input className="w-full rounded-md border border-border px-2 py-1.5 font-mono text-xs" value={cRes} onChange={(e) => setCRes(e.target.value)} placeholder="Reservation UUID" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Type</span>
              <input className="w-full rounded-md border border-border px-2 py-1.5" value={cType} onChange={(e) => setCType(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Severity</span>
              <select className="w-full rounded-md border border-border px-2 py-1.5" value={cSev} onChange={(e) => setCSev(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-muted-foreground">Description</span>
              <textarea className="w-full rounded-md border border-border px-2 py-1.5 min-h-[80px]" value={cDesc} onChange={(e) => setCDesc(e.target.value)} />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs text-muted-foreground">
                Assign to staff {cSev === "CRITICAL" ? "(required)" : "(optional)"}
              </span>
              <select className="w-full rounded-md border border-border px-2 py-1.5" value={cAssign} onChange={(e) => setCAssign(e.target.value)}>
                <option value="">—</option>
                {staffOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} ({u.role})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="button" className="hms-btn-solid text-sm" disabled={submitting} onClick={() => void createComplaint()}>
            {submitting ? "Saving…" : "Create complaint"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No complaints match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ComplaintCard
              key={r.id}
              row={r}
              hotelId={hotelId}
              staffOptions={staffOptions}
              expanded={expandedId === r.id}
              onToggle={() => setExpandedId((id) => (id === r.id ? null : r.id))}
              onSaved={() => void load()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintCard({
  row,
  hotelId,
  staffOptions,
  expanded,
  onToggle,
  onSaved,
}: {
  row: OperationalComplaint;
  hotelId: string;
  staffOptions: StaffUserRow[];
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [patchStatus, setPatchStatus] = useState(row.status);
  const [patchSev, setPatchSev] = useState(row.severity);
  const [patchRes, setPatchRes] = useState(row.resolution ?? "");
  const [clearAssignee, setClearAssignee] = useState(false);
  const [assignPick, setAssignPick] = useState(row.assignedTo ?? "");
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    setPatchStatus(row.status);
    setPatchSev(row.severity);
    setPatchRes(row.resolution ?? "");
    setAssignPick(row.assignedTo ?? "");
    setClearAssignee(false);
  }, [row.status, row.severity, row.resolution, row.assignedTo, row.id]);

  async function patch() {
    setBusy(true);
    setLocalErr(null);
    try {
      const body: Record<string, unknown> = {
        status: patchStatus,
        severity: patchSev,
        resolution: patchRes.trim() || null,
        clear_assignee: clearAssignee,
      };
      await apiFetch(`/api/v1/hotels/${hotelId}/complaints/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!assignPick) {
      setLocalErr("Pick a staff member to assign.");
      return;
    }
    setBusy(true);
    setLocalErr(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/complaints/${row.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigned_to: assignPick }),
      });
      onSaved();
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  const aging = formatAging(row.opened_at, row.resolved_at, row.status);
  const assigneeLabel = row.assigned_to_name || (row.assignedTo ? row.assignedTo.slice(0, 8) + "…" : "—");

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${severityBadgeClass(row.severity)}`}>
              {row.severity}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusBadgeClass(row.status)}`}>
              {row.status.replaceAll("_", " ")}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{aging}</span>
          </div>
          <p className="font-semibold truncate">
            <Link href={staffAppPath("guests", row.guestId)} className="text-primary hover:underline">
              {row.guestName}
            </Link>
            <span className="text-muted-foreground font-normal"> · {row.type.replaceAll("_", " ")}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Opened {new Date(row.opened_at).toLocaleString()}
            {row.bookingReference ? ` · Booking ${row.bookingReference}` : ""}
          </p>
        </div>
        <div className="text-right text-xs shrink-0">
          <p className="text-muted-foreground">Assigned</p>
          <p className="font-medium">{assigneeLabel}</p>
          <div className="mt-2 flex flex-wrap justify-end gap-1">
            <Link href={staffAppPath("reservations", row.reservationId)} className="hms-btn-outline text-xs">
              Stay
            </Link>
            <button type="button" className="hms-btn-outline text-xs" onClick={onToggle}>
              {expanded ? "Close" : "Update"}
            </button>
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap">{row.description}</p>
      {row.resolution && (
        <p className="mt-2 text-xs text-muted-foreground border-t border-border/40 pt-2">
          <span className="font-semibold text-foreground">Resolution:</span> {row.resolution}
        </p>
      )}

      {expanded && (
        <div className="mt-4 border-t border-border/60 pt-4 space-y-3 text-sm">
          {localErr && <p className="text-xs text-rose-600">{localErr}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Reassign</span>
              <select className="w-full rounded-md border border-border px-2 py-1.5" value={assignPick} onChange={(e) => setAssignPick(e.target.value)}>
                <option value="">—</option>
                {staffOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
              <button type="button" className="mt-1 hms-btn-solid text-xs" disabled={busy} onClick={() => void assign()}>
                Assign
              </button>
            </label>
            <label className="flex items-center gap-2 text-xs pt-6">
              <input type="checkbox" checked={clearAssignee} onChange={(e) => setClearAssignee(e.target.checked)} />
              Clear assignee on save (CRITICAL must stay assigned until resolved)
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <select className="w-full rounded-md border border-border px-2 py-1.5" value={patchStatus} onChange={(e) => setPatchStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Severity</span>
              <select className="w-full rounded-md border border-border px-2 py-1.5" value={patchSev} onChange={(e) => setPatchSev(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs text-muted-foreground">Resolution notes</span>
            <textarea className="w-full rounded-md border border-border px-2 py-1.5 min-h-[72px]" value={patchRes} onChange={(e) => setPatchRes(e.target.value)} />
          </label>
          <button type="button" className="hms-btn-solid text-sm" disabled={busy} onClick={() => void patch()}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
