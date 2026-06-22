"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { downloadEventBillingPdf } from "@/lib/eventApi";
import { staffAppPath } from "@/lib/staffAppRoutes";

export default function PrintableQuotePage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const eventId = String(params.eventId);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  async function runDownload() {
    setBusy(true);
    setError(null);
    try {
      const name = await downloadEventBillingPdf(hotelId, groupId, eventId);
      setFilename(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download quote PDF");
      setFilename(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void runDownload();
  }, [eventId, groupId, hotelId]);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
      <Link href={staffAppPath("groups", groupId)} className="text-sm font-medium text-indigo-600 hover:underline">
        ← Back to group
      </Link>
      <h1 className="text-2xl font-black text-slate-900">Event billing document</h1>
      <p className="text-sm text-muted-foreground">
        Proforma, delivery note, or invoice — based on payments recorded on the group guest bill. Also listed under Invoices.
      </p>
      {busy ? <p className="text-sm text-muted-foreground">Preparing PDF…</p> : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}
      {filename ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
          Downloaded {filename}. Check your browser downloads folder.
        </p>
      ) : null}
      <button type="button" className="hms-btn-solid text-sm" disabled={busy} onClick={() => void runDownload()}>
        {busy ? "Preparing…" : "Download again"}
      </button>
    </div>
  );
}
