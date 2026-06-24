"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Trash2, X } from "lucide-react";
import {
  createPosAnnouncement,
  deletePosAnnouncement,
  listPosAnnouncements,
  type PosAnnouncementRow,
} from "@/lib/posAnnouncements";
import { fetchPosDepots, type DepotRow } from "@/lib/posTickets";

type Props = {
  hotelId: string;
  open: boolean;
  onClose: () => void;
};

export function PosAnnouncementsModal({ hotelId, open, onClose }: Props) {
  const [depots, setDepots] = useState<DepotRow[]>([]);
  const [rows, setRows] = useState<PosAnnouncementRow[]>([]);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"INFO" | "WARNING" | "URGENT">("INFO");
  const [depotId, setDepotId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hotelId) return;
    const [d, a] = await Promise.all([fetchPosDepots(hotelId), listPosAnnouncements(hotelId)]);
    setDepots(d);
    setRows(a);
  }, [hotelId]);

  useEffect(() => {
    if (open) void load().catch(() => setError("Could not load announcements"));
  }, [open, load]);

  async function post() {
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPosAnnouncement(hotelId, {
        message: message.trim(),
        type,
        depotId: depotId || undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setMessage("");
      setExpiresAt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deletePosAnnouncement(hotelId, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">POS Announcements</h2>
            <p className="text-sm text-muted-foreground">Broadcast to waiter mobile devices</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 p-4">
          <textarea
            className="hms-input min-h-[80px] w-full text-sm"
            placeholder="Announcement message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              Type
              <select
                className="hms-input mt-1 w-full text-sm"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
              >
                <option value="INFO">Info</option>
                <option value="WARNING">Warning</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Outlet (optional)
              <select
                className="hms-input mt-1 w-full text-sm"
                value={depotId}
                onChange={(e) => setDepotId(e.target.value)}
              >
                <option value="">All outlets</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Expires (optional)
            <input
              type="datetime-local"
              className="hms-input mt-1 w-full text-sm"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post()}
            className="hms-btn-solid w-full text-sm"
          >
            {busy ? "Posting…" : "Post announcement"}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <h3 className="mb-2 mt-6 text-sm font-semibold">Active announcements</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active announcements.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/60 p-3">
                <div>
                  <span className="text-xs font-bold uppercase text-primary">{r.type}</span>
                  <p className="text-sm">{r.message}</p>
                  <p className="text-xs text-muted-foreground">{r.depotName ?? "All outlets"}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(r.id)}
                  className="shrink-0 rounded p-1 text-destructive hover:bg-destructive/10"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PosAnnouncementsButton({ hotelId }: { hotelId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="hms-btn-outline inline-flex items-center gap-1 text-sm"
        onClick={() => setOpen(true)}
      >
        <Megaphone className="h-4 w-4" />
        Announcements
      </button>
      <PosAnnouncementsModal hotelId={hotelId} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
