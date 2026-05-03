"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { ImageUpload } from "@/components/ImageUpload";

type RoomTypeSummary = {
  id: string;
  name: string;
  baseRate: number;
  maxOccupancy?: number;
  bedCount?: number;
};

type ReservationSummary = {
  id: string;
  confirmationCode: string;
  guestName?: string;
  guestId?: string;
  status?: string;
  checkInDate?: string;
  checkOutDate?: string;
};

type RoomDetail = {
  id: string;
  roomNumber: string;
  floor: number | null;
  building?: string | null;
  photoUrl?: string | null;
  roomType: RoomTypeSummary;
  status: string;
  cleanliness: string;
  isOutOfOrder: boolean;
  dnd: boolean;
  dndUntil: string | null;
  dndSetAt?: string | null;
  activeRoomBlockId?: string | null;
  operationalState: string;
  maintenanceNotes?: string | null;
  lastUpdated?: string;
  currentReservation: ReservationSummary | null;
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

function statusTone(status: string): string {
  if (status.includes("OCCUPIED")) return "bg-blue-100 text-blue-800";
  if (status.includes("VACANT_CLEAN") || status.includes("INSPECTED")) return "bg-emerald-100 text-emerald-800";
  if (status.includes("VACANT_DIRTY")) return "bg-amber-100 text-amber-900";
  if (status.includes("BLOCKED") || status.includes("OUT_OF_ORDER") || status.includes("MAINTENANCE")) {
    return "bg-rose-100 text-rose-800";
  }
  return "bg-slate-100 text-slate-800";
}

const DEFAULT_ROOM_IMAGE = "/images/default-room.svg";

export default function RoomDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const roomId = String(params.roomId);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [dndUntilLocal, setDndUntilLocal] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "history" | "housekeeping" | "maintenance">("info");
  const [nextStatus, setNextStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockUntilLocal, setBlockUntilLocal] = useState("");
  const [photoUrlDraft, setPhotoUrlDraft] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const r = await apiFetch<RoomDetail>(`/api/v1/hotels/${hotelId}/rooms/${roomId}`);
      setRoom(r);
      setPhotoUrlDraft(r.photoUrl ?? "");
      setDndEnabled(r.dnd);
      if (r.dndUntil) {
        const d = new Date(r.dndUntil);
        setDndUntilLocal(Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16));
      } else {
        setDndUntilLocal("");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room");
    }
    try {
      const h = await apiFetch<LogEntry[]>(
        `/api/v1/hotels/${hotelId}/rooms/${roomId}/status-history?limit=50`,
      );
      setLogs(h);
    } catch {
      setLogs([]);
    }
  }, [hotelId, roomId]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveDnd(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const body: { is_dnd: boolean; expires_at?: string } = { is_dnd: dndEnabled };
      if (dndEnabled && dndUntilLocal.trim()) {
        const d = new Date(dndUntilLocal);
        if (!Number.isNaN(d.getTime())) body.expires_at = d.toISOString();
      }
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/dnd`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMsg("DND updated.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "DND update failed");
    }
  }

  async function applyHousekeepingStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!nextStatus) {
      setMsg("Choose a status.");
      return;
    }
    if (!statusReason.trim()) {
      setMsg("Reason is required.");
      return;
    }
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, reason: statusReason.trim() }),
      });
      setMsg("Room status updated.");
      setStatusReason("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Status update failed");
    }
  }

  async function releaseRoomBlock() {
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/blocks`, { method: "DELETE" });
      setMsg("Room block released.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Block release failed");
    }
  }

  async function createMaintenanceBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockReason.trim()) {
      setMsg("Block reason is required.");
      return;
    }
    const untilDate = new Date(blockUntilLocal);
    if (Number.isNaN(untilDate.getTime())) {
      setMsg("Choose a valid block-until date and time.");
      return;
    }
    setMsg(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}/blocks`, {
        method: "POST",
        body: JSON.stringify({
          block_type: "MAINTENANCE",
          reason: blockReason.trim(),
          blocked_from: new Date().toISOString(),
          blocked_until: untilDate.toISOString(),
          auto_release: true,
        }),
      });
      setMsg("Maintenance block created.");
      setBlockReason("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to create maintenance block");
    }
  }

  async function savePhoto(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSavingPhoto(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl: photoUrlDraft }),
      });
      setMsg("Room photo updated.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Photo update failed");
    } finally {
      setSavingPhoto(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p style={{ marginBottom: "0.5rem" }}>
          <Link href={staffAppPath("rooms")} className="text-primary">← Rooms</Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Room {room?.roomNumber ?? "…"}</h1>
        <p style={{ color: "var(--muted)" }}>
          Operational state, DND, and status audit trail from the Room Management API.
        </p>
        {room && (
          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(room.status)}`}>{room.status}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(room.cleanliness)}`}>{room.cleanliness}</span>
            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
              {room.roomType.name}
            </span>
            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700">
              Floor {room.floor ?? "—"}
            </span>
          </div>
        )}
      </div>
      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}
      {room && (
        <>
          <div className="panel rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={activeTab === "info" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
                onClick={() => setActiveTab("info")}
              >
                Room Info
              </button>
              <button
                type="button"
                className={activeTab === "history" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
                onClick={() => setActiveTab("history")}
              >
                Status History
              </button>
              <button
                type="button"
                className={activeTab === "housekeeping" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
                onClick={() => setActiveTab("housekeeping")}
              >
                Housekeeping
              </button>
              <button
                type="button"
                className={activeTab === "maintenance" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
                onClick={() => setActiveTab("maintenance")}
              >
                Maintenance
              </button>
            </div>
          </div>
          {activeTab === "info" && (
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Snapshot</h2>
            <img
              src={room.photoUrl || DEFAULT_ROOM_IMAGE}
              alt={`${room.roomType.name} room ${room.roomNumber}`}
              className="mb-4 h-44 w-full max-w-xl rounded-lg border border-border/60 object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_ROOM_IMAGE;
              }}
            />
            <table>
              <tbody>
                <tr>
                  <th style={{ textAlign: "left", width: 180 }}>Number</th>
                  <td>{room.roomNumber}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Type</th>
                  <td>{room.roomType.name}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Floor</th>
                  <td>{room.floor ?? "—"}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Status</th>
                  <td>{room.status}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Cleanliness</th>
                  <td>{room.cleanliness}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Out of order</th>
                  <td>{room.isOutOfOrder ? "yes" : "no"}</td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Operational state</th>
                  <td>
                    <code>{room.operationalState}</code>
                  </td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>DND</th>
                  <td>
                    {room.dnd ? "on" : "off"}
                    {room.dndUntil ? ` until ${fmtInstant(room.dndUntil)}` : ""}
                    {room.dndSetAt ? ` (since ${fmtInstant(room.dndSetAt)})` : ""}
                  </td>
                </tr>
                {room.activeRoomBlockId && (
                  <tr>
                    <th style={{ textAlign: "left" }}>Active block</th>
                    <td>Active maintenance/operational block</td>
                  </tr>
                )}
                <tr>
                  <th style={{ textAlign: "left" }}>Reservation</th>
                  <td>
                    {room.currentReservation ? (
                      <>
                        <code>{room.currentReservation.confirmationCode}</code>
                        {room.currentReservation.guestName ? ` — ${room.currentReservation.guestName}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                <tr>
                  <th style={{ textAlign: "left" }}>Last updated</th>
                  <td>{fmtInstant(room.lastUpdated)}</td>
                </tr>
              </tbody>
            </table>
            <hr style={{ margin: "1.25rem 0", borderColor: "var(--border)" }} />
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Edit photo</h2>
            <form onSubmit={savePhoto}>
              <ImageUpload
                value={photoUrlDraft}
                onChange={setPhotoUrlDraft}
                label="Room photo"
                placeholder="Paste image URL, drop, upload, or Ctrl+V"
              />
              <div style={{ marginTop: "1rem" }}>
                <button type="submit" disabled={savingPhoto}>
                  {savingPhoto ? "Saving..." : "Save photo"}
                </button>
              </div>
            </form>
          </div>
          )}
          {activeTab === "housekeeping" && (
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm" style={{ maxWidth: 560 }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Do not disturb</h2>
            <form onSubmit={saveDnd}>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  marginBottom: "0.65rem",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>DND on</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                    Housekeeping will skip this room while enabled
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDndEnabled((v) => {
                      const next = !v;
                      if (!next) setDndUntilLocal("");
                      return next;
                    });
                  }}
                  aria-pressed={dndEnabled}
                  style={{
                    width: "56px",
                    height: "30px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: dndEnabled ? "#0f766e" : "#e5e7eb",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: dndEnabled ? "29px" : "3px",
                      width: "22px",
                      height: "22px",
                      borderRadius: "999px",
                      background: "#fff",
                      transition: "left 120ms ease",
                    }}
                  />
                </button>
              </div>
              {dndEnabled && (
                <>
                  <label style={{ display: "block", marginTop: "0.75rem" }}>Until (optional, local)</label>
                  <input
                    type="datetime-local"
                    value={dndUntilLocal}
                    onChange={(e) => setDndUntilLocal(e.target.value)}
                  />
                  <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.35rem 0 0" }}>
                    Clearing &quot;until&quot; still keeps DND on until you turn it off. Turn off DND to clear
                    housekeeping skip for that room.
                  </p>
                </>
              )}
              <div style={{ marginTop: "1rem" }}>
                <button type="submit">Save DND</button>
              </div>
            </form>
            <hr style={{ margin: "1rem 0", borderColor: "var(--border)" }} />
            <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Housekeeping status update</h3>
            <form onSubmit={applyHousekeepingStatus}>
              <label style={{ display: "block", marginTop: "0.4rem" }}>Next room status</label>
              <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
                <option value="">Select…</option>
                {[
                  "VACANT_CLEAN",
                  "VACANT_DIRTY",
                  "INSPECTED",
                  "UNDER_MAINTENANCE",
                  "OUT_OF_ORDER",
                  "BLOCKED",
                  "RESERVED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", marginTop: "0.7rem" }}>Reason</label>
              <textarea
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="e.g. Deep cleaning completed"
              />
              <div style={{ marginTop: "0.8rem" }}>
                <button type="submit" disabled={!nextStatus || !statusReason.trim()}>
                  Apply status
                </button>
              </div>
            </form>
          </div>
          )}
          {activeTab === "history" && (
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Status history</h2>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Status</th>
                  <th>Clean</th>
                  <th>Actor</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.85rem" }}>{fmtInstant(l.createdAt)}</td>
                    <td>
                      <code style={{ fontSize: "0.75rem" }}>
                        {l.previousStatus}→{l.newStatus}
                      </code>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>
                      {l.previousCleanliness}→{l.newCleanliness}
                    </td>
                    <td>
                      {l.actor}
                      {l.changedByUserId ? (
                        <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}> · {l.changedByUserId}</span>
                      ) : null}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {activeTab === "maintenance" && (
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm" style={{ maxWidth: 620 }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Maintenance controls</h2>
            {room.activeRoomBlockId ? (
              <div>
                <p style={{ color: "var(--muted)" }}>
                  This room currently has an active operational block.
                </p>
                <button type="button" onClick={() => void releaseRoomBlock()}>
                  Release active block
                </button>
              </div>
            ) : (
              <form onSubmit={createMaintenanceBlock}>
                <label style={{ display: "block" }}>Maintenance reason</label>
                <textarea
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Plumbing repair"
                />
                <label style={{ display: "block", marginTop: "0.7rem" }}>Block until</label>
                <input
                  type="datetime-local"
                  value={blockUntilLocal}
                  onChange={(e) => setBlockUntilLocal(e.target.value)}
                />
                <div style={{ marginTop: "0.8rem" }}>
                  <button type="submit" disabled={!blockReason.trim() || !blockUntilLocal}>
                    Create maintenance block
                  </button>
                </div>
              </form>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}
