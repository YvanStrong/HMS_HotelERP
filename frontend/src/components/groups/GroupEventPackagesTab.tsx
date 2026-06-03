"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  downloadEventBillingPdf,
  downloadEventPdf,
  eventBase,
  loadCateringPackages,
  loadDepotProducts,
  money,
  type CateringLine,
  type CateringPackage,
  type DepotProductOption,
  type Quote,
} from "@/lib/eventApi";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { CATERING_QUOTE_COPY, formatQuoteStatus, quoteStatusHint } from "@/lib/groupEventsCopy";

type EventOption = {
  id: string;
  eventName: string;
  quoteId?: string | null;
  quoteStatus?: string | null;
  guaranteedPax?: number | null;
  expectedPax?: number | null;
};

type Props = {
  hotelId: string;
  groupId: string;
  events: EventOption[];
  /** Refresh parent event list (quote status on Functions / BEO tabs). */
  onDataChange?: () => void | Promise<void>;
};

export function GroupEventPackagesTab({ hotelId, groupId, events, onDataChange }: Props) {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const defaultPax = selectedEvent?.guaranteedPax ?? selectedEvent?.expectedPax ?? 1;

  const [packages, setPackages] = useState<CateringPackage[]>([]);
  const [depotProducts, setDepotProducts] = useState<DepotProductOption[]>([]);
  const [lines, setLines] = useState<CateringLine[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [packageId, setPackageId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [qty, setQty] = useState(String(defaultPax));
  const [discount, setDiscount] = useState("0");
  const [deposit, setDeposit] = useState("0");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setQty(String(selectedEvent?.guaranteedPax ?? selectedEvent?.expectedPax ?? 1));
  }, [selectedEventId, selectedEvent?.expectedPax, selectedEvent?.guaranteedPax]);

  const load = useCallback(async () => {
    if (!selectedEventId) return;
    setError(null);
    try {
      const [pkg, depot, catering] = await Promise.all([
        loadCateringPackages(hotelId),
        loadDepotProducts(hotelId),
        apiFetch<CateringLine[]>(`${eventBase(hotelId, groupId)}/${selectedEventId}/catering-lines`, { quiet: true }).catch(
          () => [],
        ),
      ]);
      setPackages(pkg);
      setDepotProducts(depot);
      setLines(catering);

      let q: Quote | null = null;
      try {
        const fetched = await apiFetch<Quote>(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote`, {
          quiet: true,
        });
        if (fetched && typeof fetched === "object" && "id" in fetched) {
          q = fetched;
        }
      } catch {
        q = null;
      }
      setQuote(q);
      if (q) {
        setDiscount(String(money(q.discountAmount)));
        setDeposit(String(money(q.depositRequired)));
      } else {
        setDiscount("0");
        setDeposit("0");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packages & quote");
    }
  }, [events, groupId, hotelId, selectedEventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addLine() {
    if (!selectedEventId) return;
    if (packages.length === 0 && !depotId) {
      setError("Create catering packages in Settings first (link below), or pick a depot product.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        quantity: Number(qty) || defaultPax,
      };
      if (packageId) body.cateringPackageId = packageId;
      else if (depotId) body.depotProductId = depotId;
      else {
        setError("Select a catering package or depot product.");
        setBusy(false);
        return;
      }
      await apiFetch(`${eventBase(hotelId, groupId)}/${selectedEventId}/catering-lines`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPackageId("");
      setDepotId("");
      const catering = await apiFetch<CateringLine[]>(
        `${eventBase(hotelId, groupId)}/${selectedEventId}/catering-lines`,
        { quiet: true },
      ).catch(() => [] as CateringLine[]);
      setLines(Array.isArray(catering) ? catering : []);
      let fetchedQuote = await apiFetch<Quote>(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote`, {
        quiet: true,
      }).catch(() => null);
      if (!fetchedQuote || typeof fetchedQuote !== "object" || !("id" in fetchedQuote)) {
        fetchedQuote = await apiFetch<Quote>(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote`, {
          method: "POST",
          quiet: true,
        }).catch(() => null);
      }
      if (fetchedQuote && typeof fetchedQuote === "object" && "id" in fetchedQuote) {
        setQuote(fetchedQuote);
        setDiscount(String(money(fetchedQuote.discountAmount)));
        setDeposit(String(money(fetchedQuote.depositRequired)));
      }
      await onDataChange?.();
      setInfo("Catering line added — quote updated automatically.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add line");
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(lineId: string) {
    if (!selectedEventId) return;
    setBusy(true);
    await apiFetch(`${eventBase(hotelId, groupId)}/${selectedEventId}/catering-lines/${lineId}`, { method: "DELETE", quiet: true });
    await load();
    await onDataChange?.();
    setBusy(false);
  }

  async function ensureQuote() {
    if (!selectedEventId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote`, { method: "POST" });
      await load();
      await onDataChange?.();
      setInfo("Draft quote created from catering lines.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create quote");
    } finally {
      setBusy(false);
    }
  }

  async function saveQuote(patchStatus?: string) {
    if (!selectedEventId || !quote) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const body: Record<string, unknown> = {
        discountAmount: discount === "" ? 0 : Number(discount),
        depositRequired: deposit === "" ? 0 : Number(deposit),
      };
      if (patchStatus) body.status = patchStatus;
      await apiFetch(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      await load();
      await onDataChange?.();
      if (patchStatus === "SENT") {
        setInfo(CATERING_QUOTE_COPY.sentInfo);
      } else if (patchStatus === "CONTRACTED") {
        setInfo(
          "Contracted. Charges post to the master guest bill when a master room is linked on the Billing tab (or use Retry post there).",
        );
      } else if (patchStatus === "ACCEPTED") {
        setInfo("Marked accepted. Generate a banquet order on the Banquet order tab, then Contract to bill.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save quote";
      if (patchStatus === "CONTRACTED" && msg.toLowerCase().includes("master")) {
        setInfo(
          "Quote marked contracted, but charges were not posted. Link a master room on the group Billing tab, then use Retry post.",
        );
        setError(null);
        await load();
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${eventBase(hotelId, groupId)}/${selectedEventId}/quote/accept`, { method: "POST" });
      await load();
      await onDataChange?.();
      setInfo("Quote accepted. Continue to Banquet order (Next below). Guest bill posting happens on Contract.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept quote");
    } finally {
      setBusy(false);
    }
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Create a function on the Functions tab first.</p>;
  }

  const catalogUrl = `/hotels/${hotelId}/settings/catering-packages`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-950 space-y-2">
        <p>{CATERING_QUOTE_COPY.stepsBanner}</p>
        <p className="text-xs text-indigo-900/90 border-t border-indigo-200/80 pt-2">{CATERING_QUOTE_COPY.deliveryNote}</p>
      </div>

      <FieldLabel label="Function" hint="Which banquet or meeting this quote is for.">
        <select
          className="mt-1 w-full max-w-md rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case"
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.eventName}
              {ev.quoteStatus ? ` · ${formatQuoteStatus(ev.quoteStatus)}` : ""}
            </option>
          ))}
        </select>
      </FieldLabel>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
      {info ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{info}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900">Catering lines</h3>
            <Link href={catalogUrl} className="text-xs font-bold text-indigo-700 hover:underline" title={CATERING_QUOTE_COPY.manageCatalog}>
              {CATERING_QUOTE_COPY.manageCatalog} →
            </Link>
          </div>
          {packages.length === 0 ? (
            <p className="text-sm text-amber-800">
              No packages yet — the dropdown is empty until you add them in{" "}
              <Link href={catalogUrl} className="font-semibold underline">
                Settings → Catering packages
              </Link>
              .
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={packageId}
              onChange={(e) => {
                setPackageId(e.target.value);
                setDepotId("");
              }}
            >
              <option value="">{CATERING_QUOTE_COPY.packagePerGuest}…</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.packageName} — {money(p.pricePerPax).toFixed(2)} / guest
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={depotId}
              onChange={(e) => {
                setDepotId(e.target.value);
                setPackageId("");
              }}
            >
              <option value="">{CATERING_QUOTE_COPY.depotItem}…</option>
              {depotProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName} ({p.productCode})
                </option>
              ))}
            </select>
            <FieldLabel label={CATERING_QUOTE_COPY.quantity} hint="For packages, use guest count; for single items, use units." className="sm:col-span-2">
              <input
                type="number"
                min={0.001}
                step={0.001}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </FieldLabel>
            <button type="button" className="hms-btn-solid text-sm sm:col-span-2" disabled={busy} onClick={() => void addLine()}>
              {CATERING_QUOTE_COPY.addLine}
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lines yet — add at least one package to build the quote.</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li key={line.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
                  <span>
                    {line.description} · {money(line.quantity)} × {money(line.unitPrice).toFixed(2)} ={" "}
                    <strong>{money(line.lineTotal).toFixed(2)}</strong>
                  </span>
                  <button type="button" className="text-xs font-bold text-rose-700" onClick={() => void removeLine(line.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Quote</h3>
            {quote ? (
              <span
                className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800"
                title={quoteStatusHint(quote.status)}
              >
                {formatQuoteStatus(quote.status)}
              </span>
            ) : (
              <button type="button" className="hms-btn-outline text-xs" disabled={busy} onClick={() => void ensureQuote()}>
                Create draft
              </button>
            )}
          </div>
          {quote ? (
            <>
              <p className="text-sm">
                Subtotal: {money(quote.subtotal).toFixed(2)} · Tax: {money(quote.taxAmount).toFixed(2)} · Total:{" "}
                <strong>{money(quote.totalAmount).toFixed(2)}</strong>
              </p>
              {quote.lines?.length > 0 ? (
                <ul className="text-xs text-slate-600 space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  {quote.lines.map((line) => (
                    <li key={line.id}>
                      {line.description} · {money(line.lineTotal).toFixed(2)}
                    </li>
                  ))}
                </ul>
              ) : null}
              <FieldLabel label={CATERING_QUOTE_COPY.discount.label} hint={CATERING_QUOTE_COPY.discount.hint}>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </FieldLabel>
              <FieldLabel label={CATERING_QUOTE_COPY.deposit.label} hint={CATERING_QUOTE_COPY.deposit.hint}>
                <input className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
              </FieldLabel>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="hms-btn-solid text-sm" disabled={busy} onClick={() => void saveQuote()}>
                  {CATERING_QUOTE_COPY.recalculate}
                </button>
                {quote.status === "DRAFT" ? (
                  <button type="button" className="hms-btn-outline text-sm" disabled={busy} onClick={() => void saveQuote("SENT")}>
                    {CATERING_QUOTE_COPY.markSent}
                  </button>
                ) : null}
                {quote.status === "SENT" ? (
                  <button type="button" className="hms-btn-outline text-sm" disabled={busy} onClick={() => void acceptQuote()}>
                    {CATERING_QUOTE_COPY.acceptQuote}
                  </button>
                ) : null}
                {quote.status === "ACCEPTED" ? (
                  <button type="button" className="hms-btn-outline text-sm" disabled={busy} onClick={() => void saveQuote("CONTRACTED")}>
                    {CATERING_QUOTE_COPY.contract}
                  </button>
                ) : null}
                {quote.status === "CONTRACTED" ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50"
                    disabled={pdfBusy || !selectedEventId}
                    onClick={() => {
                      if (!selectedEventId) return;
                      setPdfBusy(true);
                      setError(null);
                      void downloadEventBillingPdf(hotelId, groupId, selectedEventId)
                        .then((name) => setInfo(`Downloaded ${name}`))
                        .catch((e) => setError(e instanceof Error ? e.message : "Could not download billing PDF"))
                        .finally(() => setPdfBusy(false));
                    }}
                  >
                    {pdfBusy ? "Preparing PDF…" : `${CATERING_QUOTE_COPY.printableQuote} →`}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Contract to post billing document to Invoices</span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a catering line above — a draft quote is created and updated automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
