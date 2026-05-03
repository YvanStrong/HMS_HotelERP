"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
  buildTaxInvoiceHtml,
  guessPaymentMethodFromItems,
  openTaxInvoicePrintWindow,
  summarizeFromLineItems,
} from "@/lib/taxInvoiceHtml";

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  confirmationCode: string;
  bookingReference: string;
  guestName: string;
  roomNumber?: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  pdfUrl?: string | null;
};

type ProformaListItem = {
  reservationId: string;
  proformaNumber: string;
  confirmationCode: string;
  bookingReference: string;
  guestName: string;
  status: string;
  grandTotal: number;
  currency: string;
  generatedAt: string;
};

type InvoiceLine = { description: string; amount: number };

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  pdfUrl?: string | null;
  items: InvoiceLine[];
  bookingReference?: string;
  confirmationCode?: string;
  guestName?: string;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  currency?: string;
  createdAt?: string;
};

type ProformaDetail = {
  reservationId: string;
  proformaNumber: string;
  confirmationCode: string;
  bookingReference: string;
  status: string;
  guestName: string;
  roomNumber?: string | null;
  checkInDate: string;
  checkOutDate: string;
  subtotalBeforeTax: number;
  taxes: number;
  depositCredit: number;
  grandTotal: number;
  currency: string;
  generatedAt: string;
  items: InvoiceLine[];
};

