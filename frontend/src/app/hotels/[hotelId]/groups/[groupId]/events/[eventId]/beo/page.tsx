"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { eventBase, money } from "@/lib/eventApi";
import { formatBeoStatus } from "@/lib/groupEventsCopy";
import { HMS_PRINT_DOCUMENT_STYLES, useHmsPrintDocument } from "@/lib/hmsPrintDocument";

type FullBeo = {
  beo: {
    id: string;
    version: number;
    status: string;
    setupStyle?: string | null;
    menuNotes?: string | null;
    kitchenNotes?: string | null;
    housekeepingNotes?: string | null;
    financeNotes?: string | null;
    depositConfirmed: boolean;
  };
  event: { eventName: string; startDatetime: string; endDatetime: string; venueName?: string | null };
  groupName: string;
  contactPerson?: string | null;
  cateringLines: Array<{ description: string; quantity: number | string; lineTotal: number | string }>;
  quote?: { totalAmount: number | string; depositRequired: number | string; depositPaid: boolean; chargesPostedAt?: string | null } | null;
};

export default function PrintableBeoPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const eventId = String(params.eventId);
  const [data, setData] = useState<FullBeo | null>(null);
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [housekeepingNotes, setHousekeepingNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const row = await apiFetch<FullBeo>(`${eventBase(hotelId, groupId)}/${eventId}/beo/full`);
    setData(row);
    setKitchenNotes(row.beo.kitchenNotes ?? "");
    setHousekeepingNotes(row.beo.housekeepingNotes ?? "");
  }, [eventId, groupId, hotelId]);

  async function saveDepartmentNotes() {
    setSaving(true);
    setSaveMsg(null);
    try {
      await apiFetch(`${eventBase(hotelId, groupId)}/${eventId}/beo`, {
        method: "PATCH",
        body: JSON.stringify({ kitchenNotes, housekeepingNotes }),
      });
      setSaveMsg("Saved. Refresh print preview below.");
      await load();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Could not save notes");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return <p className="p-8 text-sm">Loading banquet order…</p>;

  return (
    <div className="hms-print-document bg-white p-8 text-slate-900">
      <style jsx global>{HMS_PRINT_DOCUMENT_STYLES}</style>
      <div className="no-print mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="hms-btn-solid" onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button type="button" className="hms-btn-outline" disabled={saving} onClick={() => void saveDepartmentNotes()}>
            {saving ? "Saving…" : "Save department notes"}
          </button>
        </div>
        <p className="text-xs text-slate-600">
          Kitchen and housekeeping instructions are filled when you generate the banquet order. Edit them here before
          you print — catering items alone do not appear in those boxes unless copied into the notes.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-xs font-bold text-slate-600">
            Kitchen instructions
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={kitchenNotes}
              onChange={(e) => setKitchenNotes(e.target.value)}
              placeholder="Prep list, timing, allergies, station assignments…"
            />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Housekeeping instructions
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value={housekeepingNotes}
              onChange={(e) => setHousekeepingNotes(e.target.value)}
              placeholder="Setup, linen, room turn, AV furniture…"
            />
          </label>
        </div>
        {saveMsg ? <p className="text-sm text-indigo-800">{saveMsg}</p> : null}
      </div>
      <header className="border-b-2 border-slate-800 pb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Banquet order (operations sheet)</p>
        <h1 className="text-2xl font-black">{data.event.eventName}</h1>
        <p className="text-sm">Group: {data.groupName} · Contact: {data.contactPerson || "—"}</p>
        <p className="text-sm">v{data.beo.version} · {formatBeoStatus(data.beo.status)} · {data.event.startDatetime} → {data.event.endDatetime}</p>
        <p className="text-sm">Venue: {data.event.venueName || "TBD"} · Setup: {data.beo.setupStyle || "—"}</p>
      </header>
      <section className="hms-print-avoid-break mt-6">
        <h2 className="font-bold uppercase text-sm text-slate-600">Catering</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-1">Item</th><th className="text-right">Qty</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {data.cateringLines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100"><td>{l.description}</td><td className="text-right">{money(l.quantity)}</td><td className="text-right">{money(l.lineTotal).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
        {data.beo.menuNotes ? <p className="mt-2 text-sm whitespace-pre-wrap">{data.beo.menuNotes}</p> : null}
      </section>
      <section className="hms-print-avoid-break mt-6 grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <h2 className="font-bold text-slate-600">Kitchen</h2>
          <p className="whitespace-pre-wrap">{kitchenNotes.trim() || "—"}</p>
        </div>
        <div>
          <h2 className="font-bold text-slate-600">Housekeeping</h2>
          <p className="whitespace-pre-wrap">{housekeepingNotes.trim() || "—"}</p>
        </div>
      </section>
      {data.quote ? (
        <footer className="hms-print-avoid-break mt-8 border-t pt-4 text-sm">
          <h2 className="font-bold text-slate-600">Finance</h2>
          <p>Quote total: {money(data.quote.totalAmount).toFixed(2)} · Deposit: {money(data.quote.depositRequired).toFixed(2)} {data.quote.depositPaid ? "(confirmed)" : ""}</p>
          <p>Deposit confirmed on banquet order: {data.beo.depositConfirmed ? "Yes" : "No"}</p>
          {data.quote.chargesPostedAt ? <p className="font-semibold text-emerald-800">Charges posted to master folio</p> : null}
          {data.beo.financeNotes ? <p className="mt-1 whitespace-pre-wrap">{data.beo.financeNotes}</p> : null}
        </footer>
      ) : null}
      <div className="hms-print-avoid-break mt-12 grid grid-cols-3 gap-8 text-sm">
        <div className="border-t pt-2">Banquet manager / date</div>
        <div className="border-t pt-2">Client signature / date</div>
        <div className="border-t pt-2">Hotel representative / date</div>
      </div>
    </div>
  );
}
