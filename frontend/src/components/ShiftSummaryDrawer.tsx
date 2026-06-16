"use client";

import { useEffect, useState } from "react";
import {
  fetchShiftSummary,
  formatShiftDuration,
  shiftMoney,
  type PosShiftSummaryDTO,
} from "@/lib/posShifts";

type Props = {
  hotelId: string;
  shiftId: string | null;
  onClose: () => void;
};

function fmt(v: unknown): string {
  return `RWF ${shiftMoney(v).toLocaleString()}`;
}

export function ShiftSummaryDrawer({ hotelId, shiftId, onClose }: Props) {
  const [summary, setSummary] = useState<PosShiftSummaryDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [ticketPage, setTicketPage] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    if (!shiftId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    void fetchShiftSummary(hotelId, shiftId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [hotelId, shiftId]);

  useEffect(() => {
    setTicketPage(0);
  }, [shiftId]);

  if (!shiftId) return null;

  const tickets = summary?.tickets ?? [];
  const ticketSlice = tickets.slice(ticketPage * pageSize, (ticketPage + 1) * pageSize);
  const ticketPages = Math.max(1, Math.ceil(tickets.length / pageSize));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 print:hidden" onClick={onClose} aria-hidden />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-xl print:static print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b px-4 py-3 print:hidden">
          <h2 className="text-lg font-semibold text-slate-900">Shift report</h2>
          <button type="button" onClick={onClose} className="hms-btn-ghost hms-btn-sm">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : !summary ? (
            <p className="text-red-600">Could not load shift summary.</p>
          ) : (
            <div className="space-y-6" id="shift-report-print">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {summary.waiterName} · {summary.depotName}
                </h3>
                <p className="text-slate-600">
                  {new Date(summary.openedAt).toLocaleString()}
                  {summary.closedAt ? ` → ${new Date(summary.closedAt).toLocaleString()}` : ""}
                </p>
                <p className="text-slate-600">Duration: {formatShiftDuration(summary.durationMinutes)}</p>
              </div>

              <section>
                <h4 className="mb-2 font-medium text-slate-800">Summary</h4>
                <dl className="grid grid-cols-2 gap-2">
                  <dt>Orders</dt>
                  <dd>{summary.totalOrders}</dd>
                  <dt>Covers</dt>
                  <dd>{summary.totalCovers}</dd>
                  <dt>Cancelled</dt>
                  <dd>{summary.totalCancelled}</dd>
                  <dt>Avg ticket</dt>
                  <dd>{fmt(summary.avgTicketValue)}</dd>
                  <dt>Avg serve</dt>
                  <dd>{shiftMoney(summary.avgServeTimeMin)} min</dd>
                </dl>
              </section>

              <section>
                <h4 className="mb-2 font-medium text-slate-800">Revenue</h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt>Cash</dt>
                    <dd>{fmt(summary.totalCash)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Card</dt>
                    <dd>{fmt(summary.totalCard)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Room charge</dt>
                    <dd>{fmt(summary.totalRoomCharge)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Tax</dt>
                    <dd>{fmt(summary.totalTax)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <dt>Total</dt>
                    <dd>{fmt(summary.totalRevenue)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h4 className="mb-2 font-medium text-slate-800">Cash reconciliation</h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt>Opening float</dt>
                    <dd>{fmt(summary.openingFloat)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Cash sales</dt>
                    <dd>{fmt(summary.totalCash)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-1 font-medium">
                    <dt>Expected in drawer</dt>
                    <dd>
                      {fmt(
                        summary.expectedCash != null
                          ? summary.expectedCash
                          : shiftMoney(summary.openingFloat) + shiftMoney(summary.totalCash),
                      )}
                    </dd>
                  </div>
                  {summary.status === "CLOSED" ? (
                    <>
                      <div className="flex justify-between">
                        <dt>Counted</dt>
                        <dd>{fmt(summary.closingCash)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Variance</dt>
                        <dd>
                          {fmt(summary.cashVariance)} ({summary.cashVarianceStatus ?? "—"})
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </section>

              {summary.status === "CLOSED" && summary.closingNotes ? (
                <section>
                  <h4 className="mb-2 font-medium text-slate-800">Closing notes</h4>
                  <p className="text-slate-600">{summary.closingNotes}</p>
                </section>
              ) : null}

              {(summary.revenueByDepot?.length ?? 0) > 0 ? (
                <section>
                  <h4 className="mb-2 font-medium text-slate-800">Sales by outlet</h4>
                  <ul className="space-y-1">
                    {summary.revenueByDepot!.map((row) => (
                      <li key={row.depotId} className="flex justify-between gap-2">
                        <span>
                          {row.depotName} ({row.orderCount} orders)
                        </span>
                        <span>{fmt(row.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {summary.topItems.length > 0 ? (
                <section>
                  <h4 className="mb-2 font-medium text-slate-800">Top items</h4>
                  <ul className="space-y-1">
                    {summary.topItems.map((item) => (
                      <li key={item.productName} className="flex justify-between gap-2">
                        <span>
                          {item.productName} ×{item.qtySold}
                        </span>
                        <span>{fmt(item.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section>
                <h4 className="mb-2 font-medium text-slate-800">Tickets</h4>
                <div className="max-h-64 overflow-y-auto rounded border">
                  <table className="hms-table w-full text-xs">
                    <thead>
                      <tr>
                        <th>Table</th>
                        <th>Closed</th>
                        <th>Payment</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ticketSlice.map((t) => (
                        <tr key={t.ticketId}>
                          <td>
                            {t.depotName ? `${t.depotName} · ` : ""}
                            {t.tableLabel}
                          </td>
                          <td>{t.closedAt ? new Date(t.closedAt).toLocaleTimeString() : "—"}</td>
                          <td>{t.paymentMethod ?? "—"}</td>
                          <td className="text-right">{fmt(t.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ticketPages > 1 ? (
                  <div className="mt-2 flex items-center justify-between print:hidden">
                    <button
                      type="button"
                      className="hms-btn-outline hms-btn-sm"
                      disabled={ticketPage === 0}
                      onClick={() => setTicketPage((p) => p - 1)}
                    >
                      Prev
                    </button>
                    <span className="text-slate-500">
                      Page {ticketPage + 1} / {ticketPages}
                    </span>
                    <button
                      type="button"
                      className="hms-btn-outline hms-btn-sm"
                      disabled={ticketPage >= ticketPages - 1}
                      onClick={() => setTicketPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                ) : null}
              </section>
            </div>
          )}
        </div>

        {summary ? (
          <div className="flex gap-2 border-t p-4 print:hidden">
            <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => window.print()}>
              Print report
            </button>
            <button
              type="button"
              className="hms-btn-outline hms-btn-sm"
              onClick={() => {
                void (async () => {
                  const token = (await import("@/lib/api")).getToken();
                  const res = await fetch(
                    `/api/v1/hotels/${hotelId}/pos/shifts/${summary.id}/export?format=csv`,
                    {
                      headers: token
                        ? { Authorization: `Bearer ${token}`, "X-Hotel-ID": hotelId }
                        : { "X-Hotel-ID": hotelId },
                    },
                  );
                  if (!res.ok) return;
                  const blob = await res.blob();
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `shift-${summary.id}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                })();
              }}
            >
              Export CSV
            </button>
          </div>
        ) : null}
      </aside>
    </>
  );
}
