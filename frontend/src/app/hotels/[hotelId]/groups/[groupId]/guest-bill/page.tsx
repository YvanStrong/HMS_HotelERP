"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventGuestBillFolio, folioBalance } from "@/components/groups/EventGuestBillFolio";
import { apiFetch, getToken } from "@/lib/api";
import { type StaffFolio } from "@/lib/folioDisplay";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { BILLING_COPY } from "@/lib/groupEventsCopy";

type GroupDetail = {
  groupName: string;
  usesRoomBlock?: boolean;
  uses_room_block?: boolean;
};

type BillingDash = {
  masterFolio: {
    reservation_id?: string;
    reservationId?: string;
    confirmationCode: string;
    guest_name: string;
    balance_due: number | string;
    currency: string;
  } | null;
  members: Array<{ reservation_id?: string; reservationId?: string; is_master: boolean }>;
};

export default function GroupEventGuestBillPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [folio, setFolio] = useState<StaffFolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }
    try {
      const g = await apiFetch<GroupDetail>(`/api/v1/hotels/${hotelId}/groups/${groupId}`);
      const usesRoomBlock = g.usesRoomBlock ?? g.uses_room_block ?? true;
      if (usesRoomBlock) {
        setError("This group uses a room block — open the guest bill from the Rooms or Billing tab.");
        setGroup(g);
        setLoading(false);
        return;
      }
      setGroup(g);
      const dash = await apiFetch<BillingDash>(`/api/v1/hotels/${hotelId}/groups/${groupId}/billing-dashboard`);
      const mf = dash.masterFolio;
      const masterMember = dash.members.find((m) => m.is_master) ?? dash.members[0];
      const rid =
        mf?.reservation_id ??
        mf?.reservationId ??
        masterMember?.reservation_id ??
        masterMember?.reservationId ??
        null;
      if (!rid) {
        setError("Event guest bill is not set up for this group yet.");
        setLoading(false);
        return;
      }
      const f = await apiFetch<StaffFolio>(`/api/v1/hotels/${hotelId}/folios/${rid}`);
      setFolio(f);
      const due = folioBalance(f);
      if (due > 0) setPayAmount(due.toFixed(2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load event guest bill");
      setFolio(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recordPayment() {
    if (!folio?.reservationId) return;
    const amount = Number.parseFloat(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    setError(null);
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/folios/${folio.reservationId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: "FINAL",
          method: payMethod,
          amount,
          currency: folio.summary.currency ?? "USD",
          reference: payRef.trim() || null,
          notes: payNotes.trim() || null,
        }),
      });
      setBanner("Payment recorded.");
      setPayRef("");
      setPayNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  }

  const balance = folio ? folioBalance(folio) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/80 via-background to-muted/20 pb-16">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <Link
            href={`${staffAppPath("groups", groupId)}?tab=billing`}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            ← Back to group billing
          </Link>
          <h1 className="mt-2 text-3xl font-black text-slate-900">{BILLING_COPY.eventGuestBill}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{BILLING_COPY.eventGuestBillHint}</p>
          {group ? <p className="mt-1 text-sm font-semibold text-slate-700">{group.groupName}</p> : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        ) : null}
        {banner ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
            {banner}
          </div>
        ) : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {!loading && folio ? (
          <>
            <EventGuestBillFolio folio={folio} balance={balance} />

            {balance > 0.01 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Record payment</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">
                    Amount
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Method
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="MOBILE_MONEY">Mobile money</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Reference (optional)
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      placeholder="Receipt or transaction ID"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                    Notes (optional)
                    <textarea
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      rows={2}
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  className="hms-btn-solid text-sm"
                  onClick={() => void recordPayment()}
                >
                  {saving ? "Saving…" : "Record payment"}
                </button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-emerald-800">This event guest bill is settled.</p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
