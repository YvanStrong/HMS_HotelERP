"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { PosOutletSelect } from "@/components/PosOutletSelect";
import { apiFetch } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  cancelPosTicket,
  closeTicketInvoice,
  fetchPosDepots,
  fetchPosTicket,
  fetchPosTickets,
  formatElapsed,
  minutesOpen,
  money,
  urgencyClass,
  type DepotRow,
  type TicketDetail,
  type TicketLineRow,
  type TicketRow,
} from "@/lib/posTickets";

type GuestHit = {
  reservation_id?: string;
  reservationId?: string;
  guest_name?: string;
  guestName?: string;
  room_number?: string;
  roomNumber?: string;
};

const STATUS_FILTERS = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "SENT_TO_KITCHEN", label: "Sent to kitchen" },
  { key: "SERVED", label: "Served" },
  { key: "ATTENTION", label: "Needs attention" },
] as const;

const PAGE_SIZE = 20;

function statusBadgeClass(status: string): string {
  switch (status) {
    case "OPEN":
      return "bg-sky-100 text-sky-900";
    case "SENT_TO_KITCHEN":
      return "bg-amber-100 text-amber-900";
    case "SERVED":
      return "bg-emerald-100 text-emerald-900";
    case "CLOSED":
      return "bg-slate-200 text-slate-800";
    case "CANCELLED":
      return "bg-red-100 text-red-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function lineBadgeClass(status: string): string {
  switch (status) {
    case "READY":
      return "bg-emerald-100 text-emerald-800";
    case "PREPARING":
      return "bg-amber-100 text-amber-800";
    case "SERVED":
      return "bg-slate-200 text-slate-600";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function groupLinesByRound(lines: TicketLineRow[]): [number, TicketLineRow[]][] {
  const map = new Map<number, TicketLineRow[]>();
  for (const line of lines) {
    const round = line.round || 1;
    const bucket = map.get(round) ?? [];
    bucket.push(line);
    map.set(round, bucket);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}

export default function PosTicketsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("ticket");
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [depotId, setDepotId] = useState("");
  const [status, setStatus] = useState<string>("OPEN");
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<TicketRow | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "ROOM">("CASH");
  const [guestQuery, setGuestQuery] = useState("");
  const [guestHits, setGuestHits] = useState<GuestHit[]>([]);
  const [selectedGuest, setSelectedGuest] = useState<GuestHit | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [closeResult, setCloseResult] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!hotelId) return;
    const d = await fetchPosDepots(hotelId);
    setDepots(d);
    const apiStatus = status === "ATTENTION" ? "OPEN" : status;
    let rows = await fetchPosTickets(hotelId, depotId || undefined, apiStatus);
    if (status === "ATTENTION") {
      rows = rows.filter((t) => minutesOpen(t.openedAt) > 45);
    } else if (status === "ALL") {
      rows = await fetchPosTickets(hotelId, depotId || undefined, "ALL");
    }
    setTickets(rows);
  }, [hotelId, depotId, status]);

  useEffect(() => {
    setPage(1);
  }, [depotId, status]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!highlightId || !hotelId) return;
    void (async () => {
      try {
        const d = await fetchPosTicket(hotelId, highlightId);
        setSelected({
          id: d.id,
          depotId: d.depotId,
          depotName: d.depotName,
          tableId: d.tableId,
          tableLabel: d.tableLabel,
          status: d.status,
          customerName: d.customerName,
          subtotal: d.subtotal,
          taxAmount: d.taxAmount,
          totalAmount: d.totalAmount,
          lineCount: d.lines.length,
          currentRound: d.currentRound,
          waiterName: d.waiterName,
          openedAt: d.openedAt,
          kitchenSentAt: d.kitchenSentAt,
          updatedAt: d.updatedAt,
          saleId: d.saleId,
          saleNumber: d.saleNumber,
          deliveryOrderId: d.deliveryOrderId,
          deliveryNumber: d.deliveryNumber,
        });
        setDetail(d);
      } catch {
        /* ignore */
      }
    })();
  }, [highlightId, hotelId]);

  async function openDetail(ticket: TicketRow) {
    if (!hotelId) return;
    setSelected(ticket);
    setDetail(null);
    setCloseResult(null);
    setError(null);
    setDetailLoading(true);
    try {
      setDetail(await fetchPosTicket(hotelId, ticket.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load ticket");
    } finally {
      setDetailLoading(false);
    }
  }

  async function searchGuests(q: string) {
    if (!hotelId || q.length < 2) {
      setGuestHits([]);
      return;
    }
    try {
      const hits = await apiFetch<GuestHit[]>(
        `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(q)}`,
        { quiet: true },
      );
      setGuestHits((hits ?? []).filter((h) => h.reservation_id || h.reservationId));
    } catch {
      setGuestHits([]);
    }
  }

  async function confirmClose() {
    if (!hotelId || !selected) return;
    setBusyId(selected.id);
    setError(null);
    try {
      const body =
        paymentMethod === "ROOM"
          ? {
              mode: "CHARGE_ROOM",
              chargeToRoom: true,
              reservationId: selectedGuest?.reservation_id ?? selectedGuest?.reservationId,
              customerName:
                selectedGuest?.guest_name ??
                selectedGuest?.guestName ??
                selected.customerName ??
                selected.tableLabel,
            }
          : {
              mode: "INVOICE",
              paymentMethod,
              customerName: selected.customerName ?? selected.tableLabel,
            };
      const result = await closeTicketInvoice(hotelId, selected.id, body);
      setCloseResult(result);
      setCloseOpen(false);
      setDetail(result);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel() {
    if (!hotelId || !selected) return;
    setBusyId(selected.id);
    try {
      await cancelPosTicket(hotelId, selected.id);
      setCancelOpen(false);
      setSelected(null);
      setDetail(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusyId(null);
    }
  }

  const sortedTickets = useMemo(() => {
    void tick;
    return [...tickets].sort((a, b) => minutesOpen(b.openedAt) - minutesOpen(a.openedAt));
  }, [tickets, tick]);

  const paged = useMemo(() => paginateSlice(sortedTickets, page, PAGE_SIZE), [sortedTickets, page]);

  const detailRounds = detail ? groupLinesByRound(detail.lines) : [];
  const canClose = detail && ["OPEN", "SENT_TO_KITCHEN", "SERVED"].includes(detail.status);
  const canCancel = detail?.status === "OPEN";

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">POS · Tickets</h1>
          <p className="text-sm text-muted-foreground">Manage open tickets · cashier close & cancel</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staffAppPath("pos/tables")} className="hms-btn-outline hms-btn-sm">
            Tables
          </Link>
          <Link href={staffAppPath("pos/kitchen")} className="hms-btn-outline hms-btn-sm">
            Kitchen
          </Link>
          <Link href={staffAppPath("pos/analytics")} className="hms-btn-outline hms-btn-sm">
            Analytics
          </Link>
          <Link href={staffAppPath("pos/shifts")} className="hms-btn-outline hms-btn-sm">
            Shifts
          </Link>
          <Link href={staffAppPath("pos/voids")} className="hms-btn-outline hms-btn-sm">
            Voids &amp; Discounts
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PosOutletSelect
          showLabel={false}
          selectClassName="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          depots={depots}
          value={depotId}
          onChange={setDepotId}
        />
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                status === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
              onClick={() => setStatus(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs font-bold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Time open</th>
              <th className="px-4 py-3">Waiter</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedTickets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No tickets for this filter.
                </td>
              </tr>
            ) : (
              sortedTickets.map((t) => {
                const mins = minutesOpen(t.openedAt);
                return (
                  <tr
                    key={t.id}
                    className={`cursor-pointer border-t border-border ${urgencyClass(mins)} ${
                      highlightId === t.id ? "ring-2 ring-primary/30" : ""
                    }`}
                    onClick={() => void openDetail(t)}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {t.tableLabel}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{t.depotName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(t.status)}`}>
                        {t.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatElapsed(mins)}</td>
                    <td className="px-4 py-3">{t.waiterName ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-bold">{money(t.totalAmount).toFixed(2)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={page}
        totalPages={paged.totalPages}
        totalItems={paged.total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        noun="tickets"
      />

      {selected ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
          <div className="flex h-full w-full max-w-lg flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">{selected.tableLabel}</h2>
                <p className="text-sm text-muted-foreground">{selected.depotName}</p>
              </div>
              <button type="button" className="text-sm font-medium text-muted-foreground" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <p className="text-sm text-muted-foreground">Loading ticket…</p>
              ) : detail ? (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusBadgeClass(detail.status)}`}>
                      {detail.status.replaceAll("_", " ")}
                    </span>
                    {detail.openedAt ? (
                      <span className="text-sm text-muted-foreground">{formatElapsed(minutesOpen(detail.openedAt))}</span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Waiter: {detail.waiterName ?? "—"}
                    {detail.customerName ? ` · Guest: ${detail.customerName}` : ""}
                  </p>

                  {detailRounds.map(([round, lines]) => (
                    <div key={round} className="mt-4">
                      <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Round {round}</p>
                      <div className="space-y-2">
                        {lines.map((line) => (
                          <div key={line.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                            <div>
                              <p className="font-medium">
                                {line.productName} × {line.quantity}
                              </p>
                              {line.notes ? <p className="text-xs text-muted-foreground">{line.notes}</p> : null}
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{money(line.lineTotal).toFixed(2)}</p>
                              <span className={`text-[10px] font-bold uppercase ${lineBadgeClass(line.lineStatus)}`}>
                                {line.lineStatus}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="mt-6 rounded-xl bg-muted/40 p-4 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{money(detail.subtotal).toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span>Tax</span>
                      <span>{money(detail.taxAmount).toFixed(2)}</span>
                    </div>
                    <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-bold">
                      <span>Total</span>
                      <span>{money(detail.totalAmount).toFixed(2)}</span>
                    </div>
                  </div>

                  {detail.status === "CLOSED" && detail.saleId ? (
                    <Link href={staffAppPath(`invoices`)} className="mt-4 inline-block text-sm font-bold text-primary">
                      View invoice {detail.saleNumber ? `#${detail.saleNumber}` : ""}
                    </Link>
                  ) : null}

                  {closeResult?.saleNumber ? (
                    <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      Invoice #{closeResult.saleNumber} created.{" "}
                      <Link href={staffAppPath("invoices")} className="font-bold underline">
                        Open invoices
                      </Link>
                    </p>
                  ) : null}

                  {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
                </>
              ) : null}
            </div>
            {detail ? (
              <div className="border-t border-border px-5 py-4">
                {canClose ? (
                  <button
                    type="button"
                    className="hms-btn-solid mb-2 w-full"
                    disabled={busyId === detail.id}
                    onClick={() => {
                      setPaymentMethod("CASH");
                      setSelectedGuest(null);
                      setCloseOpen(true);
                    }}
                  >
                    Close ticket
                  </button>
                ) : null}
                {canCancel ? (
                  <button
                    type="button"
                    className="hms-btn-outline w-full border-red-300 text-red-700"
                    disabled={busyId === detail.id}
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel ticket
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {closeOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">Close & create invoice</h2>
            <div className="mt-4 flex gap-2">
              {(["CASH", "CARD", "ROOM"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold ${
                    paymentMethod === m ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                  onClick={() => setPaymentMethod(m)}
                >
                  {m === "ROOM" ? "Room charge" : m.charAt(0) + m.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            {paymentMethod === "ROOM" ? (
              <div className="mt-4">
                <input
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  placeholder="Search guest by name or room"
                  value={guestQuery}
                  onChange={(e) => {
                    setGuestQuery(e.target.value);
                    void searchGuests(e.target.value);
                  }}
                />
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {guestHits.map((g) => {
                    const id = g.reservation_id ?? g.reservationId;
                    const name = g.guest_name ?? g.guestName ?? "Guest";
                    const room = g.room_number ?? g.roomNumber ?? "";
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${
                          selectedGuest === g ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedGuest(g)}
                      >
                        {name} {room ? `· Room ${room}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setCloseOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid hms-btn-sm"
                disabled={busyId === selected.id || (paymentMethod === "ROOM" && !selectedGuest)}
                onClick={() => void confirmClose()}
              >
                Close & create invoice
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelOpen && selected && detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">Cancel ticket for {selected.tableLabel}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All {detail.lines.length} items will be voided. This cannot be undone.
            </p>
            <input
              className="mt-4 w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder="Reason (optional)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setCancelOpen(false)}>
                Keep ticket
              </button>
              <button
                type="button"
                className="hms-btn-solid hms-btn-sm bg-red-600"
                disabled={busyId === selected.id}
                onClick={() => void confirmCancel()}
              >
                Cancel ticket
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
