"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadAuthUser, type AuthUser } from "@/lib/auth";
import { PaginationBar } from "@/components/PaginationBar";
import { paginateSlice } from "@/lib/pagination";

const HR_MANAGER_ROLES = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "FINANCE"] as const;

function canManageHr(user: AuthUser | null) {
  if (!user) return false;
  return HR_MANAGER_ROLES.includes(user.role as (typeof HR_MANAGER_ROLES)[number]);
}

// ── Types ────────────────────────────────────────────────────────────────────

type HrDashboard = {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  remoteEmployees: number;
  pendingLeaveRequests: number;
  openPositions: number;
  totalCandidates: number;
};

type EmployeeRow = {
  id: string | null;
  userId: string;
  username: string;
  email: string | null;
  role: string;
  isActive: boolean;
  department: string | null;
  jobTitle: string | null;
  employmentType: string | null;
  employmentStatus: string | null;
  hireDate: string | null;
  baseSalary: number | null;
  salaryCurrency: string | null;
  phone: string | null;
  address: string | null;
  nationalId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  notes: string | null;
  hasHrProfile: boolean;
};

type PayrollRecord = {
  id: string;
  userId: string;
  username: string;
  department: string | null;
  periodYear: number;
  periodMonth: number;
  basePay: number;
  bonus: number;
  overtimePay: number;
  benefits: number;
  deductions: number;
  netPay: number;
  currency: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type LeaveTypeRow = {
  id: string;
  name: string;
  annualDaysAllowed: number;
  isPaid: boolean;
  description: string | null;
  isActive: boolean;
};

type LeaveBalanceRow = {
  id: string;
  userId: string;
  username: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isPaidLeave: boolean;
  year: number;
  daysAllocated: number;
  daysUsed: number;
  daysPending: number;
  daysRemaining: number;
};

type LeaveRequestRow = {
  id: string;
  userId: string;
  username: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
};

type JobPositionRow = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  employmentType: string;
  location: string | null;
  status: string;
  postedDate: string | null;
  deadlineDate: string | null;
  candidateCount: number;
};

type CandidateRow = {
  id: string;
  jobPositionId: string | null;
  jobTitle: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  stage: string;
  appliedDate: string;
  stageUpdatedAt: string;
  notes: string | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"];
const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "REMOTE", "TERMINATED"];
const CANDIDATE_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED"];
const PAGE_SIZE = 12;
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function statusBadgeClass(status: string) {
  switch (status) {
    case "ACTIVE": return "bg-green-100 text-green-800";
    case "ON_LEAVE": return "bg-yellow-100 text-yellow-800";
    case "REMOTE": return "bg-blue-100 text-blue-800";
    case "TERMINATED": return "bg-red-100 text-red-800";
    case "OPEN": return "bg-green-100 text-green-800";
    case "CLOSED": return "bg-gray-200 text-gray-700";
    case "ON_HOLD": return "bg-yellow-100 text-yellow-800";
    case "APPROVED": return "bg-green-100 text-green-800";
    case "PENDING": return "bg-yellow-100 text-yellow-800";
    case "REJECTED": return "bg-red-100 text-red-800";
    case "DRAFT": return "bg-gray-100 text-gray-700";
    case "PAID": return "bg-emerald-100 text-emerald-800";
    case "APPLIED": return "bg-blue-50 text-blue-700";
    case "SCREENING": return "bg-indigo-100 text-indigo-700";
    case "INTERVIEW": return "bg-purple-100 text-purple-700";
    case "OFFER": return "bg-orange-100 text-orange-700";
    case "HIRED": return "bg-green-100 text-green-800";
    case "CANCELLED": return "bg-gray-200 text-gray-600";
    default: return "bg-muted text-foreground";
  }
}

