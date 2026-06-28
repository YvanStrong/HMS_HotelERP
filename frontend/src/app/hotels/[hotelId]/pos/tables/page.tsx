"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PaginationBar } from "@/components/PaginationBar";
import { PosOutletSelect } from "@/components/PosOutletSelect";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  createPosTable,
  deactivatePosTable,
  fetchPosDepots,
  fetchPosTables,
  updatePosTable,
  type DepotRow,
  type PosTableRow,
} from "@/lib/posTickets";

type TableForm = { label: string; capacity: number; depotId: string };

const PAGE_SIZE = 20;

export default function PosTablesPage() {
  const { hotelId } = useParams<{ hotelId: string }>();
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [depotId, setDepotId] = useState("");
  const [tables, setTables] = useState<PosTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PosTableRow | null>(null);
  const [form, setForm] = useState<TableForm>({ label: "", capacity: 4, depotId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PosTableRow | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    try {
      const d = await fetchPosDepots(hotelId);
      setDepots(d);
      setTables(await fetchPosTables(hotelId, depotId || undefined, true));
    } finally {
      setLoading(false);
    }
  }, [hotelId, depotId]);

  useEffect(() => {
    setPage(1);
  }, [depotId]);

  const paged = useMemo(() => paginateSlice(tables, page, PAGE_SIZE), [tables, page]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(t);
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm({ label: "", capacity: 4, depotId: depotId || depots[0]?.id || "" });
    setError(null);
    setModalOpen(true);
  }

  function openEdit(table: PosTableRow) {
    setEditing(table);
    setForm({ label: table.tableLabel, capacity: table.capacity, depotId });
    setError(null);
    setModalOpen(true);
  }

  async function saveTable() {
    if (!hotelId || !form.label.trim()) {
      setError("Label is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updatePosTable(hotelId, editing.id, {
          label: form.label.trim(),
          capacity: form.capacity,
        });
      } else {
        await createPosTable(hotelId, {
          depotId: form.depotId,
          label: form.label.trim(),
          capacity: form.capacity,
        });
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save table");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(table: PosTableRow) {
    if (!hotelId) return;
    setBusy(true);
    try {
      await deactivatePosTable(hotelId, table.id);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not deactivate table");
    } finally {
      setBusy(false);
    }
  }

  async function reactivate(table: PosTableRow) {
    if (!hotelId) return;
    setBusy(true);
    try {
      await updatePosTable(hotelId, table.id, { isActive: true });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reactivate table");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">POS · Tables</h1>
          <p className="text-sm text-muted-foreground">Manage tables and live occupancy</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="hms-btn-solid hms-btn-sm inline-flex items-center gap-1" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Table
          </button>
          <Link href={staffAppPath("pos")} className="hms-btn-outline hms-btn-sm">
            Catalog POS
          </Link>
          <Link href={staffAppPath("pos/tickets")} className="hms-btn-outline hms-btn-sm">
            Tickets
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

      <PosOutletSelect
        className="mb-4 block text-sm font-medium"
        selectClassName="mt-1 w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2"
        depots={depots}
        value={depotId}
        onChange={setDepotId}
      />

      {error && !modalOpen ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {paged.slice.map((t) => (
            <div
              key={t.id}
              className={`relative rounded-2xl border p-4 text-center ${
                !t.active
                  ? "border-slate-200 bg-slate-100 opacity-70"
                  : t.occupied
                    ? "border-amber-300 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50/60"
              }`}
            >
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-slate-500 hover:bg-white/80"
                  title="Edit"
                  onClick={() => openEdit(t)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {t.active ? (
                  <button
                    type="button"
                    className="rounded p-1 text-red-500 hover:bg-white/80"
                    title="Deactivate"
                    onClick={() => setConfirmDelete(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              <p className="text-lg font-bold">{t.tableLabel}</p>
              {!depotId && t.depotName ? (
                <p className="text-[11px] font-medium text-muted-foreground">{t.depotName}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Seats {t.capacity}</p>
              {!t.active ? (
                <span className="mt-2 inline-block rounded-full bg-slate-300 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                  Inactive
                </span>
              ) : (
                <p className={`mt-2 text-xs font-semibold ${t.occupied ? "text-amber-800" : "text-emerald-800"}`}>
                  {t.occupied ? "Occupied" : "Available"}
                </p>
              )}
              {t.waiterName ? <p className="mt-1 text-[11px] text-muted-foreground">{t.waiterName}</p> : null}
              {t.activeTicketId ? (
                <Link
                  href={staffAppPath(`pos/tickets?ticket=${t.activeTicketId}`)}
                  className="mt-2 inline-block text-xs font-bold text-primary"
                >
                  View ticket
                </Link>
              ) : null}
              {!t.active ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-bold text-primary"
                  onClick={() => void reactivate(t)}
                >
                  Re-activate
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!loading ? (
        <PaginationBar
          page={page}
          totalPages={paged.totalPages}
          totalItems={paged.total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          noun="tables"
        />
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">{editing ? "Edit Table" : "Add Table"}</h2>
            {!editing ? (
              <label className="mt-4 block text-sm">
                Outlet
                <select
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                  value={form.depotId}
                  onChange={(e) => setForm((f) => ({ ...f, depotId: e.target.value }))}
                >
                  {depots.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="mt-4 block text-sm">
              Label
              <input
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="T21"
              />
            </label>
            <label className="mt-4 block text-sm">
              Capacity
              <select
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
              >
                {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="hms-btn-solid hms-btn-sm" disabled={busy} onClick={() => void saveTable()}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-bold">Deactivate Table {confirmDelete.tableLabel}?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This cannot be undone while guests are seated. The table will be hidden from mobile until re-activated.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid hms-btn-sm bg-red-600 hover:bg-red-700"
                disabled={busy}
                onClick={() => void deactivate(confirmDelete)}
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
