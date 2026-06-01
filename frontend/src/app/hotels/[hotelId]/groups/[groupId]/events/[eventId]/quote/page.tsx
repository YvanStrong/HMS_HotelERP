"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { eventBase, money } from "@/lib/eventApi";
import { formatQuoteStatus } from "@/lib/groupEventsCopy";
import { HMS_PRINT_DOCUMENT_STYLES, useHmsPrintDocument } from "@/lib/hmsPrintDocument";

type PrintableQuote = {
  quote: {
    status: string;
    subtotal: number | string;
    taxAmount: number | string;
    discountAmount: number | string;
    totalAmount: number | string;
    depositRequired: number | string;
    depositPaid: boolean;
    validUntil?: string | null;
    lines: Array<{ description: string; quantity: number | string; unitPrice: number | string; lineTotal: number | string }>;
  };
  event: { eventName: string; startDatetime: string; endDatetime: string; venueName?: string | null; expectedPax?: number | null };
  groupName: string;
  companyName?: string | null;
  contactPerson?: string | null;
  hotelName: string;
  hotelAddress?: string | null;
  currency?: string | null;
};

export default function PrintableQuotePage() {
  useHmsPrintDocument();
  const params = useParams();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);
  const eventId = String(params.eventId);
  const [data, setData] = useState<PrintableQuote | null>(null);

  useEffect(() => {
    void apiFetch<PrintableQuote>(`${eventBase(hotelId, groupId)}/${eventId}/quote/print`).then(setData);
  }, [eventId, groupId, hotelId]);

  if (!data) return <p className="p-8 text-sm">Loading quote…</p>;

  const watermark = formatQuoteStatus(data.quote.status);

  return (
    <div className="hms-print-document bg-white p-8">
      <style jsx global>{HMS_PRINT_DOCUMENT_STYLES}</style>
      <div className="no-print mb-6 flex gap-2">
        <button type="button" className="hms-btn-solid" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <div className="relative hms-print-avoid-break">
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl font-black uppercase tracking-widest text-slate-200 opacity-40 rotate-[-18deg]">
          {watermark}
        </p>
        <header className="border-b pb-4">
          <h1 className="text-2xl font-black">{data.hotelName}</h1>
          <p className="text-sm text-slate-600">{data.hotelAddress || ""}</p>
          <h2 className="mt-4 text-xl font-bold">Event quotation</h2>
          <p className="text-sm">Group: {data.groupName} {data.companyName ? `· ${data.companyName}` : ""}</p>
          <p className="text-sm">Contact: {data.contactPerson || "—"}</p>
        </header>
        <section className="mt-4 text-sm">
          <p><strong>Event:</strong> {data.event.eventName}</p>
          <p><strong>When:</strong> {data.event.startDatetime} → {data.event.endDatetime}</p>
          <p><strong>Venue:</strong> {data.event.venueName || "TBD"} · <strong>Guests:</strong> {data.event.expectedPax ?? "—"}</p>
        </section>
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.quote.lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{line.description}</td>
                <td className="py-2 text-right">{money(line.quantity)}</td>
                <td className="py-2 text-right">{money(line.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-right">{money(line.lineTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>{money(data.quote.subtotal).toFixed(2)}</span></p>
          <p className="flex justify-between"><span>Tax</span><span>{money(data.quote.taxAmount).toFixed(2)}</span></p>
          <p className="flex justify-between"><span>Discount</span><span>-{money(data.quote.discountAmount).toFixed(2)}</span></p>
          <p className="flex justify-between font-bold text-lg"><span>Total</span><span>{money(data.quote.totalAmount).toFixed(2)} {data.currency || ""}</span></p>
          <p className="flex justify-between"><span>Deposit</span><span>{money(data.quote.depositRequired).toFixed(2)} {data.quote.depositPaid ? "(paid)" : ""}</span></p>
          {data.quote.validUntil ? <p className="text-xs text-slate-500">Valid until {data.quote.validUntil}</p> : null}
        </div>
      </div>
    </div>
  );
}
