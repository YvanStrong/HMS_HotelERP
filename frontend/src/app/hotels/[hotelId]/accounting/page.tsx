"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";

type SalesAnalytics = {
  fromDate: string;
  toDate: string;
  inventoryInvoiceSales: number;
  inventoryInvoicePaid: number;
  posSales: number;
  totalSales: number;
  totalExpenses: number;
  netAfterExpenses: number;
  invoiceCount: number;
  posSaleCount: number;
  pendingPettyCashCount: number;
  pettyCashDisbursed: number;
};

type ExpenseRow = {
  id: string;
  expenseDate: string;
  category: string;
  vendor?: string | null;
  description: string;
  amount: number;
  paymentMethod?: string | null;
  referenceNo?: string | null;
  recordedBy?: string | null;
};

type PettyCashRow = {
  id: string;
  requestNumber: string;
  title: string;
  category: string;
  reason: string;
  amountRequested: number;
  amountApproved?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISBURSED";
  requestedBy?: string | null;
  approvedBy?: string | null;
  disbursedBy?: string | null;
  rejectionReason?: string | null;
  notes?: string | null;
};

type AccountingDashboard = {
  analytics: SalesAnalytics;
  expenses: ExpenseRow[];
  pettyCashRequests: PettyCashRow[];
};

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function canManageAccounting(role?: string) {
  return ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER", "FINANCE"].includes(role ?? "");
}

function canApprove(role?: string) {
  return ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"].includes(role ?? "");
}

function statusClass(status: PettyCashRow["status"]) {
  switch (status) {
    case "APPROVED":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "DISBURSED":
      return "bg-green-100 text-green-800 border-green-200";
    case "REJECTED":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-amber-100 text-amber-800 border-amber-200";
  }
}

