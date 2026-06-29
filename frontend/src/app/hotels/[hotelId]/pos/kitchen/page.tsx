"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Client } from "@stomp/stompjs";
import { PaginationBar } from "@/components/PaginationBar";
import { PosOutletSelect } from "@/components/PosOutletSelect";
import { getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  fetchKitchenBoard,
  fetchPosDepots,
  markLineReady,
  markLineServed,
  type DepotRow,
  type KitchenTicketRow,
  type TicketLineRow,
} from "@/lib/posTickets";

function wsBrokerUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  if (raw && String(raw).trim()) {
    return String(raw).trim().replace(/\/$/, "").replace(/^http/, "ws") + "/ws";
  }
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.hostname}:8080/ws`;
  }
  return "ws://localhost:8080/ws";
}

const PAGE_SIZE = 12;

function KitchenLineActions({
  hotelId,
  ticketId,
  line,
  onDone,
}: {
  hotelId: string;
  ticketId: string;
  line: TicketLineRow;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function run(action: "ready" | "served") {
    setBusy(true);
    try {
      if (action === "ready") await markLineReady(hotelId, ticketId, line.id);
      else await markLineServed(hotelId, ticketId, line.id);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 flex gap-2">
      {line.lineStatus === "PREPARING" ? (
        <button type="button" disabled={busy} className="hms-btn-solid hms-btn-sm" onClick={() => void run("ready")}>
          Ready
        </button>
      ) : null}
      {line.lineStatus === "READY" ? (
        <button type="button" disabled={busy} className="hms-btn-outline hms-btn-sm" onClick={() => void run("served")}>
          Served
        </button>
      ) : null}
    </div>
  );
}

export default function PosKitchenPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [depotId, setDepotId] = useState("");
  const [board, setBoard] = useState<KitchenTicketRow[]>([]);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!hotelId) return;
    const d = await fetchPosDepots(hotelId);
    setDepots(d);
    setBoard(await fetchKitchenBoard(hotelId, depotId || undefined));
  }, [hotelId, depotId]);

  useEffect(() => {
    setPage(1);
  }, [depotId]);

  const paged = useMemo(() => paginateSlice(board, page, PAGE_SIZE), [board, page]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token || !hotelId) return;

    const client = new Client({
      brokerURL: wsBrokerUrl(),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/hotel/${hotelId}/pos/kitchen`, () => void load());
        client.subscribe(`/topic/hotel/${hotelId}/pos/line-ready`, () => void load());
      },
    });
    client.activate();
    return () => {
      void client.deactivate();
    };
  }, [hotelId, load]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">POS · Kitchen</h1>
          <p className="text-sm text-muted-foreground">KDS board with live WebSocket refresh</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={staffAppPath("pos/tables")} className="hms-btn-outline hms-btn-sm">
            Tables
          </Link>
          <Link href={staffAppPath("pos/tickets")} className="hms-btn-outline hms-btn-sm">
            Tickets
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

      <PosOutletSelect
        className="mb-4"
        selectClassName="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        depots={depots}
        value={depotId}
        onChange={setDepotId}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paged.total === 0 ? (
          <p className="text-sm text-muted-foreground">No active kitchen items.</p>
        ) : (
          paged.slice.map((ticket) => (
            <div key={ticket.ticketId} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{ticket.tableLabel}</p>
                  {!depotId ? (
                    <p className="text-xs text-muted-foreground">{ticket.depotName}</p>
                  ) : null}
                </div>
                <span className="text-xs font-medium text-muted-foreground">{ticket.status}</span>
              </div>
              {ticket.lines.map((line) => (
                <div key={line.id} className="mb-3 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">
                      {line.quantity}× {line.productName}
                    </span>
                    <span className="text-xs text-muted-foreground">R{line.round}</span>
                  </div>
                  {line.notes ? <p className="mt-1 text-xs text-muted-foreground">{line.notes}</p> : null}
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-amber-800">{line.lineStatus}</p>
                  <KitchenLineActions
                    hotelId={hotelId}
                    ticketId={ticket.ticketId}
                    line={line}
                    onDone={() => void load()}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={paged.totalPages}
        totalItems={paged.total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        noun="tickets"
      />
    </div>
  );
}
