"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { allowedNextStatuses } from "@/lib/roomStatusTransitions";
import { RoomStatusBadge } from "@/components/RoomStatusBadge";
import { staffAppPath } from "@/lib/staffAppRoutes";

type RoomTypeSummary = {
  id: string;
  name: string;
  baseRate: number;
};

type RoomDetail = {
  id: string;
  roomNumber: string;
  floor: number | null;
  building?: string | null;
  roomType: RoomTypeSummary;
  status: string;
  cleanliness: string;
  isOutOfOrder: boolean;
  dnd: boolean;
  dndUntil: string | null;
  dndSetAt?: string | null;
  operationalState: string;
  maintenanceNotes?: string | null;
  lastUpdated?: string;
  currentReservation: {
    confirmationCode: string;
    guestName?: string;
    status?: string;
  } | null;
  activeRoomBlockId?: string | null;
};

type LogEntry = {
  id: string;
  previousStatus: string;
  newStatus: string;
  previousCleanliness: string;
  newCleanliness: string;
  actor: string;
  changedByUserId?: string | null;
  reason: string;
  createdAt: string;
};

function fmtInstant(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function canPatchRoomStatus(user: AuthUser | null): boolean {
  const r = user?.role;
  return (
    r === "SUPER_ADMIN" ||
    r === "HOTEL_ADMIN" ||
    r === "MANAGER" ||
    r === "HOUSEKEEPING" ||
    r === "HOUSEKEEPING_SUPERVISOR"
  );
}

function canPatchDnd(user: AuthUser | null): boolean {
  const r = user?.role;
  return (
    r === "SUPER_ADMIN" ||
    r === "HOTEL_ADMIN" ||
    r === "MANAGER" ||
    r === "RECEPTIONIST" ||
    r === "HOUSEKEEPING" ||
    r === "HOUSEKEEPING_SUPERVISOR"
  );
}

function canManageBlocks(user: AuthUser | null): boolean {
  const r = user?.role;
  return r === "SUPER_ADMIN" || r === "HOTEL_ADMIN" || r === "MANAGER" || r === "RECEPTIONIST";
}

export function RoomDetailDrawer({
  hotelId,
  roomId,
  open,
  user,
  onClose,
}: {
  hotelId: string;
  roomId: string | null;
  open: boolean;
  user: AuthUser | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [statusTarget, setStatusTarget] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [dndMsg, setDndMsg] = useState<string | null>(null);
  const [dndUntilLocal, setDndUntilLocal] = useState("");
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockType, setBlockType] = useState("MAINTENANCE");
  const [blockReason, setBlockReason] = useState("");
  const [blockFrom, setBlockFrom] = useState("");
  const [blockUntil, setBlockUntil] = useState("");
  const [blockAutoRelease, setBlockAutoRelease] = useState(true);
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["room", hotelId, roomId],
    enabled: open && !!roomId,
    queryFn: () => apiFetch<RoomDetail>(`/api/v1/hotels/${hotelId}/rooms/${roomId}`),
  });

  const historyQuery = useQuery({
    queryKey: ["roomHistory", hotelId, roomId],
    enabled: open && !!roomId,
    queryFn: () =>
      apiFetch<LogEntry[]>(`/api/v1/hotels/${hotelId}/rooms/${roomId}/status-history?limit=5`),
  });

  const room = detailQuery.data;
  const nextStatuses = useMemo(() => allowedNextStatuses(room?.status), [room?.status]);

  const roomIdStable = room?.id;
  const roomDndUntil = room?.dndUntil;
  useEffect(() => {
    if (!roomIdStable) return;
    setStatusTarget("");
    setStatusReason("");
    setStatusMsg(null);
    if (roomDndUntil) {
      const d = new Date(roomDndUntil);
      setDndUntilLocal(Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16));
    } else {
      setDndUntilLocal("");
    }
  }, [roomIdStable, roomDndUntil]);

  const invalidateRooms = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["rooms", hotelId] });
    qc.invalidateQueries({ queryKey: ["roomSummary", hotelId] });
    qc.invalidateQueries({ queryKey: ["room", hotelId, roomId] });
    qc.invalidateQueries({ queryKey: ["roomHistory", hotelId, roomId] });
  }, [qc, hotelId, roomId]);

  const statusMutation = useMutation({
    mutationFn: async () => {
      if (!roomId || !statusTarget) throw new Error("Pick a status");
      if (!statusReason.trim()) throw new Error("Reason is required");
      return apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusTarget, reason: statusReason.trim() }),
      });
    },
    onSuccess: () => {
      setStatusMsg("Status updated.");
      invalidateRooms();
      detailQuery.refetch();
      historyQuery.refetch();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const dndMutation = useMutation({
    mutationFn: async (payload: { is_dnd: boolean; expires_at?: string | null }) => {
      if (!roomId) throw new Error("No room");
      return apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/dnd`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setDndMsg("DND saved.");
      invalidateRooms();
      detailQuery.refetch();
    },
    onError: (e: Error) => setDndMsg(e.message),
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error("No room");
      if (!blockReason.trim()) throw new Error("Reason is required");
      const from = new Date(blockFrom);
      const until = new Date(blockUntil);
      if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime())) {
        throw new Error("Valid blocked from / until required");
      }
      return apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/blocks`, {
        method: "POST",
        body: JSON.stringify({
          block_type: blockType,
          reason: blockReason.trim(),
          blocked_from: from.toISOString(),
          blocked_until: until.toISOString(),
          auto_release: blockAutoRelease,
        }),
      });
    },
    onSuccess: () => {
      setBlockMsg("Block created.");
      setBlockOpen(false);
      setBlockReason("");
      invalidateRooms();
      detailQuery.refetch();
    },
    onError: (e: Error) => setBlockMsg(e.message),
  });

  const releaseBlockMutation = useMutation({
    mutationFn: async () => {
      if (!roomId) throw new Error("No room");
      return apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/blocks`, { method: "DELETE" });
    },
    onSuccess: () => {
      setBlockMsg("Block released.");
      invalidateRooms();
      detailQuery.refetch();
    },
    onError: (e: Error) => setBlockMsg(e.message),
  });

  if (!open || !roomId) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div className="relative h-full w-full max-w-lg bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Room {room?.roomNumber ?? "…"}
            </h2>
            <p className="text-xs text-muted-foreground">{room?.roomType.name ?? "—"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-muted text-muted-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {detailQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {detailQuery.error && (
            <div className="error text-sm">{detailQuery.error.message}</div>
          )}
          {room && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <RoomStatusBadge status={room.status} />
                {room.dnd && (
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                    🚫 DND
                  </span>
                )}
                {room.activeRoomBlockId && (
                  <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                    🔒 Blocked
                  </span>
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Floor</dt>
                <dd className="font-medium">{room.floor ?? "—"}</dd>
                <dt className="text-muted-foreground">Cleanliness</dt>
                <dd className="font-medium">{room.cleanliness}</dd>
                <dt className="text-muted-foreground">Operational</dt>
                <dd>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{room.operationalState}</code>
                </dd>
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-xs">{fmtInstant(room.lastUpdated)}</dd>
              </dl>

              {room.currentReservation && (
                <div className="rounded-lg border border-border/60 p-3 text-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Reservation</p>
                  <p className="font-mono mt-1">{room.currentReservation.confirmationCode}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{room.currentReservation.status}</p>
                </div>
              )}

              {canPatchRoomStatus(user) && (
                <div className="rounded-xl border border-border/60 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Change status</h3>
                  <label className="block text-xs text-muted-foreground">Next status</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={statusTarget}
                    onChange={(e) => setStatusTarget(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                  <label className="block text-xs text-muted-foreground">Reason (required)</label>
                  <textarea
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-[72px]"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="e.g. Guest requested late checkout"
                  />
                  {statusMsg && <p className="text-xs text-muted-foreground">{statusMsg}</p>}
                  <button
                    type="button"
                    className="hms-btn-solid text-sm w-full"
                    disabled={!statusTarget || !statusReason.trim() || statusMutation.isPending}
                    onClick={() => statusMutation.mutate()}
                  >
                    {statusMutation.isPending ? "Saving…" : "Apply status"}
                  </button>
                </div>
              )}

              {canPatchDnd(user) && (
                <div className="rounded-xl border border-border/60 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Do not disturb</h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="hms-btn-outline text-sm"
                      disabled={dndMutation.isPending}
                      onClick={() => dndMutation.mutate({ is_dnd: true, expires_at: dndUntilLocal ? new Date(dndUntilLocal).toISOString() : null })}
                    >
                      Set DND
                    </button>
                    <button
                      type="button"
                      className="hms-btn-outline text-sm"
                      disabled={dndMutation.isPending}
                      onClick={() => dndMutation.mutate({ is_dnd: false })}
                    >
                      Clear DND
                    </button>
                  </div>
                  <label className="block text-xs text-muted-foreground">DND expires (optional, local)</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
                    value={dndUntilLocal}
                    onChange={(e) => setDndUntilLocal(e.target.value)}
                  />
                  {room.dndSetAt && (
                    <p className="text-[11px] text-muted-foreground">DND since {fmtInstant(room.dndSetAt)}</p>
                  )}
                  {dndMsg && <p className="text-xs text-muted-foreground">{dndMsg}</p>}
                </div>
              )}

              {canManageBlocks(user) && (
                <div className="rounded-xl border border-border/60 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Room block</h3>
                  {room.activeRoomBlockId ? (
                    <button
                      type="button"
                      className="hms-btn-outline text-sm w-full"
                      disabled={releaseBlockMutation.isPending}
                      onClick={() => releaseBlockMutation.mutate()}
                    >
                      {releaseBlockMutation.isPending ? "Releasing…" : "Release block"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hms-btn-solid text-sm w-full"
                      onClick={() => {
                        setBlockOpen(true);
                        setBlockMsg(null);
                        const now = new Date();
                        const defEnd = new Date(now.getTime() + 86400000);
                        setBlockFrom(now.toISOString().slice(0, 16));
                        setBlockUntil(defEnd.toISOString().slice(0, 16));
                      }}
                    >
                      Block room
                    </button>
                  )}
                  {blockMsg && <p className="text-xs text-muted-foreground">{blockMsg}</p>}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">Recent status changes</h3>
                {historyQuery.isLoading && <p className="text-xs text-muted-foreground">Loading history…</p>}
                <ul className="space-y-2 text-xs">
                  {(historyQuery.data ?? []).map((l) => (
                    <li key={l.id} className="rounded-lg bg-muted/40 p-2 border border-border/40">
                      <div className="font-mono text-[11px]">
                        {l.previousStatus} → {l.newStatus}
                      </div>
                      <div className="text-muted-foreground mt-0.5">{fmtInstant(l.createdAt)}</div>
                      <div className="mt-1">{l.actor}</div>
                      {l.changedByUserId && (
                        <div className="text-[10px] text-muted-foreground">User {l.changedByUserId}</div>
                      )}
                      <div className="mt-1 text-foreground/90">{l.reason}</div>
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href={staffAppPath("rooms", room.id)}
                className="text-sm text-primary hover:underline inline-block"
              >
                Open full room page →
              </Link>
            </>
          )}
        </div>
      </div>

      {blockOpen && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-card rounded-xl border border-border shadow-lg max-w-md w-full p-4 space-y-3">
            <h3 className="font-semibold">Block room</h3>
            <label className="block text-xs text-muted-foreground">Block type</label>
            <select
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={blockType}
              onChange={(e) => setBlockType(e.target.value)}
            >
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="VIP_HOLD">VIP_HOLD</option>
              <option value="COURTESY">COURTESY</option>
            </select>
            <label className="block text-xs text-muted-foreground">Reason</label>
            <textarea
              className="w-full border border-border rounded-lg px-3 py-2 text-sm min-h-[64px]"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
            <label className="block text-xs text-muted-foreground">Blocked from (local)</label>
            <input
              type="datetime-local"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={blockFrom}
              onChange={(e) => setBlockFrom(e.target.value)}
            />
            <label className="block text-xs text-muted-foreground">Blocked until (local)</label>
            <input
              type="datetime-local"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              value={blockUntil}
              onChange={(e) => setBlockUntil(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={blockAutoRelease}
                onChange={(e) => setBlockAutoRelease(e.target.checked)}
              />
              Auto-release when until passes
            </label>
            {blockMsg && <p className="text-xs text-destructive">{blockMsg}</p>}
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" className="hms-btn-outline text-sm" onClick={() => setBlockOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid text-sm"
                disabled={blockMutation.isPending}
                onClick={() => blockMutation.mutate()}
              >
                {blockMutation.isPending ? "Saving…" : "Create block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
