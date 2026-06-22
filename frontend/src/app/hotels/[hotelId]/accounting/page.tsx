"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadAuthUser, type AuthUser } from "@/lib/auth";

type SalesAnalytics = {
  fromDate: string;
  toDate: string;
  inventoryInvoiceSales: number;
  inventoryInvoicePaid: number;
  posSales: number;
  totalSales: number;
  totalExpenses: number;
  payrollExpenses: number;
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
  accounts: AccountRow[];
  expenses: ExpenseRow[];
  pettyCashRequests: PettyCashRow[];
  reports?: AccountingReports;
};

type AccountRow = {
  id: string;
  code: string;
  name: string;
  accountType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  description?: string | null;
  active: boolean;
};

type BankStatementLineRow = {
  id: string;
  bookDate: string;
  valueDate?: string | null;
  reference?: string | null;
  narration: string;
  debitAmount: number;
  creditAmount: number;
  balanceAmount?: number | null;
  sourceBank: string;
};

type LedgerEntryRow = {
  date: string;
  reference: string;
  source: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  description: string;
  debit: number;
  credit: number;
};

type TrialBalanceRow = {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
};

type ProfitLossReport = {
  income: { accountName: string; amount: number }[];
  expenses: { accountName: string; amount: number }[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
};

type BalanceSheetReport = {
  assets: { accountName: string; amount: number }[];
  liabilities: { accountName: string; amount: number }[];
  equity: { accountName: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  liabilitiesAndEquity: number;
};

type AccountingReports = {
  ledger: LedgerEntryRow[];
  trialBalance: TrialBalanceRow[];
  profitAndLoss: ProfitLossReport;
  balanceSheet: BalanceSheetReport;
  bankStatementLines: BankStatementLineRow[];
};

type BankStatementImportResponse = {
  importedCount: number;
  skippedCount: number;
  message: string;
  lines: BankStatementLineRow[];
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

function sourceLabel(source: string) {
  return source.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type ReportKey = "profitLoss" | "balanceSheet" | "trialBalance" | "ledger" | "bankStatement";

export default function AccountingPage() {
  const params = useParams<{ hotelId: string }>();
  const hotelId = params.hotelId;
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
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
  const [activeReport, setActiveReport] = useState<ReportKey>("profitLoss");
  const [bankFilter, setBankFilter] = useState("ALL");

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
  const [bankLine, setBankLine] = useState({
    bookDate: today,
    valueDate: today,
    reference: "",
    narration: "",
    debitAmount: "",
    creditAmount: "",
    balanceAmount: "",
    sourceBank: "Bank of Kigali",
  });
  const [accountForm, setAccountForm] = useState({
    code: "",
    name: "",
    accountType: "EXPENSE" as AccountRow["accountType"],
    description: "",
  });

  const load = useCallback(async (range?: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ from: range?.from ?? from, to: range?.to ?? to });
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
    setUser(loadAuthUser());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

  async function syncPayrollToAccounting() {
    setBusy("payroll-sync");
    setError(null);
    try {
      const result = await apiFetch<{ postedCount: number; message: string }>(
        `/api/v1/hotels/${hotelId}/accounting/payroll/sync`,
        { method: "POST" },
      );
      setMsg(result.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sync payroll to accounting");
    } finally {
      setBusy(null);
    }
  }

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

  async function submitBankLine(e: React.FormEvent) {
    e.preventDefault();
    setBusy("bank");
    setError(null);
    try {
      await apiFetch<BankStatementLineRow>(`/api/v1/hotels/${hotelId}/accounting/bank-statements`, {
        method: "POST",
        body: JSON.stringify({
          ...bankLine,
          valueDate: bankLine.valueDate || null,
          reference: bankLine.reference || null,
          debitAmount: Number(bankLine.debitAmount || 0),
          creditAmount: Number(bankLine.creditAmount || 0),
          balanceAmount: bankLine.balanceAmount ? Number(bankLine.balanceAmount) : null,
        }),
      });
      setBankLine((prev) => ({
        ...prev,
        reference: "",
        narration: "",
        debitAmount: "",
        creditAmount: "",
        balanceAmount: "",
      }));
      setMsg("Bank statement line recorded.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record bank statement line");
    } finally {
      setBusy(null);
    }
  }

  async function importBankStatementPdf(file: File | null) {
    if (!file) return;
    setBusy("bank-pdf");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<BankStatementImportResponse>(
        `/api/v1/hotels/${hotelId}/accounting/bank-statements/import-pdf`,
        {
          method: "POST",
          body: form,
        },
      );
      if ((res.lines ?? []).length > 0) {
        const dates = res.lines.map((line) => line.bookDate).sort();
        const nextFrom = dates[0];
        const nextTo = dates[dates.length - 1];
        setFrom(nextFrom);
        setTo(nextTo);
        setMsg(`${res.message || `Imported ${res.importedCount} bank statement line(s).`} Showing imported statement period ${nextFrom} to ${nextTo}.`);
        await load({ from: nextFrom, to: nextTo });
      } else {
        setMsg(res.message || "No bank statement rows were recognized.");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import bank statement PDF");
    } finally {
      setBusy(null);
    }
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy("account");
    setError(null);
    try {
      await apiFetch<AccountRow>(`/api/v1/hotels/${hotelId}/accounting/accounts`, {
        method: "POST",
        body: JSON.stringify(accountForm),
      });
      setAccountForm({ code: "", name: "", accountType: "EXPENSE", description: "" });
      setMsg("Account created.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
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

  function downloadReportPdf(report: ReportKey) {
    const titleMap: Record<ReportKey, string> = {
      profitLoss: "Profit & Loss",
      balanceSheet: "Balance Sheet",
      trialBalance: "Trial Balance",
      ledger: "Ledger",
      bankStatement: "Bank Statement",
    };
    const reportTitle = titleMap[report];
    const printable = document.getElementById(`accounting-report-${report}`);
    if (!printable) return;
    const w = window.open("", "_blank");
    if (!w) {
      setError("Pop-up blocked. Allow pop-ups to download this report as PDF.");
      return;
    }
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${reportTitle}</title>
      <style>
      body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .muted{color:#666;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left;vertical-align:top}
      th{background:#f1f5f9}
      .text-right{text-align:right}
      </style></head><body>
      <h1>${reportTitle}</h1><div class="muted">Period: ${from} to ${to}</div>${printable.innerHTML}
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    w.document.close();
  }

  const analytics = data?.analytics;
  const reports = data?.reports;
  const bankStatementLines = reports?.bankStatementLines ?? [];
  const bankFilterOptions = useMemo(
    () => Array.from(new Set(bankStatementLines.map((line) => line.sourceBank).filter(Boolean))).sort(),
    [bankStatementLines],
  );
  const filteredBankStatementLines = useMemo(
    () => bankFilter === "ALL" ? bankStatementLines : bankStatementLines.filter((line) => line.sourceBank === bankFilter),
    [bankFilter, bankStatementLines],
  );

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground">Loading accounting workspace…</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground shadow-soft">
          Preparing ledger, bank statement, and reports.
        </div>
      </div>
    );
  }

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
            <button
              type="button"
              className="hms-btn-solid"
              disabled={busy === "payroll-sync"}
              onClick={() => void syncPayrollToAccounting()}
            >
              {busy === "payroll-sync" ? "Syncing…" : "Post paid payroll"}
            </button>
          </div>
        ) : null}
      </div>

      {msg ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      {canManage ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            [
              "Sales",
              analytics?.totalSales,
              `POS ${money(analytics?.posSales)} · Invoice ${money(analytics?.inventoryInvoiceSales)}`,
            ],
            ["Expenses", analytics?.totalExpenses],
            [
              "Payroll / salaries",
              analytics?.payrollExpenses,
              "Posted from HR when payroll is marked paid",
            ],
            ["Net", analytics?.netAfterExpenses],
            ["Petty cash disbursed", analytics?.pettyCashDisbursed],
          ].map(([label, value, sub]) => (
            <div key={label as string} className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{loading ? "…" : money(value as number)}</p>
              {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub as string}</p> : null}
            </div>
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card p-4 text-sm text-muted-foreground shadow-soft">
          Staff can submit petty cash requests here. Sales analytics and expense records are visible to manager,
          finance, and hotel admin users.
        </div>
      )}

      {canManage ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Chart of accounts</h2>
            <p className="text-sm text-muted-foreground">
              Stored account list used by the ledger and reports, such as 1000 Cash / Bank, 4000 Sales Revenue, and 4010 Facility Revenue.
            </p>
          </div>
          <form className="mb-4 grid gap-3 lg:grid-cols-[0.6fr_1fr_0.7fr_1.4fr_auto]" onSubmit={submitAccount}>
            <input placeholder="Code e.g. 5020" value={accountForm.code} onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })} required />
            <input placeholder="Account name" value={accountForm.name} onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })} required />
            <select value={accountForm.accountType} onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as AccountRow["accountType"] })}>
              {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input placeholder="Description" value={accountForm.description} onChange={(e) => setAccountForm({ ...accountForm, description: e.target.value })} />
            <button className="hms-btn-solid" disabled={busy === "account"}>{busy === "account" ? "Saving…" : "Create account"}</button>
          </form>
          <div className="max-h-80 overflow-auto rounded-xl border border-border/70">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Description</th><th>Status</th></tr></thead>
              <tbody>
                {(data?.accounts ?? []).map((account) => (
                  <tr key={account.id}>
                    <td className="font-semibold">{account.code}</td>
                    <td>{account.name}</td>
                    <td>{account.accountType}</td>
                    <td>{account.description ?? "—"}</td>
                    <td>{account.active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
                {(data?.accounts ?? []).length === 0 ? (
                  <tr><td colSpan={5} className="text-muted-foreground">No accounts yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">Bank statement</h2>
            <p className="text-sm text-muted-foreground">
              Record BK statement lines with book date, value date, reference, narration, debit, credit, and balance.
            </p>
          </div>
          <form className="grid gap-3" onSubmit={submitBankLine}>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-xs">
                Book date
                <input type="date" value={bankLine.bookDate} onChange={(e) => setBankLine({ ...bankLine, bookDate: e.target.value })} required />
              </label>
              <label className="text-xs">
                Value date
                <input type="date" value={bankLine.valueDate} onChange={(e) => setBankLine({ ...bankLine, valueDate: e.target.value })} />
              </label>
              <input placeholder="Reference" value={bankLine.reference} onChange={(e) => setBankLine({ ...bankLine, reference: e.target.value })} />
              <input placeholder="Bank e.g. Bank of Kigali" value={bankLine.sourceBank} onChange={(e) => setBankLine({ ...bankLine, sourceBank: e.target.value })} />
            </div>
            <textarea rows={2} placeholder="Narration" value={bankLine.narration} onChange={(e) => setBankLine({ ...bankLine, narration: e.target.value })} required />
            <div className="grid gap-3 md:grid-cols-3">
              <input type="number" min="0" step="0.01" placeholder="Debit / money out" value={bankLine.debitAmount} onChange={(e) => setBankLine({ ...bankLine, debitAmount: e.target.value })} />
              <input type="number" min="0" step="0.01" placeholder="Credit / money in" value={bankLine.creditAmount} onChange={(e) => setBankLine({ ...bankLine, creditAmount: e.target.value })} />
              <input type="number" step="0.01" placeholder="Balance" value={bankLine.balanceAmount} onChange={(e) => setBankLine({ ...bankLine, balanceAmount: e.target.value })} />
            </div>
            <button className="hms-btn-solid w-fit" disabled={busy === "bank"}>{busy === "bank" ? "Saving…" : "Record bank line"}</button>
          </form>
          <div className="mt-4 rounded-xl border border-dashed border-border/80 p-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="bank-pdf">
              Import bank / Momo statement
            </label>
            <p className="mb-2 text-xs text-muted-foreground">
              Upload BK, Equity Bank, or Access Bank PDF statements, or a Momo XLSX export. The system will read dates, reference, narration, debit, credit, and balance where available.
            </p>
            <input
              id="bank-pdf"
              type="file"
              accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
              disabled={busy === "bank-pdf"}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void importBankStatementPdf(file);
                e.currentTarget.value = "";
              }}
            />
            {busy === "bank-pdf" ? <p className="mt-2 text-sm text-muted-foreground">Reading statement…</p> : null}
          </div>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">QuickBooks style reports</h2>
            <p className="text-sm text-muted-foreground">
              Open one report at a time to avoid long scrolling. Use Download PDF to print or save each report.
            </p>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["profitLoss", "Profit & Loss"],
              ["balanceSheet", "Balance Sheet"],
              ["trialBalance", "Trial Balance"],
              ["ledger", "Ledger"],
              ["bankStatement", "Bank Statement"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={activeReport === key ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
                onClick={() => setActiveReport(key as ReportKey)}
              >
                {label}
              </button>
            ))}
            <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => downloadReportPdf(activeReport)}>
              Download PDF
            </button>
          </div>

          {activeReport === "profitLoss" ? (
            <div id="accounting-report-profitLoss" className="overflow-x-auto rounded-xl border border-border/70">
              <table>
                <tbody>
                  <tr><th colSpan={2}>Income</th></tr>
                  {(reports?.profitAndLoss.income ?? []).map((r) => <tr key={`inc-${r.accountName}`}><td>{r.accountName}</td><td className="text-right">{money(r.amount)}</td></tr>)}
                  <tr><td className="font-semibold">Total income</td><td className="text-right font-semibold">{money(reports?.profitAndLoss.totalIncome)}</td></tr>
                  <tr><th colSpan={2}>Expenses</th></tr>
                  {(reports?.profitAndLoss.expenses ?? []).map((r) => <tr key={`exp-${r.accountName}`}><td>{r.accountName}</td><td className="text-right">{money(r.amount)}</td></tr>)}
                  <tr><td className="font-semibold">Total expenses</td><td className="text-right font-semibold">{money(reports?.profitAndLoss.totalExpenses)}</td></tr>
                  <tr><td className="font-bold">Net profit</td><td className="text-right font-bold">{money(reports?.profitAndLoss.netProfit)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {activeReport === "balanceSheet" ? (
            <div id="accounting-report-balanceSheet" className="overflow-x-auto rounded-xl border border-border/70">
              <table>
                <tbody>
                  <tr><th colSpan={2}>Assets</th></tr>
                  {(reports?.balanceSheet.assets ?? []).map((r) => <tr key={`asset-${r.accountName}`}><td>{r.accountName}</td><td className="text-right">{money(r.amount)}</td></tr>)}
                  <tr><td className="font-semibold">Total assets</td><td className="text-right font-semibold">{money(reports?.balanceSheet.totalAssets)}</td></tr>
                  <tr><th colSpan={2}>Liabilities</th></tr>
                  {(reports?.balanceSheet.liabilities ?? []).map((r) => <tr key={`liab-${r.accountName}`}><td>{r.accountName}</td><td className="text-right">{money(r.amount)}</td></tr>)}
                  <tr><td className="font-semibold">Total liabilities</td><td className="text-right font-semibold">{money(reports?.balanceSheet.totalLiabilities)}</td></tr>
                  <tr><th colSpan={2}>Equity</th></tr>
                  {(reports?.balanceSheet.equity ?? []).map((r) => <tr key={`equity-${r.accountName}`}><td>{r.accountName}</td><td className="text-right">{money(r.amount)}</td></tr>)}
                  <tr><td className="font-bold">Liabilities + equity</td><td className="text-right font-bold">{money(reports?.balanceSheet.liabilitiesAndEquity)}</td></tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {activeReport === "trialBalance" ? (
            <div id="accounting-report-trialBalance" className="max-h-[32rem] overflow-auto rounded-xl border border-border/70">
                <table>
                  <thead><tr><th>Account</th><th>Type</th><th>Debit</th><th>Credit</th></tr></thead>
                  <tbody>
                    {(reports?.trialBalance ?? []).map((r) => (
                      <tr key={r.accountCode}>
                        <td><strong>{r.accountCode}</strong> {r.accountName}</td>
                        <td>{r.accountType}</td>
                        <td className="text-right">{money(r.debit)}</td>
                        <td className="text-right">{money(r.credit)}</td>
                      </tr>
                    ))}
                    {(reports?.trialBalance ?? []).length === 0 ? <tr><td colSpan={4} className="text-muted-foreground">No accounting entries for this period.</td></tr> : null}
                  </tbody>
                </table>
            </div>
          ) : null}

          {activeReport === "ledger" ? (
            <div id="accounting-report-ledger" className="max-h-[32rem] overflow-auto rounded-xl border border-border/70">
                <table>
                  <thead><tr><th>Date</th><th>Source</th><th>Account</th><th>Description</th><th>Debit</th><th>Credit</th></tr></thead>
                  <tbody>
                    {(reports?.ledger ?? []).map((r, idx) => (
                      <tr key={`${r.date}-${r.reference}-${r.accountCode}-${idx}`}>
                        <td>{r.date}</td>
                        <td>{sourceLabel(r.source)}<br /><span className="text-xs text-muted-foreground">{r.reference}</span></td>
                        <td><strong>{r.accountCode}</strong><br />{r.accountName}</td>
                        <td>{r.description}</td>
                        <td className="text-right">{money(r.debit)}</td>
                        <td className="text-right">{money(r.credit)}</td>
                      </tr>
                    ))}
                    {(reports?.ledger ?? []).length === 0 ? <tr><td colSpan={6} className="text-muted-foreground">No ledger entries for this period.</td></tr> : null}
                  </tbody>
                </table>
            </div>
          ) : null}

          {activeReport === "bankStatement" ? (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                This table shows all saved bank statement lines from the database. The date filter still controls how bank lines feed Ledger, Trial Balance, Balance Sheet, and Profit & Loss.
              </p>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="bank-statement-bank-filter">
                  Filter by bank
                </label>
                <select
                  id="bank-statement-bank-filter"
                  className="h-9 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm"
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                >
                  <option value="ALL">All banks</option>
                  {bankFilterOptions.map((bank) => (
                    <option key={bank} value={bank}>{bank}</option>
                  ))}
                </select>
              </div>
            <div id="accounting-report-bankStatement" className="max-h-[32rem] overflow-auto rounded-xl border border-border/70">
              <table>
                <thead><tr><th>Book date</th><th>Value date</th><th>Reference</th><th>Narration / Bank name</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
                <tbody>
                  {filteredBankStatementLines.map((r) => (
                    <tr key={r.id}>
                      <td>{r.bookDate}</td>
                      <td>{r.valueDate ?? "—"}</td>
                      <td>{r.reference ?? "—"}</td>
                      <td>
                        {r.narration}
                        <span className="text-muted-foreground"> / {r.sourceBank}</span>
                      </td>
                      <td className="text-right">{money(r.debitAmount)}</td>
                      <td className="text-right">{money(r.creditAmount)}</td>
                      <td className="text-right">{money(r.balanceAmount)}</td>
                    </tr>
                  ))}
                  {filteredBankStatementLines.length === 0 ? <tr><td colSpan={7} className="text-muted-foreground">No bank statement lines recorded for this bank.</td></tr> : null}
                </tbody>
              </table>
            </div>
            </>
          ) : null}
        </section>
      ) : null}

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
                <select value={expense.category} onChange={(e) => setExpense({ ...expense, category: e.target.value })} required>
                  {["General", "Fuel", "Repairs", "Supplies", "Salaries & Wages", "Other"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
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
            <p className="mt-1 text-sm text-muted-foreground">
              Employee salaries appear here automatically when payroll is marked paid in HR (account 5100 Salaries &amp; Wages).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table>
                <thead><tr><th>Date</th><th>Expense</th><th>Payment</th><th>Amount</th></tr></thead>
                <tbody>
                  {(data?.expenses ?? []).map((e) => (
                    <tr key={e.id} className={e.category === "Salaries & Wages" ? "bg-sky-50/60" : undefined}>
                      <td>{e.expenseDate}</td>
                      <td>
                        <strong>{e.category}</strong>
                        {e.category === "Salaries & Wages" ? (
                          <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-800">Payroll</span>
                        ) : null}
                        <br />
                        <span className="text-xs text-muted-foreground">{e.description}{e.vendor ? ` · ${e.vendor}` : ""}</span>
                      </td>
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
