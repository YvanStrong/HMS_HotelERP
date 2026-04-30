"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type StaffUser = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

const ROLE_OPTIONS = [
  "MANAGER",
  "RECEPTIONIST",
  "HOUSEKEEPING",
  "HOUSEKEEPING_SUPERVISOR",
  "MAINTENANCE",
  "FNB_STAFF",
  "FINANCE",
] as const;
const PAGE_SIZE = 10;

export default function StaffManagementPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [rows, setRows] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null);
  const [nextRole, setNextRole] = useState<(typeof ROLE_OPTIONS)[number]>("HOUSEKEEPING");
  const [newPassword, setNewPassword] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState<StaffUser | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("HOUSEKEEPING");

  const counts = {
    total: rows.length,
    active: rows.filter((r) => r.isActive).length,
    hk: rows.filter((r) => r.role === "HOUSEKEEPING" || r.role === "HOUSEKEEPING_SUPERVISOR").length,
    supervisors: rows.filter((r) => r.role === "HOUSEKEEPING_SUPERVISOR").length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (activeFilter === "ACTIVE" && !r.isActive) return false;
      if (activeFilter === "INACTIVE" && r.isActive) return false;
      if (!q) return true;
      return r.username.toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q) || r.role.toLowerCase().includes(q);
    });
  }, [rows, search, roleFilter, activeFilter]);
  const paged = useMemo(() => paginateSlice(filtered, page, PAGE_SIZE), [filtered, page]);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const data = await apiFetch<StaffUser[]>(`/api/v1/hotels/${hotelId}/staff-users`);
      setRows(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load staff");
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch<StaffUser>(`/api/v1/hotels/${hotelId}/staff-users`, {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
          email: email.trim() || null,
          role,
        }),
      });
      setUsername("");
      setPassword("");
      setEmail("");
      setRole("HOUSEKEEPING");
      setMsg("Staff user created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveRoleChange() {
    if (!selectedUser) return;
    setActionLoadingId(selectedUser.id);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/staff-users/${selectedUser.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole }),
      });
      setMsg("Staff role updated.");
      setShowRoleModal(false);
      setSelectedUser(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role update failed");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function savePasswordReset() {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setActionLoadingId(selectedUser.id);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/staff-users/${selectedUser.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword }),
      });
      setMsg("Password reset completed.");
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password reset failed");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function toggleActive(user: StaffUser, activate: boolean) {
    setActionLoadingId(user.id);
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/staff-users/${user.id}/${activate ? "reactivate" : "deactivate"}`, {
        method: "POST",
      });
      setMsg(activate ? "Staff reactivated." : "Staff deactivated.");
      setConfirmDeactivate(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Staff</h1>
        <p className="text-muted-foreground mt-1">
          Create hotel staff users and assign department roles. Housekeeping roles appear in HK assignment dropdowns.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total staff users</p>
          <p className="mt-1 text-2xl font-bold">{counts.total}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active users</p>
          <p className="mt-1 text-2xl font-bold">{counts.active}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Housekeeping users</p>
          <p className="mt-1 text-2xl font-bold">{counts.hk}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">HK supervisors</p>
          <p className="mt-1 text-2xl font-bold">{counts.supervisors}</p>
        </div>
      </div>

      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      <div className="grid lg:grid-cols-[1fr_1.35fr] gap-4">
        <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Create staff user</h2>
          <form noValidate onSubmit={createUser}>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />

            <label style={{ marginTop: "0.75rem" }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />

            <label style={{ marginTop: "0.75rem" }}>Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />

            <label style={{ marginTop: "0.75rem" }}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create user"}
              </button>
            </div>
          </form>
        </div>

        <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Hotel staff users</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <input placeholder="Search username/email/role" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
              <option value="ALL">All roles</option>
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE"); setPage(1); }}>
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.slice.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>
                    <span className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800">
                      {u.role}
                    </span>
                  </td>
                  <td>{u.email ?? "—"}</td>
                  <td>{u.isActive ? "ACTIVE" : "INACTIVE"}</td>
                  <td>{u.createdAt ? new Date(u.createdAt).toLocaleString() : "—"}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="hms-btn-outline text-xs"
                        disabled={actionLoadingId === u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setNextRole((ROLE_OPTIONS.includes(u.role as (typeof ROLE_OPTIONS)[number]) ? (u.role as (typeof ROLE_OPTIONS)[number]) : "HOUSEKEEPING"));
                          setShowRoleModal(true);
                        }}
                      >
                        Role
                      </button>
                      <button
                        type="button"
                        className="hms-btn-outline text-xs"
                        disabled={actionLoadingId === u.id}
                        onClick={() => {
                          setSelectedUser(u);
                          setNewPassword("");
                          setShowPasswordModal(true);
                        }}
                      >
                        Reset password
                      </button>
                      {u.isActive ? (
                        <button type="button" className="hms-btn-outline text-xs" disabled={actionLoadingId === u.id} onClick={() => setConfirmDeactivate(u)}>
                          Deactivate
                        </button>
                      ) : (
                        <button type="button" className="hms-btn-outline text-xs" disabled={actionLoadingId === u.id} onClick={() => void toggleActive(u, true)}>
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p style={{ color: "var(--muted)", marginTop: "0.8rem" }}>
              No staff users yet for this hotel.
            </p>
          )}
          <PaginationBar
            page={page}
            totalPages={paged.totalPages}
            totalItems={paged.total}
            pageSize={PAGE_SIZE}
            noun="staff users"
            onPageChange={setPage}
          />
        </div>
      </div>

      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Update role: {selectedUser.username}</h3>
            <div className="mt-3">
              <label>Role</label>
              <select value={nextRole} onChange={(e) => setNextRole(e.target.value as (typeof ROLE_OPTIONS)[number])}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowRoleModal(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={actionLoadingId === selectedUser.id} onClick={() => void saveRoleChange()}>
                {actionLoadingId === selectedUser.id ? "Saving..." : "Save role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Reset password: {selectedUser.username}</h3>
            <div className="mt-3">
              <label>New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowPasswordModal(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={actionLoadingId === selectedUser.id} onClick={() => void savePasswordReset()}>
                {actionLoadingId === selectedUser.id ? "Saving..." : "Reset password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Deactivate {confirmDeactivate.username}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">This user will no longer be able to sign in until reactivated.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setConfirmDeactivate(null)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={actionLoadingId === confirmDeactivate.id} onClick={() => void toggleActive(confirmDeactivate, false)}>
                {actionLoadingId === confirmDeactivate.id ? "Working..." : "Confirm deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