export default function AccountingPage() {
  const params = useParams<{ hotelId: string }>();
  const hotelId = params.hotelId;
  const user = useMemo(() => loadAuthUser(), []);
  const canManage = canManageAccounting(user?.role);
  const manager = canApprove(user?.role);
  const cashier = canManage;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<AccountingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [expense, setExpense] = useState({
    expenseDate: today,
    category: "General",
    vendor: "",
    description: "",
    amount: "",
    paymentMethod: "Cash",
    referenceNo: "",
  });
  const [petty, setPetty] = useState({
    title: "",
    category: "Fuel",
    reason: "",
    amountRequested: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ from, to });
      const payload = await apiFetch<AccountingDashboard>(`/api/v1/hotels/${hotelId}/accounting?${q}`, {
        quiet: !canManage,
      });
      setData(payload);
    } catch (e) {
      setData(null);
      if (canManage) setError(e instanceof Error ? e.message : "Failed to load accounting");
    } finally {
      setLoading(false);
    }
  }, [hotelId, from, to, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitExpense(e: React.FormEvent) {
    e.preventDefault();
    setBusy("expense");
    setError(null);
    try {
      await apiFetch<ExpenseRow>(`/api/v1/hotels/${hotelId}/accounting/expenses`, {
        method: "POST",
        body: JSON.stringify({
          ...expense,
          amount: Number(expense.amount),
          vendor: expense.vendor || null,
          referenceNo: expense.referenceNo || null,
        }),
      });
      setExpense((prev) => ({ ...prev, vendor: "", description: "", amount: "", referenceNo: "" }));
      setMsg("Expense recorded.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record expense");
    } finally {
      setBusy(null);
    }
  }

  async function submitPettyCash(e: React.FormEvent) {
    e.preventDefault();
    setBusy("petty");
    setError(null);
    try {
      await apiFetch<PettyCashRow>(`/api/v1/hotels/${hotelId}/accounting/petty-cash`, {
        method: "POST",
        body: JSON.stringify({ ...petty, amountRequested: Number(petty.amountRequested) }),
      });
      setPetty({ title: "", category: "Fuel", reason: "", amountRequested: "", notes: "" });
      setMsg("Petty cash request sent to manager.");
      if (canManage) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send petty cash request");
    } finally {
      setBusy(null);
    }
  }

  async function pettyAction(id: string, action: "approve" | "reject" | "disburse") {
    const amountApproved =
      action === "approve" ? window.prompt("Approved amount (leave blank to approve requested amount):") : null;
    const rejectionReason = action === "reject" ? window.prompt("Why reject this request?") : null;
    if (action === "reject" && !rejectionReason) return;
    setBusy(`${action}:${id}`);
    setError(null);
    try {
      await apiFetch<PettyCashRow>(`/api/v1/hotels/${hotelId}/accounting/petty-cash/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(
          action === "approve"
            ? { amountApproved: amountApproved ? Number(amountApproved) : null }
            : action === "reject"
              ? { rejectionReason }
              : {},
        ),
      });
      setMsg(`Petty cash ${action}d.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update request");
    } finally {
      setBusy(null);
    }
  }

  const analytics = data?.analytics;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground">
            Sales analytics, expense recording, and petty cash approvals.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <button type="button" className="hms-btn-outline" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        ) : null}
      </div>

      {msg ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      {canManage ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Total sales", analytics?.totalSales],
            ["POS sales", analytics?.posSales],
            ["Invoice sales", analytics?.inventoryInvoiceSales],
            ["Expenses", analytics?.totalExpenses],
            ["Net", analytics?.netAfterExpenses],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{loading ? "…" : money(value as number)}</p>
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground shadow-soft">
          Staff can submit petty cash requests here. Sales analytics and expense records are visible to manager,
          finance, and hotel admin users.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <h2 className="text-lg font-semibold">Petty cash request</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Ask manager for money needed for hotel operations, such as fuel, supplies, or emergency purchases.
          </p>
          <form className="grid gap-3" onSubmit={submitPettyCash}>
            <input placeholder="What is needed? e.g. Fuel for hotel generator" value={petty.title} onChange={(e) => setPetty({ ...petty, title: e.target.value })} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={petty.category} onChange={(e) => setPetty({ ...petty, category: e.target.value })}>
                {["Fuel", "Repairs", "Supplies", "Transport", "Guest service", "Other"].map((x) => <option key={x}>{x}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" placeholder="Amount requested" value={petty.amountRequested} onChange={(e) => setPetty({ ...petty, amountRequested: e.target.value })} required />
            </div>
            <textarea rows={3} placeholder="Reason / details" value={petty.reason} onChange={(e) => setPetty({ ...petty, reason: e.target.value })} required />
            <input placeholder="Notes (optional)" value={petty.notes} onChange={(e) => setPetty({ ...petty, notes: e.target.value })} />
            <button className="hms-btn-solid" disabled={busy === "petty"}>{busy === "petty" ? "Sending…" : "Send request"}</button>
          </form>
        </section>

        {canManage ? (
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold">Record expense</h2>
            <p className="mb-3 text-sm text-muted-foreground">Record money spent by the hotel after purchase.</p>
            <form className="grid gap-3" onSubmit={submitExpense}>
              <div className="grid gap-3 sm:grid-cols-3">
                <input type="date" value={expense.expenseDate} onChange={(e) => setExpense({ ...expense, expenseDate: e.target.value })} />
                <input placeholder="Category" value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} required />
                <input type="number" min="0.01" step="0.01" placeholder="Amount" value={expense.amount} onChange={(e) => setExpense({ ...expense, amount: e.target.value })} required />
              </div>
              <input placeholder="Vendor / supplier" value={expense.vendor} onChange={(e) => setExpense({ ...expense, vendor: e.target.value })} />
              <textarea rows={3} placeholder="Description" value={expense.description} onChange={(e) => setExpense({ ...expense, description: e.target.value })} required />
              <div className="grid gap-3 sm:grid-cols-2">
                <select value={expense.paymentMethod} onChange={(e) => setExpense({ ...expense, paymentMethod: e.target.value })}>
                  {["Cash", "Mobile Money", "Card", "Bank Transfer", "Other"].map((x) => <option key={x}>{x}</option>)}
                </select>
                <input placeholder="Reference / receipt no." value={expense.referenceNo} onChange={(e) => setExpense({ ...expense, referenceNo: e.target.value })} />
              </div>
              <button className="hms-btn-solid" disabled={busy === "expense"}>{busy === "expense" ? "Saving…" : "Record expense"}</button>
            </form>
          </section>
        ) : null}
      </div>

      {canManage ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold">Petty cash approvals</h2>
            <div className="mt-3 overflow-x-auto">
              <table>
                <thead><tr><th>Request</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {(data?.pettyCashRequests ?? []).map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.title}</strong><br /><span className="text-xs text-muted-foreground">{r.requestNumber} · {r.category} · {r.requestedBy}</span></td>
                      <td>{money(r.amountApproved ?? r.amountRequested)}</td>
                      <td><span className={`badge ${statusClass(r.status)}`}>{r.status}</span></td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {manager && r.status === "PENDING" ? (
                            <>
                              <button className="hms-btn-outline hms-btn-sm" onClick={() => void pettyAction(r.id, "approve")} disabled={!!busy}>Approve</button>
                              <button className="hms-btn-outline hms-btn-sm" onClick={() => void pettyAction(r.id, "reject")} disabled={!!busy}>Reject</button>
                            </>
                          ) : null}
                          {cashier && r.status === "APPROVED" ? (
                            <button className="hms-btn-outline hms-btn-sm" onClick={() => void pettyAction(r.id, "disburse")} disabled={!!busy}>Give money</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(data?.pettyCashRequests ?? []).length === 0 ? <tr><td colSpan={4} className="text-muted-foreground">No petty cash requests yet.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <h2 className="text-lg font-semibold">Recorded expenses</h2>
            <div className="mt-3 overflow-x-auto">
              <table>
                <thead><tr><th>Date</th><th>Expense</th><th>Payment</th><th>Amount</th></tr></thead>
                <tbody>
                  {(data?.expenses ?? []).map((e) => (
                    <tr key={e.id}>
                      <td>{e.expenseDate}</td>
                      <td><strong>{e.category}</strong><br /><span className="text-xs text-muted-foreground">{e.description}{e.vendor ? ` · ${e.vendor}` : ""}</span></td>
                      <td>{e.paymentMethod ?? "—"}<br /><span className="text-xs text-muted-foreground">{e.referenceNo ?? ""}</span></td>
                      <td>{money(e.amount)}</td>
                    </tr>
                  ))}
                  {(data?.expenses ?? []).length === 0 ? <tr><td colSpan={4} className="text-muted-foreground">No expenses recorded.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
