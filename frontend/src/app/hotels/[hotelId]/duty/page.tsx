"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type StaffUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
};

type DutyShift = {
  id: string;
  userId: string;
  username: string;
  email?: string | null;
  role?: string | null;
  dutyDate: string;
  shiftCode: string;
  startTime: string;
  endTime: string;
  department?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  createdAt?: string | null;
};

type DutySummary = {
  date: string;
  total: number;
  scheduled: number;
  onDuty: number;
  completed: number;
  absent: number;
  cancelled: number;
  noShow: number;
};

const SHIFT_OPTIONS = ["MORNING", "AFTERNOON", "NIGHT", "CUSTOM"] as const;
const STATUS_OPTIONS = ["SCHEDULED", "ON_DUTY", "COMPLETED", "ABSENT", "NO_SHOW", "CANCELLED"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function daysAheadIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusTone(status: string) {
  switch (status) {
    case "ON_DUTY":
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    case "COMPLETED":
      return "bg-sky-50 text-sky-800 border-sky-200";
    case "SCHEDULED":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "ABSENT":
    case "NO_SHOW":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "CANCELLED":
      return "bg-red-50 text-red-800 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function prettyTime(value?: string | null) {
  if (!value) return "—";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export default function DutyRosterPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [rows, setRows] = useState<DutyShift[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [summary, setSummary] = useState<DutySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(daysAheadIso(14));
  const [shiftFilter, setShiftFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [focusDate, setFocusDate] = useState(todayIso());

  const [userId, setUserId] = useState("");
  const [dutyDate, setDutyDate] = useState(todayIso());
  const [shiftCode, setShiftCode] = useState<(typeof SHIFT_OPTIONS)[number]>("MORNING");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("14:00");

  const load = useCallback(async () => {
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const qs = new URLSearchParams({ from, to });
      if (shiftFilter !== "ALL") qs.set("shift", shiftFilter);
      if (statusFilter !== "ALL") qs.set("status", statusFilter);
      const [dutyRows, summaryRow, staffRows] = await Promise.all([
        apiFetch<DutyShift[]>(`/api/v1/hotels/${hotelId}/duty?${qs.toString()}`),
        apiFetch<DutySummary>(`/api/v1/hotels/${hotelId}/duty/summary?date=${encodeURIComponent(focusDate)}`),
        apiFetch<StaffUser[]>(`/api/v1/hotels/${hotelId}/staff-users`),
      ]);
      setRows(dutyRows);
      setSummary(summaryRow);
      const activeStaff = staffRows.filter((s) => s.isActive);
      setStaff(activeStaff);
      setUserId((prev) => prev || activeStaff[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load duty roster");
    } finally {
      setLoading(false);
    }
  }, [hotelId, from, to, shiftFilter, statusFilter, focusDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (shiftCode === "MORNING") {
      setStartTime("06:00");
      setEndTime("14:00");
    } else if (shiftCode === "AFTERNOON") {
      setStartTime("14:00");
      setEndTime("22:00");
    } else if (shiftCode === "NIGHT") {
      setStartTime("22:00");
      setEndTime("06:00");
    }
  }, [shiftCode]);

  const historyRows = useMemo(() => {
    const today = todayIso();
    return rows.filter((r) => r.dutyDate < today || ["COMPLETED", "ABSENT", "NO_SHOW", "CANCELLED"].includes(r.status));
  }, [rows]);

  const upcomingRows = useMemo(() => {
    const today = todayIso();
    return rows.filter(
      (r) => r.dutyDate >= today && ["SCHEDULED", "ON_DUTY"].includes(r.status),
    );
  }, [rows]);

  async function createDuty(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Select a staff member.");
      return;
    }
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/duty`, {
        method: "POST",
        body: JSON.stringify({
          userId,
          dutyDate,
          shiftCode,
          startTime: `${startTime}:00`.slice(0, 8),
          endTime: `${endTime}:00`.slice(0, 8),
          department: department || null,
          location: location || null,
          notes: notes || null,
        }),
      });
      setNotes("");
      setMsg("Duty shift scheduled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create duty shift");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/duty/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setMsg(`Marked as ${status.replaceAll("_", " ").toLowerCase()}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/60 bg-card p-6 shadow-soft">
        <h1 className="text-2xl font-bold tracking-tight">Duty & shifts</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Schedule staff by date and shift, track who is on duty, and keep history for coverage planning and
          accountability. Filter by date range, shift, and status.
        </p>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {msg && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{msg}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Focus date total" value={String(summary?.total ?? 0)} />
        <Stat label="On duty" value={String(summary?.onDuty ?? 0)} />
        <Stat label="Scheduled" value={String(summary?.scheduled ?? 0)} />
        <Stat label="Gaps / absent" value={String((summary?.absent ?? 0) + (summary?.noShow ?? 0))} />
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="text-sm">
            Shift
            <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
              <option value="ALL">All shifts</option>
              {SHIFT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Status
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Summary date
            <input type="date" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold">Schedule a duty</h2>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" onSubmit={(e) => void createDuty(e)}>
          <label className="text-sm">
            Staff
            <select required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Select staff…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.username} · {s.role}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date
            <input type="date" required value={dutyDate} onChange={(e) => setDutyDate(e.target.value)} />
          </label>
          <label className="text-sm">
            Shift
            <select value={shiftCode} onChange={(e) => setShiftCode(e.target.value as (typeof SHIFT_OPTIONS)[number])}>
              {SHIFT_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Start
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="text-sm">
            End
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label className="text-sm">
            Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Front desk, HK…" />
          </label>
          <label className="text-sm">
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lobby, Floor 2…" />
          </label>
          <label className="text-sm md:col-span-2">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Coverage notes" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="hms-btn-solid" disabled={busy || loading}>
              {busy ? "Saving…" : "Add to roster"}
            </button>
          </div>
        </form>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6">Loading duty roster…</div>
      ) : (
        <>
          <DutyTable
            title="Upcoming & active"
            empty="No scheduled or on-duty shifts in this range."
            rows={upcomingRows}
            busy={busy}
            onStatus={setStatus}
            actions
          />
          <DutyTable
            title="Duty history"
            empty="No historical duty records in this range yet."
            rows={historyRows}
            busy={busy}
            onStatus={setStatus}
            actions={false}
          />
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DutyTable({
  title,
  empty,
  rows,
  busy,
  onStatus,
  actions,
}: {
  title: string;
  empty: string;
  rows: DutyShift[];
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  actions: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="hms-table text-sm">
          <thead>
            <tr>
              <th>Date</th>
              <th>Staff</th>
              <th>Shift</th>
              <th>Hours</th>
              <th>Dept / location</th>
              <th>Status</th>
              {actions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.dutyDate}</td>
                <td>
                  <div className="font-medium">{r.username}</div>
                  <div className="text-xs text-muted-foreground">{r.role?.replaceAll("_", " ")}</div>
                </td>
                <td>{r.shiftCode}</td>
                <td>
                  {prettyTime(r.startTime)} – {prettyTime(r.endTime)}
                </td>
                <td>
                  <div>{r.department || "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.location || ""}</div>
                </td>
                <td>
                  <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusTone(r.status)}`}>
                    {r.status.replaceAll("_", " ")}
                  </span>
                </td>
                {actions && (
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {r.status === "SCHEDULED" && (
                        <>
                          <button type="button" className="hms-btn-solid hms-btn-sm" disabled={busy} onClick={() => onStatus(r.id, "ON_DUTY")}>
                            Check in
                          </button>
                          <button type="button" className="hms-btn-outline hms-btn-sm" disabled={busy} onClick={() => onStatus(r.id, "ABSENT")}>
                            Absent
                          </button>
                          <button type="button" className="hms-btn-outline hms-btn-sm" disabled={busy} onClick={() => onStatus(r.id, "CANCELLED")}>
                            Cancel
                          </button>
                        </>
                      )}
                      {r.status === "ON_DUTY" && (
                        <button type="button" className="hms-btn-solid hms-btn-sm" disabled={busy} onClick={() => onStatus(r.id, "COMPLETED")}>
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={actions ? 7 : 6} className="py-6 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
