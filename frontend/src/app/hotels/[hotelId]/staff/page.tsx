"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type AssignableStaff = {
  id: string;
  username: string;
  role: string;
};

type StaffStatus = "Active" | "On leave";

type StaffMember = {
  id: string;
  name: string;
  role: string;
  department: string;
  status: StaffStatus;
  since: string;
  source: "backend" | "local";
};

type Draft = {
  name: string;
  username: string;
  password: string;
  email: string;
  role: string;
  department: string;
  since: string;
  status: StaffStatus;
};

const LOCAL_STAFF_KEY_PREFIX = "hms:hotel:staff:";
const ROLE_OPTIONS = [
  "HOTEL_ADMIN",
  "MANAGER",
  "RECEPTIONIST",
  "HOUSEKEEPING",
  "HOUSEKEEPING_SUPERVISOR",
  "MAINTENANCE",
  "FNB_STAFF",
  "FINANCE",
] as const;

function keyForHotel(hotelId: string): string {
  return `${LOCAL_STAFF_KEY_PREFIX}${hotelId}`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "ST";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function deptFromRole(role: string): string {
  const value = role.toUpperCase();
  if (value.includes("HOUSEKEEPING")) return "Rooms";
  if (value.includes("RECEPTION") || value.includes("FRONT")) return "Reception";
  if (value.includes("FNB") || value.includes("CHEF") || value.includes("KITCHEN")) return "F&B";
  if (value.includes("FINANCE")) return "Finance";
  return "Administration";
}

function monthYear(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function StaffPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    username: "",
    password: "",
    email: "",
    role: "",
    department: "",
    since: new Date().toISOString().slice(0, 10),
    status: "Active",
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      const fromBackend: StaffMember[] = [];

      try {
        const rows = await apiFetch<AssignableStaff[]>(`/api/v1/hotels/${hotelId}/housekeeping/assignable-staff`);
        for (const row of rows) {
          fromBackend.push({
            id: row.id,
            name: row.username,
            role: row.role,
            department: deptFromRole(row.role),
            status: "Active",
            since: new Date().toISOString().slice(0, 10),
            source: "backend",
          });
        }
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Could not load backend staff list";
          setError(message);
        }
      }

      let localRows: StaffMember[] = [];
      try {
        const raw = localStorage.getItem(keyForHotel(hotelId));
        if (raw) {
          localRows = JSON.parse(raw) as StaffMember[];
        }
      } catch {
        localRows = [];
      }

      if (cancelled) return;
      setMembers([...fromBackend, ...localRows]);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  function saveLocally(next: StaffMember[]) {
    setMembers(next);
    const localOnly = next.filter((m) => m.source === "local");
    localStorage.setItem(keyForHotel(hotelId), JSON.stringify(localOnly));
  }

  async function onAddStaff(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.role.trim() || !draft.username.trim() || !draft.password.trim()) return;

    setSaving(true);
    setError(null);

    const entry: StaffMember = {
      id: `local-${Date.now()}`,
      name: draft.name.trim(),
      role: draft.role.trim(),
      department: draft.department.trim() || deptFromRole(draft.role),
      status: draft.status,
      since: draft.since,
      source: "local",
    };

    try {
      const created = await apiFetch<{ id?: string; username: string; role: string }>(
        `/api/v1/hotels/${hotelId}/staff/users`,
        {
          method: "POST",
          body: JSON.stringify({
            username: draft.username.trim(),
            password: draft.password,
            email: draft.email.trim() || null,
            role: draft.role.trim(),
          }),
        },
      );

      const createdEntry: StaffMember = {
        ...entry,
        id: created.id || `backend-${Date.now()}`,
        name: draft.name.trim() || created.username,
        role: created.role || draft.role.trim(),
        source: "backend",
      };
      setMembers([createdEntry, ...members.filter((m) => m.id !== createdEntry.id)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create staff user";
      setError(`${message}. Saved locally only.`);
      saveLocally([entry, ...members]);
    } finally {
      setDraft({
        name: "",
        username: "",
        password: "",
        email: "",
        role: "",
        department: "",
        since: new Date().toISOString().slice(0, 10),
        status: "Active",
      });
      setSaving(false);
    }
  }

  const activeCount = useMemo(
    () => members.filter((m) => m.status === "Active").length,
    [members],
  );

  const rolesCount = useMemo(() => new Set(members.map((m) => m.role)).size, [members]);

  return (
    <div className="space-y-6">
      <section className="hms-section-card bg-white text-foreground border-[hsl(var(--primary))/0.25]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Staff Management</h1>
            <p className="text-muted-foreground text-base">
              {`${activeCount} active staff \u00b7 ${rolesCount} roles`}
            </p>
          </div>
          <span className="inline-flex h-11 items-center px-5 rounded-xl border border-[hsl(var(--primary))/0.35] bg-[hsl(var(--accent))] text-[hsl(var(--primary-hover))] font-semibold">
            + Add Staff
          </span>
        </div>

        <form onSubmit={onAddStaff} className="mt-5 grid gap-3 md:grid-cols-6">
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Display name"
            className="md:col-span-1 bg-background"
          />
          <input
            type="text"
            value={draft.username}
            onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            placeholder="Username"
            className="md:col-span-1 bg-background"
          />
          <input
            type="password"
            value={draft.password}
            onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
            placeholder="Password (min 8 chars)"
            className="md:col-span-1 bg-background"
          />
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="Email (optional)"
            className="md:col-span-1 bg-background"
          />
          <select
            value={draft.role}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                role: e.target.value,
                department: d.department || deptFromRole(e.target.value),
              }))
            }
            className="md:col-span-1 bg-background"
          >
            <option value="">Select role</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={draft.department}
            onChange={(e) => setDraft((d) => ({ ...d, department: e.target.value }))}
            placeholder="Department"
            className="md:col-span-1 bg-background"
          />
          <input
            type="date"
            value={draft.since}
            onChange={(e) => setDraft((d) => ({ ...d, since: e.target.value }))}
            className="md:col-span-1 bg-background"
          />
          <button
            type="submit"
            disabled={saving}
            className="hms-btn-solid md:col-span-1 h-full rounded-xl disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Staff"}
          </button>
        </form>

        {error && <p className="text-destructive text-sm mt-3">{error}</p>}
      </section>

      <section className="hms-section-card bg-white border-[hsl(var(--primary))/0.2]">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-wide text-sm border-b border-border">
                <th className="py-3 text-left">Name</th>
                <th className="py-3 text-left">Role</th>
                <th className="py-3 text-left">Department</th>
                <th className="py-3 text-left">Status</th>
                <th className="py-3 text-left">Since</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border/70">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--primary-hover))] flex items-center justify-center font-semibold">
                        {initialsOf(member.name)}
                      </div>
                      <div className="font-semibold text-foreground">{member.name}</div>
                    </div>
                  </td>
                  <td className="py-4 font-semibold text-foreground">{member.role}</td>
                  <td className="py-4 font-semibold text-foreground">{member.department}</td>
                  <td className="py-4">
                    <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          member.status === "Active" ? "bg-lime-500" : "bg-amber-500"
                        }`}
                      />
                      {member.status}
                    </span>
                  </td>
                  <td className="py-4 font-semibold text-foreground">{monthYear(member.since)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {members.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No staff yet. Add your first team member above.</p>
          )}
        </div>
      </section>
    </div>
  );
}