export default function InvoicesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [tab, setTab] = useState<"invoices" | "proforma">("invoices");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [proformas, setProformas] = useState<ProformaListItem[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [inv, pf] = await Promise.all([
          apiFetch<InvoiceListItem[]>(`/api/v1/hotels/${hotelId}/invoices`),
          apiFetch<ProformaListItem[]>(`/api/v1/hotels/${hotelId}/invoices/proformas`),
        ]);
        if (!cancelled) {
          setInvoices(inv);
          setProformas(pf);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load invoices");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (tab !== "invoices") {
      setSelectedInvoiceId(null);
      setInvoiceDetail(null);
    }
  }, [tab]);

  const totalInvoiced = useMemo(
    () => invoices.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0),
    [invoices],
  );

  function printSelectedTaxInvoice() {
    if (!invoiceDetail) return;
    setError(null);
    try {
      const d = invoiceDetail;
      const items = (d.items ?? []).map((it) => ({
        description: it.description,
        amount: Number(it.amount),
      }));
      const balanceAfter = Number(d.totalAmount ?? 0);
      const sums = summarizeFromLineItems(items, balanceAfter);
      const pm = guessPaymentMethodFromItems(items);
      const bookingRef =
        d.bookingReference && d.bookingReference !== "-"
          ? d.bookingReference
          : d.confirmationCode && d.confirmationCode !== "-"
            ? d.confirmationCode
            : "—";
      const guestNm = d.guestName ?? "Guest";
      const roomLabel = `${d.roomNumber ?? "—"} (${d.roomTypeName ?? "—"})`;
      const currency = d.currency ?? "USD";
      const whenLabel = d.createdAt ? new Date(d.createdAt).toLocaleString() : new Date().toLocaleString();
      const html = buildTaxInvoiceHtml({
        invoiceNumber: d.invoiceNumber,
        items,
        bookingRef,
        guestName: guestNm,
        roomLabel,
        whenLabel,
        currency,
        totalCharges: sums.totalCharges,
        depositPaid: sums.depositPaid,
        remainingBeforePayment: sums.remainingBeforePayment,
        paidAtCheckout: sums.paidAtCheckout,
        paymentMethodLabel: pm,
        paymentTypesUsed: pm,
        balanceAfter: sums.balanceAfter,
      });
      if (!openTaxInvoicePrintWindow(html)) {
        setError("Pop-up blocked — allow pop-ups to print the invoice.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open invoice");
    }
  }

  async function selectInvoice(row: InvoiceListItem) {
    if (selectedInvoiceId === row.id) {
      setSelectedInvoiceId(null);
      setInvoiceDetail(null);
      return;
    }
    setSelectedInvoiceId(row.id);
    setInvoiceDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiFetch<InvoiceDetail>(`/api/v1/hotels/${hotelId}/invoices/${row.id}`);
      setInvoiceDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoice");
      setSelectedInvoiceId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function printProforma(reservationId: string) {
    try {
      const data = await apiFetch<ProformaDetail>(`/api/v1/hotels/${hotelId}/invoices/proformas/${reservationId}`);
      const esc = (v: unknown) =>
        String(v ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Proforma ${esc(data.proformaNumber)}</title>
      <style>
      body{font-family:Arial,sans-serif;margin:18px;color:#111}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      .muted{color:#666}
      .card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-top:10px}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
      .strong{font-weight:700}
      </style></head><body>
      <div class="head"><div><h2>Proforma Invoice</h2><p class="muted">Estimate only - not a final tax invoice.</p></div><div><div><strong>${esc(data.proformaNumber)}</strong></div><div class="muted">${esc(data.generatedAt)}</div></div></div>
      <div class="card">
      <div class="row"><span class="muted">Booking ref</span><span>${esc(data.bookingReference || data.confirmationCode)}</span></div>
      <div class="row"><span class="muted">Guest</span><span>${esc(data.guestName)}</span></div>
      <div class="row"><span class="muted">Room</span><span>${esc(data.roomNumber || "-")}</span></div>
      <div class="row"><span class="muted">Stay</span><span>${esc(data.checkInDate)} to ${esc(data.checkOutDate)}</span></div>
      <table><thead><tr><th>Description</th><th>Amount (${esc(data.currency)})</th></tr></thead><tbody>
      ${data.items.map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.amount)}</td></tr>`).join("")}
      </tbody></table>
      <div class="row"><span class="muted">Subtotal</span><span>${esc(data.subtotalBeforeTax)}</span></div>
      <div class="row"><span class="muted">Taxes</span><span>${esc(data.taxes)}</span></div>
      <div class="row"><span class="muted">Deposit credit</span><span>- ${esc(data.depositCredit)}</span></div>
      <div class="row strong"><span>Estimated total</span><span>${esc(data.grandTotal)} ${esc(data.currency)}</span></div>
      </div></body></html>`;
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load proforma invoice");
    }
  }

  return (
    <div className="space-y-6">
      <section className="hms-section-card">
        <div className="hms-section-head">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Invoices</h1>
            <p className="hms-section-sub">All final invoices and reservation proforma invoices.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Final invoiced total</p>
            <p className="text-xl font-semibold">{totalInvoiced.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={tab === "invoices" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("invoices")}
          >
            Final Invoices ({invoices.length})
          </button>
          <button
            type="button"
            className={tab === "proforma" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("proforma")}
          >
            Proforma Invoices ({proformas.length})
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <div className="hms-section-card">Loading invoices...</div>}

      {!loading && tab === "invoices" && (
        <section className="hms-section-card space-y-4">
          <p className="text-sm text-muted-foreground">
            Click a row to select an invoice and view its line items below.
          </p>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th className="w-10" aria-hidden />
                  <th>Invoice #</th>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Total</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((row) => {
                  const selected = selectedInvoiceId === row.id;
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected}
                      onClick={() => void selectInvoice(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void selectInvoice(row);
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        selected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="w-10 text-center">
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}
                          aria-hidden
                        />
                      </td>
                      <td className="font-medium">{row.invoiceNumber}</td>
                      <td>{row.bookingReference || row.confirmationCode}</td>
                      <td>{row.guestName}</td>
                      <td>{row.roomNumber || "-"}</td>
                      <td>
                        {Number(row.totalAmount).toFixed(2)} {row.currency}
                      </td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground">
                      No final invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedInvoiceId && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold text-foreground">Selected invoice</h2>
                {invoiceDetail && (
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm w-fit"
                    onClick={() => printSelectedTaxInvoice()}
                  >
                    Print invoice
                  </button>
                )}
              </div>
              {detailLoading && <p className="text-sm text-muted-foreground">Loading line items...</p>}
              {!detailLoading && invoiceDetail && (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">{invoiceDetail.invoiceNumber}</span>
                    {" \u00b7 "}
                    Total {Number(invoiceDetail.totalAmount).toFixed(2)}
                  </p>
                  <div className="hms-table-wrap bg-card">
                    <table className="hms-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceDetail.items ?? []).map((it, idx) => (
                          <tr key={`${it.description}-${idx}`}>
                            <td>{it.description}</td>
                            <td className="text-right font-medium">{Number(it.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {!loading && tab === "proforma" && (
        <section className="hms-section-card">
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Proforma #</th>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Status</th>
                  <th>Estimated Total</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {proformas.map((row) => (
                  <tr key={row.reservationId}>
                    <td className="font-medium">{row.proformaNumber}</td>
                    <td>{row.bookingReference || row.confirmationCode}</td>
                    <td>{row.guestName}</td>
                    <td>{row.status}</td>
                    <td>{Number(row.grandTotal).toFixed(2)} {row.currency}</td>
                    <td>
                      <button
                        type="button"
                        className="hms-btn-outline hms-btn-sm"
                        onClick={() => printProforma(row.reservationId)}
                      >
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
                {proformas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground">No proforma invoices for active stays.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
