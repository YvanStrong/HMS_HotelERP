"use client";

import {
  type StaffFolio,
  folioBalance,
  folioTaxLabel,
  formatFolioInstant,
  formatMoney,
} from "@/lib/folioDisplay";

type Props = {
  folio: StaffFolio;
  balance: number;
};

export function EventGuestBillFolio({ folio, balance }: Props) {
  const currency = folio.summary.currency ?? "USD";
  const showRoomCharges = Number(folio.summary.room_charges_total ?? 0) > 0.001;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-teal-200/80 bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-teal-800">Bill to</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{folio.guest.name}</p>
            {folio.guest.email ? (
              <p className="text-sm text-muted-foreground">{folio.guest.email}</p>
            ) : null}
          </div>
          <div className="text-right text-sm text-slate-700">
            {folio.booking_reference || folio.confirmationCode ? (
              <p>
                <span className="text-muted-foreground">Reference: </span>
                <span className="font-mono font-semibold">
                  {folio.booking_reference ?? folio.confirmationCode}
                </span>
              </p>
            ) : null}
            {folio.confirmationCode && folio.booking_reference ? (
              <p className="mt-1">
                <span className="text-muted-foreground">Confirmation: </span>
                <span className="font-mono text-xs">{folio.confirmationCode}</span>
              </p>
            ) : null}
            {folio.stay ? (
              <p className="mt-1">
                <span className="text-muted-foreground">Function dates: </span>
                {folio.stay.checkIn}
                {folio.stay.checkIn !== folio.stay.checkOut ? ` → ${folio.stay.checkOut}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-3xl font-black tabular-nums text-rose-600">
          {formatMoney(balance, currency)}
        </p>
        <p className="text-xs text-muted-foreground">Balance due on event guest bill</p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
        <h2 className="border-b border-slate-100 pb-3 text-lg font-bold tracking-tight text-slate-900">
          Folio — {folio.booking_reference ?? folio.confirmationCode ?? folio.reservationId.slice(0, 8)}
        </h2>
        {folio.billing_route_note ? (
          <div className="mb-4 mt-4 rounded-xl border border-slate-200 bg-muted/40 px-3 py-2.5 text-sm text-foreground">
            {folio.billing_route_note}
          </div>
        ) : null}

        <h3 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-teal-800">Charges</h3>
        {folio.charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No charges posted yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {folio.charges.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">
                      {formatFolioInstant(c.date)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-slate-800">{c.description}</div>
                      {c.postedBy ? (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">Posted by {c.postedBy}</div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">{c.type}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums text-slate-700">
                      {c.quantity ?? 1}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums text-slate-900">
                      {formatMoney(Number(c.amount), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-800">
          {showRoomCharges ? (
            <p className="m-0 flex justify-between gap-2">
              <span className="text-muted-foreground">Room charges</span>
              <strong className="tabular-nums">{formatMoney(folio.summary.room_charges_total, currency)}</strong>
            </p>
          ) : null}
          <p className="m-0 flex justify-between gap-2">
            <span className="text-muted-foreground">Event &amp; other charges</span>
            <strong className="tabular-nums">{formatMoney(folio.summary.other_charges_total, currency)}</strong>
          </p>
          <p className="m-0 flex justify-between gap-2">
            <span className="text-muted-foreground">Subtotal (pre-tax)</span>
            <strong className="tabular-nums">{formatMoney(folio.summary.gross_total, currency)}</strong>
          </p>
          <p className="m-0 flex justify-between gap-2">
            <span className="text-muted-foreground">{folioTaxLabel(folio.summary)}</span>
            <strong className="tabular-nums">{formatMoney(folio.summary.tax_total, currency)}</strong>
          </p>
          {Number(folio.summary.discount_total ?? 0) > 0 ? (
            <p className="m-0 flex justify-between gap-2">
              <span className="text-muted-foreground">Discount</span>
              <strong className="tabular-nums">{formatMoney(folio.summary.discount_total, currency)}</strong>
            </p>
          ) : null}
          <p className="m-0 flex justify-between gap-2 border-t border-slate-200/80 pt-2">
            <span className="font-semibold text-slate-900">Total (after tax)</span>
            <strong className="tabular-nums text-slate-900">{formatMoney(folio.summary.grand_total, currency)}</strong>
          </p>
          {Number(folio.summary.deposit_credit ?? 0) > 0 ? (
            <p className="m-0 flex justify-between gap-2">
              <span className="text-muted-foreground">Deposit credit</span>
              <strong className="tabular-nums">{formatMoney(folio.summary.deposit_credit, currency)}</strong>
            </p>
          ) : null}
          <p className="m-0 flex justify-between gap-2">
            <span className="text-muted-foreground">Payments total</span>
            <strong className="tabular-nums">{formatMoney(folio.summary.payments_total, currency)}</strong>
          </p>
        </div>

        <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-teal-800">Payments</h3>
        {folio.payments?.length ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {folio.payments.map((p, i) => (
                  <tr key={p.id ?? `${p.postedAt}-${i}`} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {formatFolioInstant(p.postedAt)}
                    </td>
                    <td className="px-3 py-2">{p.method}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{p.type ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{p.reference ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                      {formatMoney(Number(p.amount), currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        )}

        <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-lg font-bold text-emerald-950">
          Balance due: <span className="tabular-nums">{formatMoney(balance, currency)}</span>
        </p>

        {folio.ledger && folio.ledger.length > 0 ? (
          <>
            <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-teal-800">Ledger</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">D/C</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {folio.ledger.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">
                        {formatFolioInstant(row.createdAt)}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {row.type}
                        {row.category ? <span className="text-muted-foreground"> · {row.category}</span> : null}
                      </td>
                      <td className="px-3 py-2 align-top text-slate-800">{row.description ?? "—"}</td>
                      <td className="px-3 py-2 align-top text-xs">{row.debit_credit}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums">
                        {formatMoney(Number(row.amount), currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export { folioBalance };
