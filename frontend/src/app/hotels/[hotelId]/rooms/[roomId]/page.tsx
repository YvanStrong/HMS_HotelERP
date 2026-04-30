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
    <>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href={staffAppPath("rooms")}>← Rooms</Link>
      </p>
      <h1>Room {room?.roomNumber ?? "…"}</h1>
      <p style={{ color: "var(--muted)" }}>
        Operational state, DND, and status audit trail from the Room Management API.
      </p>
      {error && <div className="error panel">{error}</div>}
      {msg && <div className="panel">{msg}</div>}
      {room && (
        <>
          <div className="panel">
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
                    <td>
                      <code style={{ fontSize: "0.8rem" }}>{room.activeRoomBlockId}</code>
                    </td>
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
          </div>
          <div className="panel" style={{ maxWidth: 480 }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Do not disturb</h2>
            <form onSubmit={saveDnd}>
              <label>
                <input
                  type="checkbox"
                  checked={dndEnabled}
                  onChange={(e) => {
                    setDndEnabled(e.target.checked);
                    if (!e.target.checked) setDndUntilLocal("");
                  }}
                />{" "}
                DND on
              </label>
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
          </div>
          <div className="panel" style={{ maxWidth: 680 }}>
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
          <div className="panel">
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
        </>
      )}
    </>
  );
}