function fmt(val: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(val);
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HrPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [user, setUser] = useState<AuthUser | null>(null);
  const manageHr = canManageHr(user);

  const [tab, setTab] = useState<"employees" | "payroll" | "leave" | "recruitment">("employees");
  const [dashboard, setDashboard] = useState<HrDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setUser(loadAuthUser());
  }, []);

  useEffect(() => {
    if (user && !manageHr) setTab("leave");
  }, [user, manageHr]);

  const loadDashboard = useCallback(async () => {
    if (!manageHr) return;
    try {
      const data = await apiFetch<HrDashboard>(`/api/v1/hotels/${hotelId}/hr`);
      setDashboard(data);
    } catch {
      // non-blocking
    }
  }, [hotelId, manageHr]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const tabs = manageHr
    ? ([
        { key: "employees", label: "Employees" },
        { key: "payroll", label: "Payroll" },
        { key: "leave", label: "Leave" },
        { key: "recruitment", label: "Recruitment" },
      ] as const)
    : ([
        { key: "leave", label: "My Leave" },
        { key: "payroll", label: "My Payroll" },
      ] as const);

  const staffTitle = tab === "payroll" ? "My Payroll" : "My Leave";
  const staffSubtitle =
    tab === "payroll"
      ? "View your payslips and payroll history for this hotel."
      : "See available leave types, request time off, and track your requests.";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">{manageHr ? "HR Management" : staffTitle}</h1>
        <p className="text-muted-foreground mt-1">
          {manageHr
            ? "Employees, payroll, leave, and recruitment — all in one place."
            : staffSubtitle}
        </p>
      </div>

      {/* KPI cards */}
      {manageHr && dashboard && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total employees", value: dashboard.totalEmployees },
            { label: "Active", value: dashboard.activeEmployees },
            { label: "On leave", value: dashboard.onLeaveEmployees },
            { label: "Remote", value: dashboard.remoteEmployees },
            { label: "Pending leave", value: dashboard.pendingLeaveRequests },
            { label: "Open positions", value: dashboard.openPositions },
            { label: "Total candidates", value: dashboard.totalCandidates },
          ].map((c) => (
            <div key={c.label} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Global feedback */}
      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      {/* Tab bar */}
      {tabs.length > 1 && (
      <div className="flex gap-1 border-b border-border/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(null); setMsg(null); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {/* Tab panels */}
      {tab === "employees" && (
        <EmployeesTab hotelId={hotelId} onError={setError} onMsg={(m) => { setMsg(m); void loadDashboard(); }} />
      )}
      {tab === "payroll" && (
        manageHr ? (
          <PayrollTab hotelId={hotelId} onError={setError} onMsg={setMsg} />
        ) : (
          <StaffPayrollTab hotelId={hotelId} onError={setError} />
        )
      )}
      {tab === "leave" && (
        manageHr ? (
          <LeaveTab hotelId={hotelId} onError={setError} onMsg={(m) => { setMsg(m); void loadDashboard(); }} />
        ) : (
          <StaffLeaveTab hotelId={hotelId} onError={setError} onMsg={setMsg} />
        )
      )}
      {tab === "recruitment" && (
        <RecruitmentTab hotelId={hotelId} onError={setError} onMsg={(m) => { setMsg(m); void loadDashboard(); }} />
      )}
    </div>
  );
}

// ── Employees Tab ─────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  "MANAGER","RECEPTIONIST","HOUSEKEEPING","HOUSEKEEPING_SUPERVISOR",
  "MAINTENANCE","FNB_STAFF","FINANCE","HOTEL_ADMIN",
] as const;

function EmployeesTab({ hotelId, onError, onMsg }: { hotelId: string; onError: (e: string | null) => void; onMsg: (m: string) => void }) {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);

  // HR data form
  const [eDept, setEDept] = useState("");
  const [eTitle, setETitle] = useState("");
  const [eType, setEType] = useState("FULL_TIME");
  const [eHrStatus, setEHrStatus] = useState("ACTIVE");
  const [eHireDate, setEHireDate] = useState("");
  const [eSalary, setESalary] = useState("");
  const [eCurrency, setECurrency] = useState("USD");
  const [ePhone, setEPhone] = useState("");
  const [eAddress, setEAddress] = useState("");
  const [eNationalId, setENationalId] = useState("");
  const [eEcName, setEEcName] = useState("");
  const [eEcPhone, setEEcPhone] = useState("");
  const [eNotes, setENotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await apiFetch<EmployeeRow[]>(`/api/v1/hotels/${hotelId}/hr/employees`);
      setRows(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [hotelId, onError]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "ALL" && r.role !== roleFilter) return false;
      if (activeFilter === "ACTIVE" && !r.isActive) return false;
      if (activeFilter === "INACTIVE" && r.isActive) return false;
      if (!q) return true;
      return (
        r.username.toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (r.role ?? "").toLowerCase().includes(q) ||
        (r.department ?? "").toLowerCase().includes(q) ||
        (r.jobTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, roleFilter, activeFilter]);

  const paged = useMemo(() => paginateSlice(filtered, page, PAGE_SIZE), [filtered, page]);

  function openHrData(emp: EmployeeRow) {
    setEditTarget(emp);
    setEDept(emp.department ?? "");
    setETitle(emp.jobTitle ?? "");
    setEType(emp.employmentType ?? "FULL_TIME");
    setEHrStatus(emp.employmentStatus ?? "ACTIVE");
    setEHireDate(emp.hireDate ?? "");
    setESalary(emp.baseSalary != null ? String(emp.baseSalary) : "");
    setECurrency(emp.salaryCurrency ?? "USD");
    setEPhone(emp.phone ?? "");
    setEAddress(emp.address ?? "");
    setENationalId(emp.nationalId ?? "");
    setEEcName(emp.emergencyContactName ?? "");
    setEEcPhone(emp.emergencyContactPhone ?? "");
    setENotes(emp.notes ?? "");
  }

  async function saveHrData() {
    if (!editTarget) return;
    setSaving(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/employees/${editTarget.userId}/profile`, {
        method: "PUT",
        body: JSON.stringify({
          department: eDept || null,
          jobTitle: eTitle || null,
          employmentType: eType,
          employmentStatus: eHrStatus,
          hireDate: eHireDate || null,
          baseSalary: eSalary ? parseFloat(eSalary) : null,
          salaryCurrency: eCurrency || "USD",
          phone: ePhone || null,
          address: eAddress || null,
          nationalId: eNationalId || null,
          emergencyContactName: eEcName || null,
          emergencyContactPhone: eEcPhone || null,
          notes: eNotes || null,
        }),
      });
      onMsg("HR data saved.");
      setEditTarget(null);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="Search name, email, role, department..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: "1 1 200px" }}
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="ALL">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value as typeof activeFilter); setPage(1); }}>
          <option value="ALL">All accounts</option>
          <option value="ACTIVE">Active accounts</option>
          <option value="INACTIVE">Inactive accounts</option>
        </select>
        <button type="button" className="hms-btn-outline" onClick={() => void load()}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Account</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>HR Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.slice.map((emp) => (
              <tr key={emp.userId}>
                <td>
                  <div className="font-medium">{emp.username}</div>
                  {emp.email && <div className="text-xs text-muted-foreground">{emp.email}</div>}
                </td>
                <td>
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold bg-muted text-foreground">
                    {emp.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${emp.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                    {emp.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  {emp.department
                    ? <span className="inline-block rounded-md px-2 py-0.5 text-xs bg-muted text-foreground">{emp.department}</span>
                    : <span className="text-xs text-muted-foreground">Not set</span>}
                </td>
                <td>
                  {emp.jobTitle
                    ? <span className="text-sm">{emp.jobTitle}</span>
                    : <span className="text-xs text-muted-foreground">Not set</span>}
                </td>
                <td>
                  {emp.employmentStatus
                    ? <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(emp.employmentStatus)}`}>
                        {emp.employmentStatus.replace(/_/g, " ")}
                      </span>
                    : <span className="text-xs text-muted-foreground">Not set</span>}
                </td>
                <td>
                  <button
                    type="button"
                    className={`text-xs ${emp.hasHrProfile ? "hms-btn-outline" : "hms-btn-solid"}`}
                    onClick={() => openHrData(emp)}
                  >
                    {emp.hasHrProfile ? "Edit HR Data" : "Add HR Data"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && (
          <p className="p-4 text-muted-foreground text-sm">No staff users found.</p>
        )}
        <div className="p-3">
          <PaginationBar page={page} totalPages={paged.totalPages} totalItems={paged.total} pageSize={PAGE_SIZE} noun="employees" onPageChange={setPage} />
        </div>
      </div>

      {/* HR Data modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl space-y-3 my-4">
            <div>
              <h3 className="text-lg font-semibold">HR Data — {editTarget.username}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Role: <span className="font-medium">{editTarget.role.replace(/_/g, " ")}</span>
                {" · "}Account: <span className="font-medium">{editTarget.isActive ? "Active" : "Inactive"}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Department</label>
                <input value={eDept} onChange={(e) => setEDept(e.target.value)} placeholder="e.g. Housekeeping" />
              </div>
              <div>
                <label>Job Title</label>
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="e.g. Supervisor" />
              </div>
              <div>
                <label>Employment Type</label>
                <select value={eType} onChange={(e) => setEType(e.target.value)}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label>HR Status</label>
                <select value={eHrStatus} onChange={(e) => setEHrStatus(e.target.value)}>
                  {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label>Hire Date</label>
                <input type="date" value={eHireDate} onChange={(e) => setEHireDate(e.target.value)} />
              </div>
              <div>
                <label>National ID</label>
                <input value={eNationalId} onChange={(e) => setENationalId(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <label>Base Salary</label>
                <input type="number" min="0" step="0.01" value={eSalary} onChange={(e) => setESalary(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label>Currency</label>
                <input value={eCurrency} onChange={(e) => setECurrency(e.target.value)} placeholder="USD" />
              </div>
              <div>
                <label>Phone</label>
                <input value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div>
              <label>Address</label>
              <input value={eAddress} onChange={(e) => setEAddress(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Emergency Contact</label>
                <input value={eEcName} onChange={(e) => setEEcName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <label>Emergency Phone</label>
                <input value={eEcPhone} onChange={(e) => setEEcPhone(e.target.value)} placeholder="+1 555 000 0000" />
              </div>
            </div>

            <div>
              <label>Notes</label>
              <input value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Optional internal notes" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="hms-btn-outline" onClick={() => setEditTarget(null)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={saving} onClick={() => void saveHrData()}>
                {saving ? "Saving..." : "Save HR Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Payroll Tab ───────────────────────────────────────────────────────────────

function PayrollTab({ hotelId, onError, onMsg }: { hotelId: string; onError: (e: string | null) => void; onMsg: (m: string) => void }) {
  const now = new Date();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [staffOptions, setStaffOptions] = useState<EmployeeRow[]>([]);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // create form
  const [showCreate, setShowCreate] = useState(false);
  const [cUserId, setCUserId] = useState("");
  const [cYear, setCYear] = useState(filterYear);
  const [cMonth, setCMonth] = useState(filterMonth);
  const [cBase, setCBase] = useState("");
  const [cBonus, setCBonus] = useState("0");
  const [cOvertime, setCOvertime] = useState("0");
  const [cBenefits, setCBenefits] = useState("0");
  const [cDeductions, setCDeductions] = useState("0");
  const [cNotes, setCNotes] = useState("");
  const [cCurrency, setCCurrency] = useState("USD");
  const [creating, setCreating] = useState(false);

  // payslip modal
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await apiFetch<PayrollRecord[]>(
        `/api/v1/hotels/${hotelId}/hr/payroll?year=${filterYear}&month=${filterMonth}`
      );
      setRecords(data);
      setPage(1);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }, [hotelId, filterYear, filterMonth, onError]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<EmployeeRow[]>(`/api/v1/hotels/${hotelId}/hr/employees`);
        setStaffOptions(data.filter((e) => e.isActive));
      } catch {
        setStaffOptions([]);
      }
    })();
  }, [hotelId]);

  const paged = useMemo(() => paginateSlice(records, page, PAGE_SIZE), [records, page]);

  function staffOptionLabel(emp: EmployeeRow) {
    const parts = [emp.username];
    if (emp.department) parts.push(emp.department);
    if (emp.jobTitle) parts.push(emp.jobTitle);
    return parts.join(" · ");
  }

  function onStaffSelect(userId: string) {
    setCUserId(userId);
    const emp = staffOptions.find((e) => e.userId === userId);
    if (!emp) {
      setCBase("");
      return;
    }
    if (emp.baseSalary != null && Number(emp.baseSalary) > 0) {
      setCBase(String(emp.baseSalary));
    } else {
      setCBase("");
    }
    if (emp.salaryCurrency?.trim()) {
      setCCurrency(emp.salaryCurrency.trim());
    }
  }

  async function createRecord() {
    if (!cUserId.trim() || !cBase) { onError("Staff member and base pay are required"); return; }
    setCreating(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/payroll`, {
        method: "POST",
        body: JSON.stringify({
          userId: cUserId.trim(),
          periodYear: cYear,
          periodMonth: cMonth,
          basePay: parseFloat(cBase),
          bonus: parseFloat(cBonus) || 0,
          overtimePay: parseFloat(cOvertime) || 0,
          benefits: parseFloat(cBenefits) || 0,
          deductions: parseFloat(cDeductions) || 0,
          currency: cCurrency,
          notes: cNotes || null,
        }),
      });
      onMsg("Payroll record created.");
      setShowCreate(false);
      setCUserId(""); setCBase(""); setCBonus("0"); setCOvertime("0"); setCBenefits("0"); setCDeductions("0"); setCNotes("");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function reviewRecord(recordId: string, approve: boolean) {
    setActioning(recordId);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/payroll/${recordId}/review`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      onMsg(approve ? "Payroll approved." : "Payroll rejected.");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  async function markPaid(recordId: string) {
    setActioning(recordId);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/payroll/${recordId}/paid`, { method: "POST" });
      onMsg("Payroll marked as paid.");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Year</label>
          <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Month</label>
          <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <button type="button" className="hms-btn-outline" onClick={() => void load()}>{loading ? "Loading..." : "Load"}</button>
        <button type="button" className="hms-btn-solid" onClick={() => setShowCreate(true)}>+ New Record</button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Period</th>
              <th>Base Pay</th>
              <th>Bonus</th>
              <th>Overtime</th>
              <th>Benefits</th>
              <th>Deductions</th>
              <th>Net Pay</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.slice.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="font-medium">{r.username}</div>
                  {r.department && <div className="text-xs text-muted-foreground">{r.department}</div>}
                </td>
                <td>{MONTHS[r.periodMonth - 1]} {r.periodYear}</td>
                <td>{fmt(r.basePay, r.currency)}</td>
                <td>{fmt(r.bonus, r.currency)}</td>
                <td>{fmt(r.overtimePay, r.currency)}</td>
                <td>{fmt(r.benefits, r.currency)}</td>
                <td>{fmt(r.deductions, r.currency)}</td>
                <td className="font-semibold">{fmt(r.netPay, r.currency)}</td>
                <td>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button type="button" className="hms-btn-outline text-xs" onClick={() => setPayslip(r)}>Payslip</button>
                    {r.status === "DRAFT" && (
                      <>
                        <button type="button" className="hms-btn-solid text-xs" disabled={actioning === r.id} onClick={() => void reviewRecord(r.id, true)}>Approve</button>
                        <button type="button" className="hms-btn-outline text-xs" disabled={actioning === r.id} onClick={() => void reviewRecord(r.id, false)}>Reject</button>
                      </>
                    )}
                    {r.status === "APPROVED" && (
                      <button type="button" className="hms-btn-solid text-xs" disabled={actioning === r.id} onClick={() => void markPaid(r.id)}>Mark Paid</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && !loading && (
          <p className="p-4 text-muted-foreground text-sm">No payroll records for {MONTHS[filterMonth - 1]} {filterYear}.</p>
        )}
        <div className="p-3">
          <PaginationBar page={page} totalPages={paged.totalPages} totalItems={paged.total} pageSize={PAGE_SIZE} noun="records" onPageChange={setPage} />
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">New Payroll Record</h3>
            <div>
              <label>Staff member</label>
              <select value={cUserId} onChange={(e) => onStaffSelect(e.target.value)} required>
                <option value="">Select employee</option>
                {staffOptions.map((emp) => (
                  <option key={emp.userId} value={emp.userId}>
                    {staffOptionLabel(emp)}
                  </option>
                ))}
              </select>
              {staffOptions.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No active staff found. Add staff users first.</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Year</label>
                <select value={cYear} onChange={(e) => setCYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label>Month</label>
                <select value={cMonth} onChange={(e) => setCMonth(Number(e.target.value))}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>Base Pay</label>
                <input type="number" min="0" step="0.01" value={cBase} onChange={(e) => setCBase(e.target.value)} placeholder="0.00" />
                <p className="mt-1 text-xs text-muted-foreground">Filled from employee HR profile when available. You can change it.</p>
              </div>
              <div>
                <label>Currency</label>
                <input value={cCurrency} onChange={(e) => setCCurrency(e.target.value)} placeholder="USD" />
              </div>
              <div>
                <label>Bonus</label>
                <input type="number" min="0" step="0.01" value={cBonus} onChange={(e) => setCBonus(e.target.value)} />
              </div>
              <div>
                <label>Overtime</label>
                <input type="number" min="0" step="0.01" value={cOvertime} onChange={(e) => setCOvertime(e.target.value)} />
              </div>
              <div>
                <label>Benefits</label>
                <input type="number" min="0" step="0.01" value={cBenefits} onChange={(e) => setCBenefits(e.target.value)} />
              </div>
              <div>
                <label>Deductions</label>
                <input type="number" min="0" step="0.01" value={cDeductions} onChange={(e) => setCDeductions(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Notes</label>
              <input value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={creating} onClick={() => void createRecord()}>
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payslip modal */}
      {payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">Payslip</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Employee</span><span className="font-medium">{payslip.username}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span>{MONTHS[payslip.periodMonth - 1]} {payslip.periodYear}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(payslip.status)}`}>{payslip.status}</span>
              </div>
              <hr className="my-2 border-border/60" />
              <div className="flex justify-between"><span>Base Pay</span><span>{fmt(payslip.basePay, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Bonus</span><span>{fmt(payslip.bonus, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Overtime</span><span>{fmt(payslip.overtimePay, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Benefits</span><span>{fmt(payslip.benefits, payslip.currency)}</span></div>
              <div className="flex justify-between text-red-600"><span>Deductions</span><span>- {fmt(payslip.deductions, payslip.currency)}</span></div>
              <hr className="my-2 border-border/60" />
              <div className="flex justify-between font-bold text-base"><span>Net Pay</span><span>{fmt(payslip.netPay, payslip.currency)}</span></div>
              {payslip.approvedBy && <div className="flex justify-between text-xs text-muted-foreground"><span>Approved by</span><span>{payslip.approvedBy}</span></div>}
              {payslip.notes && <p className="text-xs text-muted-foreground mt-1">{payslip.notes}</p>}
            </div>
            <div className="flex justify-end">
              <button type="button" className="hms-btn-outline" onClick={() => setPayslip(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff self-service payroll ─────────────────────────────────────────────────

function StaffPayrollTab({ hotelId, onError }: { hotelId: string; onError: (e: string | null) => void }) {
  const now = new Date();
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterAll, setFilterAll] = useState(true);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [payslip, setPayslip] = useState<PayrollRecord | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const url = filterAll
        ? `/api/v1/hotels/${hotelId}/hr/payroll`
        : `/api/v1/hotels/${hotelId}/hr/payroll?year=${filterYear}&month=${filterMonth}`;
      const data = await apiFetch<PayrollRecord[]>(url);
      setRecords(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load your payroll");
    } finally {
      setLoading(false);
    }
  }, [hotelId, filterAll, filterYear, filterMonth, onError]);

  useEffect(() => { void load(); }, [load]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filterAll}
            onChange={(e) => setFilterAll(e.target.checked)}
          />
          All periods
        </label>
        {!filterAll && (
          <>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Year</label>
              <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Month</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </>
        )}
        <button type="button" className="hms-btn-outline" onClick={() => void load()}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Base Pay</th>
              <th>Bonus</th>
              <th>Overtime</th>
              <th>Benefits</th>
              <th>Deductions</th>
              <th>Net Pay</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{MONTHS[r.periodMonth - 1]} {r.periodYear}</td>
                <td>{fmt(r.basePay, r.currency)}</td>
                <td>{fmt(r.bonus, r.currency)}</td>
                <td>{fmt(r.overtimePay, r.currency)}</td>
                <td>{fmt(r.benefits, r.currency)}</td>
                <td>{fmt(r.deductions, r.currency)}</td>
                <td className="font-semibold">{fmt(r.netPay, r.currency)}</td>
                <td>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  <button type="button" className="hms-btn-outline text-xs" onClick={() => setPayslip(r)}>
                    Payslip
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && !loading && (
          <p className="p-4 text-muted-foreground text-sm">
            {filterAll ? "No payroll records on file for you yet." : `No payroll for ${MONTHS[filterMonth - 1]} ${filterYear}.`}
          </p>
        )}
      </div>

      {payslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">My payslip</h3>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Period</span><span>{MONTHS[payslip.periodMonth - 1]} {payslip.periodYear}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(payslip.status)}`}>{payslip.status}</span>
              </div>
              <hr className="my-2 border-border/60" />
              <div className="flex justify-between"><span>Base Pay</span><span>{fmt(payslip.basePay, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Bonus</span><span>{fmt(payslip.bonus, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Overtime</span><span>{fmt(payslip.overtimePay, payslip.currency)}</span></div>
              <div className="flex justify-between"><span>Benefits</span><span>{fmt(payslip.benefits, payslip.currency)}</span></div>
              <div className="flex justify-between text-red-600"><span>Deductions</span><span>- {fmt(payslip.deductions, payslip.currency)}</span></div>
              <hr className="my-2 border-border/60" />
              <div className="flex justify-between font-bold text-base"><span>Net Pay</span><span>{fmt(payslip.netPay, payslip.currency)}</span></div>
              {payslip.approvedBy && <div className="flex justify-between text-xs text-muted-foreground"><span>Approved by</span><span>{payslip.approvedBy}</span></div>}
              {payslip.paidAt && <div className="flex justify-between text-xs text-muted-foreground"><span>Paid</span><span>{new Date(payslip.paidAt).toLocaleDateString()}</span></div>}
              {payslip.notes && <p className="text-xs text-muted-foreground mt-1">{payslip.notes}</p>}
            </div>
            <div className="flex justify-end">
              <button type="button" className="hms-btn-outline" onClick={() => setPayslip(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Staff self-service leave ───────────────────────────────────────────────────

function StaffLeaveTab({ hotelId, onError, onMsg }: { hotelId: string; onError: (e: string | null) => void; onMsg: (m: string) => void }) {
  const currentYear = new Date().getFullYear();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [balYear, setBalYear] = useState(currentYear);
  const [reqStatus, setReqStatus] = useState("ALL");
  const [showRequest, setShowRequest] = useState(false);
  const [reqTypeId, setReqTypeId] = useState("");
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");
  const [reqReason, setReqReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectableTypes = useMemo(() => leaveTypes.filter((lt) => lt.isActive), [leaveTypes]);
  const selectedType = leaveTypes.find((lt) => lt.id === reqTypeId);
  const canSubmitType = Boolean(selectedType?.isActive);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [types, bals, reqs] = await Promise.all([
        apiFetch<LeaveTypeRow[]>(`/api/v1/hotels/${hotelId}/hr/leave/types`),
        apiFetch<LeaveBalanceRow[]>(`/api/v1/hotels/${hotelId}/hr/leave/balances?year=${balYear}`),
        apiFetch<LeaveRequestRow[]>(
          `/api/v1/hotels/${hotelId}/hr/leave/requests${reqStatus !== "ALL" ? `?status=${reqStatus}` : ""}`,
        ),
      ]);
      setLeaveTypes(types);
      setBalances(bals);
      setRequests(reqs);
      setReqTypeId((prev) => {
        if (prev && types.some((t) => t.id === prev)) return prev;
        const first = types.find((t) => t.isActive) ?? types[0];
        return first?.id ?? "";
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, [hotelId, balYear, reqStatus, onError]);

  useEffect(() => { void load(); }, [load]);

  async function submitRequest() {
    if (!reqTypeId) { onError("Select a leave type"); return; }
    if (!canSubmitType) { onError("Select an active leave type to submit a request"); return; }
    if (!reqStart || !reqEnd) { onError("Start and end dates are required"); return; }
    if (reqEnd < reqStart) { onError("End date must be on or after start date"); return; }
    setSubmitting(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/leave/requests`, {
        method: "POST",
        body: JSON.stringify({
          leaveTypeId: reqTypeId,
          startDate: reqStart,
          endDate: reqEnd,
          reason: reqReason.trim() || null,
        }),
      });
      onMsg("Leave request submitted. Your manager will review it.");
      setShowRequest(false);
      setReqStart("");
      setReqEnd("");
      setReqReason("");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-base">Leave types</h2>
        <p className="text-xs text-muted-foreground mt-0.5">All leave types configured for your hotel.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {leaveTypes.map((lt) => (
            <span
              key={lt.id}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${
                lt.isActive ? "border-border bg-muted" : "border-border/40 bg-card text-muted-foreground"
              }`}
            >
              {lt.name} · {lt.annualDaysAllowed}d · {lt.isPaid ? "Paid" : "Unpaid"}
              {!lt.isActive ? " · Inactive" : ""}
            </span>
          ))}
          {leaveTypes.length === 0 && !loading && (
            <span className="text-sm text-muted-foreground">No leave types yet. Ask HR to add them.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="font-semibold text-base">My leave balance</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Year</label>
            <select value={balYear} onChange={(e) => setBalYear(Number(e.target.value))}>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button type="button" className="hms-btn-solid text-sm" onClick={() => setShowRequest(true)}>
            Request leave
          </button>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {balances.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b) => {
            const pct = b.daysAllocated > 0 ? Math.min(100, (b.daysUsed / b.daysAllocated) * 100) : 0;
            const pendPct = b.daysAllocated > 0 ? Math.min(100 - pct, (b.daysPending / b.daysAllocated) * 100) : 0;
            return (
              <div key={b.id} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
                <p className="font-semibold text-sm">{b.leaveTypeName}{b.isPaidLeave ? "" : " (Unpaid)"}</p>
                <p className="text-xs text-muted-foreground mt-1">{b.daysRemaining}d remaining of {b.daysAllocated}d</p>
                <div className="h-2 rounded-full bg-muted overflow-hidden flex mt-2">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  <div className="h-full bg-yellow-400 transition-all" style={{ width: `${pendPct}%` }} />
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>Used: {b.daysUsed}d</span>
                  {b.daysPending > 0 && <span className="text-yellow-600">Pending: {b.daysPending}d</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <p className="text-sm text-muted-foreground rounded-xl border border-border/60 bg-card p-4">
            No leave balance recorded for {balYear}. You can still submit a request; ask HR to set up your allocation.
          </p>
        )
      )}

      <div className="flex justify-between items-center mt-4">
        <h2 className="font-semibold text-base">My requests</h2>
        <select value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Leave type</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.leaveTypeName}</td>
                <td>{r.startDate}</td>
                <td>{r.endDate}</td>
                <td>{r.totalDays}d</td>
                <td>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td className="text-xs text-muted-foreground max-w-[200px] truncate" title={r.reviewNotes ?? r.reason ?? ""}>
                  {r.status === "REJECTED" && r.reviewNotes ? r.reviewNotes : r.reason ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && !loading && (
          <p className="p-4 text-muted-foreground text-sm">No leave requests yet. Use &quot;Request leave&quot; to submit one.</p>
        )}
      </div>

      {selectableTypes.length === 0 && leaveTypes.length > 0 && !loading && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          No active leave types right now. You can see configured types above; contact HR to activate one for requests.
        </p>
      )}

      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">Request leave</h3>
            <div>
              <label>Leave type</label>
              <select
                value={reqTypeId}
                onChange={(e) => setReqTypeId(e.target.value)}
                disabled={leaveTypes.length === 0}
              >
                {leaveTypes.length === 0 ? (
                  <option value="">No leave types available</option>
                ) : (
                  <>
                    <option value="" disabled>Select leave type</option>
                    {leaveTypes.map((lt) => (
                      <option key={lt.id} value={lt.id} disabled={!lt.isActive}>
                        {lt.name} · {lt.annualDaysAllowed}d · {lt.isPaid ? "Paid" : "Unpaid"}
                        {!lt.isActive ? " (inactive)" : ""}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Start date</label>
                <input type="date" value={reqStart} onChange={(e) => setReqStart(e.target.value)} />
              </div>
              <div>
                <label>End date</label>
                <input type="date" value={reqEnd} onChange={(e) => setReqEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Reason (optional)</label>
              <textarea
                className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={reqReason}
                onChange={(e) => setReqReason(e.target.value)}
                placeholder="Brief reason for your request"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowRequest(false)}>Cancel</button>
              <button
                type="button"
                className="hms-btn-solid"
                disabled={submitting || !canSubmitType}
                onClick={() => void submitRequest()}
              >
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leave Tab ─────────────────────────────────────────────────────────────────

function LeaveTab({ hotelId, onError, onMsg }: { hotelId: string; onError: (e: string | null) => void; onMsg: (m: string) => void }) {
  const currentYear = new Date().getFullYear();
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceRow[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [balYear, setBalYear] = useState(currentYear);
  const [reqStatus, setReqStatus] = useState("PENDING");
  const [actioning, setActioning] = useState<string | null>(null);

  // create leave type
  const [showNewType, setShowNewType] = useState(false);
  const [ltName, setLtName] = useState("");
  const [ltDays, setLtDays] = useState("14");
  const [ltPaid, setLtPaid] = useState(true);
  const [ltDesc, setLtDesc] = useState("");
  const [creatingType, setCreatingType] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [types, bals, reqs] = await Promise.all([
        apiFetch<LeaveTypeRow[]>(`/api/v1/hotels/${hotelId}/hr/leave/types`),
        apiFetch<LeaveBalanceRow[]>(`/api/v1/hotels/${hotelId}/hr/leave/balances?year=${balYear}`),
        apiFetch<LeaveRequestRow[]>(`/api/v1/hotels/${hotelId}/hr/leave/requests${reqStatus !== "ALL" ? `?status=${reqStatus}` : ""}`),
      ]);
      setLeaveTypes(types);
      setBalances(bals);
      setRequests(reqs);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  }, [hotelId, balYear, reqStatus, onError]);

  useEffect(() => { void load(); }, [load]);

  async function createLeaveType() {
    if (!ltName.trim()) { onError("Name is required"); return; }
    setCreatingType(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/leave/types`, {
        method: "POST",
        body: JSON.stringify({ name: ltName.trim(), annualDaysAllowed: parseInt(ltDays) || 0, isPaid: ltPaid, description: ltDesc || null }),
      });
      onMsg("Leave type created.");
      setShowNewType(false);
      setLtName(""); setLtDays("14"); setLtPaid(true); setLtDesc("");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreatingType(false);
    }
  }

  async function reviewRequest(requestId: string, approve: boolean) {
    setActioning(requestId);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/leave/requests/${requestId}/review`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      onMsg(approve ? "Leave request approved." : "Leave request rejected.");
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  // group balances by user
  const byUser = useMemo(() => {
    const map = new Map<string, { username: string; balances: LeaveBalanceRow[] }>();
    for (const b of balances) {
      if (!map.has(b.userId)) map.set(b.userId, { username: b.username, balances: [] });
      map.get(b.userId)!.balances.push(b);
    }
    return Array.from(map.values());
  }, [balances]);

  return (
    <div className="space-y-4">
      {/* Leave types header */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-base">Leave Types</h2>
        <button type="button" className="hms-btn-outline text-sm" onClick={() => setShowNewType(true)}>+ Add type</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {leaveTypes.map((lt) => (
          <span key={lt.id} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border ${lt.isActive ? "border-border bg-muted" : "border-border/40 bg-card text-muted-foreground line-through"}`}>
            {lt.name} · {lt.annualDaysAllowed}d · {lt.isPaid ? "Paid" : "Unpaid"}
          </span>
        ))}
        {leaveTypes.length === 0 && <span className="text-sm text-muted-foreground">No leave types configured.</span>}
      </div>

      {/* Balances */}
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Balance Year</label>
          <select value={balYear} onChange={(e) => setBalYear(Number(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>{loading ? "Loading..." : "Refresh"}</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byUser.map(({ username, balances: userBals }) => (
          <div key={username} className="rounded-xl border border-border/60 bg-card p-4 shadow-soft space-y-2">
            <p className="font-semibold text-sm">{username}</p>
            {userBals.map((b) => {
              const pct = b.daysAllocated > 0 ? Math.min(100, (b.daysUsed / b.daysAllocated) * 100) : 0;
              const pendPct = b.daysAllocated > 0 ? Math.min(100 - pct, (b.daysPending / b.daysAllocated) * 100) : 0;
              return (
                <div key={b.id}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted-foreground">{b.leaveTypeName}{b.isPaidLeave ? "" : " (Unpaid)"}</span>
                    <span>{b.daysRemaining}d / {b.daysAllocated}d left</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    <div className="h-full bg-yellow-400 transition-all" style={{ width: `${pendPct}%` }} />
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>Used: {b.daysUsed}d</span>
                    {b.daysPending > 0 && <span className="text-yellow-600">Pending: {b.daysPending}d</span>}
                  </div>
                </div>
              );
            })}
            {userBals.length === 0 && <p className="text-xs text-muted-foreground">No balances set.</p>}
          </div>
        ))}
        {byUser.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm col-span-full">No leave balances for {balYear}. Use the API to allocate balances per employee per leave type.</p>
        )}
      </div>

      {/* Requests queue */}
      <div className="flex justify-between items-center mt-4">
        <h2 className="font-semibold text-base">Leave Requests</h2>
        <select value={reqStatus} onChange={(e) => setReqStatus(e.target.value)}>
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{r.username}</td>
                <td>{r.leaveTypeName}</td>
                <td>{r.startDate}</td>
                <td>{r.endDate}</td>
                <td>{r.totalDays}d</td>
                <td>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
                <td className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>
                  {r.status === "PENDING" && (
                    <div className="flex gap-1">
                      <button type="button" className="hms-btn-solid text-xs" disabled={actioning === r.id} onClick={() => void reviewRequest(r.id, true)}>Approve</button>
                      <button type="button" className="hms-btn-outline text-xs" disabled={actioning === r.id} onClick={() => void reviewRequest(r.id, false)}>Reject</button>
                    </div>
                  )}
                  {r.status !== "PENDING" && r.reviewedBy && (
                    <span className="text-xs text-muted-foreground">by {r.reviewedBy}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {requests.length === 0 && !loading && (
          <p className="p-4 text-muted-foreground text-sm">No leave requests found.</p>
        )}
      </div>

      {/* New leave type modal */}
      {showNewType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">New Leave Type</h3>
            <div>
              <label>Name</label>
              <input value={ltName} onChange={(e) => setLtName(e.target.value)} placeholder="e.g. Annual Leave" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Annual Days</label>
                <input type="number" min="0" value={ltDays} onChange={(e) => setLtDays(e.target.value)} />
              </div>
              <div>
                <label>Paid?</label>
                <select value={ltPaid ? "yes" : "no"} onChange={(e) => setLtPaid(e.target.value === "yes")}>
                  <option value="yes">Paid</option>
                  <option value="no">Unpaid</option>
                </select>
              </div>
            </div>
            <div>
              <label>Description</label>
              <input value={ltDesc} onChange={(e) => setLtDesc(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowNewType(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={creatingType} onClick={() => void createLeaveType()}>
                {creatingType ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recruitment Tab ───────────────────────────────────────────────────────────

function RecruitmentTab({ hotelId, onError, onMsg }: { hotelId: string; onError: (e: string | null) => void; onMsg: (m: string) => void }) {
  const [positions, setPositions] = useState<JobPositionRow[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<JobPositionRow | null>(null);
  const [posFilter, setPosFilter] = useState("OPEN");
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  // create position form
  const [showNewPos, setShowNewPos] = useState(false);
  const [pTitle, setPTitle] = useState("");
  const [pDept, setPDept] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pReqs, setPReqs] = useState("");
  const [pType, setPType] = useState("FULL_TIME");
  const [pLoc, setPLoc] = useState("");
  const [pDeadline, setPDeadline] = useState("");
  const [creatingPos, setCreatingPos] = useState(false);

  // create candidate form
  const [showNewCand, setShowNewCand] = useState(false);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cPosId, setCPosId] = useState("");
  const [creatingCand, setCreatingCand] = useState(false);

  // stage modal
  const [stageTarget, setStageTarget] = useState<CandidateRow | null>(null);
  const [nextStage, setNextStage] = useState("SCREENING");
  const [stageNotes, setStageNotes] = useState("");
  const [savingStage, setSavingStage] = useState(false);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await apiFetch<JobPositionRow[]>(
        `/api/v1/hotels/${hotelId}/hr/recruitment/positions${posFilter !== "ALL" ? `?status=${posFilter}` : ""}`
      );
      setPositions(data);
      setCandidates([]);
      setSelectedPosition(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [hotelId, posFilter, onError]);

  useEffect(() => { void loadPositions(); }, [loadPositions]);

  async function loadCandidates(posId: string) {
    onError(null);
    try {
      const data = await apiFetch<CandidateRow[]>(`/api/v1/hotels/${hotelId}/hr/recruitment/candidates?positionId=${posId}`);
      setCandidates(data);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Failed to load candidates");
    }
  }

  function selectPosition(pos: JobPositionRow) {
    setSelectedPosition(pos);
    void loadCandidates(pos.id);
  }

  async function createPosition() {
    if (!pTitle.trim()) { onError("Title is required"); return; }
    setCreatingPos(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/recruitment/positions`, {
        method: "POST",
        body: JSON.stringify({
          title: pTitle.trim(), department: pDept || null, description: pDesc || null,
          requirements: pReqs || null, employmentType: pType, location: pLoc || null,
          deadlineDate: pDeadline || null,
        }),
      });
      onMsg("Job position created.");
      setShowNewPos(false);
      setPTitle(""); setPDept(""); setPDesc(""); setPReqs(""); setPLoc(""); setPDeadline("");
      await loadPositions();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreatingPos(false);
    }
  }

  async function createCandidate() {
    if (!cName.trim()) { onError("Full name is required"); return; }
    setCreatingCand(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/recruitment/candidates`, {
        method: "POST",
        body: JSON.stringify({
          jobPositionId: cPosId || (selectedPosition?.id ?? null),
          fullName: cName.trim(), email: cEmail || null, phone: cPhone || null,
        }),
      });
      onMsg("Candidate added.");
      setShowNewCand(false);
      setCName(""); setCEmail(""); setCPhone("");
      if (selectedPosition) await loadCandidates(selectedPosition.id);
      await loadPositions();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreatingCand(false);
    }
  }

  async function updatePositionStatus(posId: string, status: string) {
    setActioning(posId);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/recruitment/positions/${posId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      onMsg(`Position ${status.toLowerCase()}.`);
      await loadPositions();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActioning(null);
    }
  }

  async function saveStage() {
    if (!stageTarget) return;
    setSavingStage(true);
    onError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/hr/recruitment/candidates/${stageTarget.id}/stage`, {
        method: "PUT",
        body: JSON.stringify({ stage: nextStage, notes: stageNotes || null }),
      });
      onMsg("Candidate stage updated.");
      setStageTarget(null);
      setStageNotes("");
      if (selectedPosition) await loadCandidates(selectedPosition.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Stage update failed");
    } finally {
      setSavingStage(false);
    }
  }

  // funnel metrics
  const funnel = useMemo(() => {
    const counts = Object.fromEntries(CANDIDATE_STAGES.map((s) => [s, 0]));
    for (const c of candidates) counts[c.stage] = (counts[c.stage] ?? 0) + 1;
    return counts;
  }, [candidates]);

  const byCandidateStage = useMemo(() => {
    const map = new Map<string, CandidateRow[]>(CANDIDATE_STAGES.map((s) => [s, []]));
    for (const c of candidates) map.get(c.stage)?.push(c);
    return map;
  }, [candidates]);

  return (
    <div className="space-y-4">
      {/* Position list */}
      <div className="flex flex-wrap gap-2 items-end justify-between">
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Filter by status</label>
            <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="OPEN">Open</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void loadPositions()}>{loading ? "Loading..." : "Refresh"}</button>
        </div>
        <button type="button" className="hms-btn-solid text-sm" onClick={() => setShowNewPos(true)}>+ New Position</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((pos) => (
          <div
            key={pos.id}
            onClick={() => selectPosition(pos)}
            className={`rounded-xl border bg-card p-4 shadow-soft cursor-pointer transition-all hover:shadow-md ${selectedPosition?.id === pos.id ? "border-primary ring-1 ring-primary/20" : "border-border/60"}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-sm">{pos.title}</p>
                {pos.department && <p className="text-xs text-muted-foreground">{pos.department}</p>}
              </div>
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(pos.status)}`}>
                {pos.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{pos.employmentType.replace("_", " ")}</span>
              {pos.location && <span>· {pos.location}</span>}
              <span>· {pos.candidateCount} candidate{pos.candidateCount !== 1 ? "s" : ""}</span>
            </div>
            {pos.deadlineDate && <p className="text-xs text-muted-foreground mt-1">Deadline: {pos.deadlineDate}</p>}
            <div className="mt-2 flex gap-1 flex-wrap">
              {pos.status === "OPEN" && (
                <button type="button" className="hms-btn-outline text-xs" disabled={actioning === pos.id}
                  onClick={(e) => { e.stopPropagation(); void updatePositionStatus(pos.id, "CLOSED"); }}>
                  Close
                </button>
              )}
              {pos.status !== "OPEN" && (
                <button type="button" className="hms-btn-outline text-xs" disabled={actioning === pos.id}
                  onClick={(e) => { e.stopPropagation(); void updatePositionStatus(pos.id, "OPEN"); }}>
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))}
        {positions.length === 0 && !loading && (
          <p className="text-muted-foreground text-sm col-span-full">No job positions found. Create one to start recruiting.</p>
        )}
      </div>

      {/* Candidate pipeline */}
      {selectedPosition && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-base">Pipeline — {selectedPosition.title}</h2>
            <button type="button" className="hms-btn-solid text-sm" onClick={() => setShowNewCand(true)}>+ Add Candidate</button>
          </div>

          {/* Funnel metrics */}
          <div className="flex flex-wrap gap-2">
            {CANDIDATE_STAGES.map((stage) => (
              <div key={stage} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs">
                <span className={`inline-block w-2 h-2 rounded-full ${statusBadgeClass(stage).split(" ")[0]}`} />
                <span className="text-muted-foreground">{stage.charAt(0) + stage.slice(1).toLowerCase()}</span>
                <span className="font-bold">{funnel[stage]}</span>
              </div>
            ))}
          </div>

          {/* Kanban columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 overflow-x-auto">
            {CANDIDATE_STAGES.map((stage) => (
              <div key={stage} className="min-w-[120px]">
                <div className={`rounded-t-lg px-2 py-1 text-xs font-semibold text-center ${statusBadgeClass(stage)}`}>{stage.charAt(0) + stage.slice(1).toLowerCase()}</div>
                <div className="rounded-b-lg border border-t-0 border-border/60 bg-muted/30 min-h-[80px] p-1.5 space-y-1.5">
                  {(byCandidateStage.get(stage) ?? []).map((c) => (
                    <div key={c.id} className="rounded-lg border border-border/60 bg-card p-2 text-xs shadow-soft">
                      <p className="font-medium leading-tight">{c.fullName}</p>
                      {c.email && <p className="text-muted-foreground truncate">{c.email}</p>}
                      <button
                        type="button"
                        className="mt-1 text-xs underline text-primary"
                        onClick={() => { setStageTarget(c); setNextStage(stage); setStageNotes(c.notes ?? ""); }}
                      >
                        Move
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New position modal */}
      {showNewPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">New Job Position</h3>
            <div>
              <label>Title</label>
              <input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="e.g. Front Desk Manager" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Department</label>
                <input value={pDept} onChange={(e) => setPDept(e.target.value)} placeholder="e.g. Rooms" />
              </div>
              <div>
                <label>Type</label>
                <select value={pType} onChange={(e) => setPType(e.target.value)}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
              </div>
              <div>
                <label>Location</label>
                <input value={pLoc} onChange={(e) => setPLoc(e.target.value)} placeholder="On-site / Remote" />
              </div>
              <div>
                <label>Deadline</label>
                <input type="date" value={pDeadline} onChange={(e) => setPDeadline(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Description</label>
              <textarea rows={2} value={pDesc} onChange={(e) => setPDesc(e.target.value)} style={{ width: "100%", resize: "vertical", padding: "0.4rem", border: "1px solid var(--border)", borderRadius: "0.4rem", background: "var(--input)", color: "var(--foreground)", fontSize: "0.875rem" }} />
            </div>
            <div>
              <label>Requirements</label>
              <textarea rows={2} value={pReqs} onChange={(e) => setPReqs(e.target.value)} style={{ width: "100%", resize: "vertical", padding: "0.4rem", border: "1px solid var(--border)", borderRadius: "0.4rem", background: "var(--input)", color: "var(--foreground)", fontSize: "0.875rem" }} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowNewPos(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={creatingPos} onClick={() => void createPosition()}>
                {creatingPos ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New candidate modal */}
      {showNewCand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">Add Candidate</h3>
            {!selectedPosition && (
              <div>
                <label>Position ID</label>
                <input value={cPosId} onChange={(e) => setCPosId(e.target.value)} placeholder="Paste position UUID" />
              </div>
            )}
            <div>
              <label>Full Name</label>
              <input value={cName} onChange={(e) => setCName(e.target.value)} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} />
            </div>
            <div>
              <label>Phone</label>
              <input value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setShowNewCand(false)}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={creatingCand} onClick={() => void createCandidate()}>
                {creatingCand ? "Adding..." : "Add Candidate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stage modal */}
      {stageTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
            <h3 className="text-lg font-semibold">Move — {stageTarget.fullName}</h3>
            <div>
              <label>Stage</label>
              <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}>
                {CANDIDATE_STAGES.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div>
              <label>Notes</label>
              <input value={stageNotes} onChange={(e) => setStageNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => { setStageTarget(null); setStageNotes(""); }}>Cancel</button>
              <button type="button" className="hms-btn-solid" disabled={savingStage} onClick={() => void saveStage()}>
                {savingStage ? "Saving..." : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
