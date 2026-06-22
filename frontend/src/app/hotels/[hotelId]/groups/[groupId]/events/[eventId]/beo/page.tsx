"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { downloadEventPdf, eventBase } from "@/lib/eventApi";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { BEO_COPY, formatBeoStatus } from "@/lib/groupEventsCopy";

type BeoRow = {
  id: string;
  version: number;
  status: string;
  kitchenNotes?: string | null;
  housekeepingNotes?: string | null;
};

export default function BanquetOrderNotesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const eventId = String(params.eventId);
  const [beo, setBeo] = useState<BeoRow | null>(null);
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [housekeepingNotes, setHousekeepingNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const row = await apiFetch<{ beo: BeoRow }>(`${eventBase(hotelId, groupId)}/${eventId}/beo/full`);
      setBeo(row.beo);
      setKitchenNotes(row.beo.kitchenNotes ?? "");
      setHousekeepingNotes(row.beo.housekeepingNotes ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load banquet order");
      setBeo(null);
    }
  }, [eventId, groupId, hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDepartmentNotes() {
    setSaving(true);
    setSaveMsg(null);
    setError(null);
    try {
      await apiFetch(`${eventBase(hotelId, groupId)}/${eventId}/beo`, {
        method: "PATCH",
        body: JSON.stringify({ kitchenNotes, housekeepingNotes }),
      });
      setSaveMsg("Department notes saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save notes");
    } finally {
      setSaving(false);
    }
  }

  async function runPdfDownload() {
    setPdfBusy(true);
    setError(null);
    try {
      const name = await downloadEventPdf(hotelId, groupId, eventId, "beo");
      setPdfName(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download banquet order PDF");
    } finally {
      setPdfBusy(false);
    }
  }

  if (!beo && !error) return <p className="p-8 text-sm">Loading banquet order…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={`${staffAppPath("groups", groupId)}?tab=beo`} className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to banquet orders
      </Link>
      <div>
        <h1 className="text-2xl font-black text-slate-900">{BEO_COPY.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{BEO_COPY.intro}</p>
        {beo ? (
          <p className="mt-2 text-sm text-slate-700">
            v{beo.version} · {formatBeoStatus(beo.status)}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}
      {saveMsg ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{saveMsg}</div>
      ) : null}
      {pdfName ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Downloaded {pdfName}.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="hms-btn-solid text-sm" disabled={pdfBusy || !beo} onClick={() => void runPdfDownload()}>
          {pdfBusy ? "Preparing PDF…" : BEO_COPY.viewPrint}
        </button>
        <button type="button" className="hms-btn-outline text-sm" disabled={saving || !beo} onClick={() => void saveDepartmentNotes()}>
          {saving ? "Saving…" : "Save department notes"}
        </button>
      </div>

      <p className="text-xs text-slate-600">{BEO_COPY.deliveryNote}</p>

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
    </div>
  );
}
