"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type Obligation = {
  id: string;
  kind: "CREDIT" | "DEBT";
  partyName: string;
  description: string;
  amount: number;
  entryDate: string;
  dueDate?: string | null;
  status: "OPEN" | "SETTLED";
  referenceNo?: string | null;
  recordedBy?: string | null;
};

type ObligationList = {
  openCredit: number;
  openDebt: number;
  netPosition: number;
  rows: Obligation[];
};

function money(n: number) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CompanyCreditDebtPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [data, setData] = useState<ObligationList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<"CREDIT" | "DEBT">("CREDIT");
  const [partyName, setPartyName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const payload = await apiFetch<ObligationList>(`/api/v1/hotels/${hotelId}/accounting/obligations`);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load credit and debt");
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const parsed = Number(amount);
    if (!partyName.trim() || !description.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setError("Party, description, and an amount greater than zero are required.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/accounting/obligations`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          partyName: partyName.trim(),
          description: description.trim(),
          amount: parsed,
          entryDate: entryDate || null,
          dueDate: dueDate || null,
          referenceNo: referenceNo.trim() || null,
        }),
      });
      setPartyName("");
      setDescription("");
      setAmount("");
      setDueDate("");
      setReferenceNo("");
      setMsg(kind === "CREDIT" ? "Credit recorded." : "Debt recorded.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this record");
    } finally {
      setSaving(false);
    }
  }

  async function settle(row: Obligation) {
    setError(null);
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/accounting/obligations/${row.id}/settle`, { method: "POST" });
      setMsg(row.kind === "CREDIT" ? "Credit marked settled." : "Debt marked settled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not settle this record");
    }
  }

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Credit & debt</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Credit is money owed to the company. Debt is money the company owes.
        </p>
        <Link href={staffAppPath("accounting")} className="text-sm underline">
          Back to accounting
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open credit</p>
          <p className="mt-1 text-2xl font-bold">{money(data?.openCredit ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Open debt</p>
          <p className="mt-1 text-2xl font-bold">{money(data?.openDebt ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Net (credit minus debt)</p>
          <p className="mt-1 text-2xl font-bold">{money(data?.netPosition ?? 0)}</p>
        </div>
      </div>

      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}

      <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Record credit or debt</h2>
        <form noValidate onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as "CREDIT" | "DEBT")}>
              <option value="CREDIT">Credit — owed to the company</option>
              <option value="DEBT">Debt — the company owes</option>
            </select>
          </div>
          <div>
            <label>Party</label>
            <input value={partyName} onChange={(e) => setPartyName(e.target.value)} placeholder="Customer or supplier" />
          </div>
          <div>
            <label>Amount</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label>Date</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div>
            <label>Due date (optional)</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label>Reference (optional)</label>
            <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" className="hms-btn-solid" disabled={saving}>
              {saving ? "Saving..." : "Save record"}
            </button>
          </div>
        </form>
      </div>

      <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm overflow-x-auto">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Records</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.entryDate}</td>
                <td>{row.kind === "CREDIT" ? "Credit" : "Debt"}</td>
                <td>{row.partyName}</td>
                <td>{row.description}</td>
                <td>{money(row.amount)}</td>
                <td>{row.dueDate || "—"}</td>
                <td>{row.status === "OPEN" ? "Open" : "Settled"}</td>
                <td>
                  {row.status === "OPEN" ? (
                    <button type="button" className="hms-btn-outline text-xs" onClick={() => void settle(row)}>
                      Mark settled
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-sm text-muted-foreground mt-3">No credit or debt recorded yet.</p>}
      </div>
    </div>
  );
}
