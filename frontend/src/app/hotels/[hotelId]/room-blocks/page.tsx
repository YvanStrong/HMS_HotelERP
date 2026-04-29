"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";

type Block = {
  id: string;
  roomId: string;
  roomNumber: string;
  blockType: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  releasedAt: string | null;
};

type RoomListRow = {
  id: string;
  roomNumber: string;
  roomType: { name: string };
};

type PagedRooms = {
  data: RoomListRow[];
  pagination: { page: number; size: number; total: number; totalPages?: number; hasNext?: boolean };
};

function defaultRange() {
  const a = new Date();
  const b = new Date();
  b.setDate(b.getDate() + 30);
  return { start: a.toISOString().slice(0, 10), end: b.toISOString().slice(0, 10) };
}

export default function RoomBlocksPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const range = useMemo(() => defaultRange(), []);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  const [manualRoomId, setManualRoomId] = useState("");
  const [rooms, setRooms] = useState<RoomListRow[]>([]);
  const [roomFilter, setRoomFilter] = useState("");
  const [roomsErr, setRoomsErr] = useState<string | null>(null);
  const [blockType, setBlockType] = useState("MAINTENANCE");
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [msg, setMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const data = await apiFetch<Block[]>(
        `/api/v1/hotels/${hotelId}/rooms/blocks?rangeStart=${range.start}&rangeEnd=${range.end}`,
      );
      setBlocks(data);
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blocks");
    }
  }, [hotelId, range.start, range.end]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRooms = useCallback(async () => {
    setRoomsErr(null);
    if (!getToken()) return;
    try {
      const collected: RoomListRow[] = [];
      let page = 1;
      const size = 100;
      for (let i = 0; i < 15; i++) {
        const json = await apiFetch<PagedRooms>(`/api/v1/hotels/${hotelId}/rooms?page=${page}&size=${size}`);
        collected.push(...json.data);
        const totalPages = json.pagination.totalPages ?? Math.max(1, Math.ceil(json.pagination.total / size));
        if (page >= totalPages) break;
        page += 1;
      }
      setRooms(collected);
    } catch (e) {
      setRooms([]);
      setRoomsErr(e instanceof Error ? e.message : "Could not load rooms");
    }
  }, [hotelId]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const filteredRooms = useMemo(() => {
    const q = roomFilter.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(q) ||
        r.roomType.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rooms, roomFilter]);

  const roomSelectOptions = useMemo(() => {
    if (!roomId || filteredRooms.some((r) => r.id === roomId)) {
      return filteredRooms;
    }
    const cur = rooms.find((r) => r.id === roomId);
    return cur ? [cur, ...filteredRooms] : filteredRooms;
  }, [rooms, roomId, filteredRooms]);

  const { slice: blockPage, total, totalPages } = useMemo(
    () => paginateSlice(blocks, page, PAGE_SIZE),
    [blocks, page],
  );

  async function createBlock(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const resolvedRoom = manualRoomId.trim() || roomId.trim();
    if (!resolvedRoom) {
      setMsg("Choose a room from the list or paste a room id in advanced.");
      return;
    }
    try {
      await apiFetch<Block>(`/api/v1/hotels/${hotelId}/rooms/blocks`, {
        method: "POST",
        body: JSON.stringify({
          roomId: resolvedRoom,
          blockType,
          startDate,
          endDate,
          notes: "Created from HMS UI",
        }),
      });
      setMsg("Block created. Room set to BLOCKED until released.");
      setManualRoomId("");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function release(id: string) {
    setMsg(null);
    try {
      await apiFetch<Block>(`/api/v1/hotels/${hotelId}/rooms/blocks/${id}/release`, {
        method: "POST",
      });
      setMsg("Block released.");
      await load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Release failed");
    }
  }

  return (
    <>
      <h1>Room blocks &amp; holds</h1>
      <p style={{ color: "var(--muted)" }}>
        API: <code>GET/POST …/rooms/blocks</code>, <code>POST …/blocks/{"{id}"}/release</code>. Types: COURTESY_HOLD,
        MAINTENANCE, VIP_PRE_ASSIGN, CORPORATE_BLOCK. Dates use reservation convention (end exclusive).
      </p>
      {error && <div className="error panel">{error}</div>}
      {roomsErr && <div className="error panel">{roomsErr}</div>}
      {msg && <div className="panel">{msg}</div>}
      <div className="panel book-register-form" style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Create block</h2>
        <form noValidate onSubmit={createBlock}>
          <label htmlFor="rb-room-filter">Search rooms (optional)</label>
          <input
            id="rb-room-filter"
            type="search"
            placeholder="Room number or type…"
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            autoComplete="off"
          />
          <label htmlFor="rb-room-select" style={{ marginTop: "0.75rem" }}>
            Room
          </label>
          <select
            id="rb-room-select"
            value={roomId}
            onChange={(e) => {
              setRoomId(e.target.value);
              setManualRoomId("");
            }}
            className="book-register-hotel-select"
          >
            <option value="">Choose a room…</option>
            {roomSelectOptions.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.roomNumber} · {r.roomType.name}
              </option>
            ))}
          </select>
          {filteredRooms.length === 0 && rooms.length > 0 && (
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.45rem" }}>
              No matches — clear search to see all loaded rooms.
            </p>
          )}
          <details className="book-register-advanced" style={{ marginTop: "0.85rem" }}>
            <summary>Room not in the list?</summary>
            <label htmlFor="rb-manual-room" style={{ marginTop: "0.5rem" }}>
              Room id (uuid)
            </label>
            <input
              id="rb-manual-room"
              value={manualRoomId}
              onChange={(e) => setManualRoomId(e.target.value)}
              placeholder="from API or deep link"
              autoComplete="off"
              spellCheck={false}
              style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.88rem" }}
            />
          </details>
          <label style={{ marginTop: "0.75rem" }}>Type</label>
          <select value={blockType} onChange={(e) => setBlockType(e.target.value)}>
            <option value="MAINTENANCE">MAINTENANCE</option>
            <option value="COURTESY_HOLD">COURTESY_HOLD</option>
            <option value="VIP_PRE_ASSIGN">VIP_PRE_ASSIGN</option>
            <option value="CORPORATE_BLOCK">CORPORATE_BLOCK</option>
          </select>
          <label style={{ marginTop: "0.75rem" }}>Start (inclusive)</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <label style={{ marginTop: "0.75rem" }}>End (exclusive)</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div style={{ marginTop: "1rem" }}>
            <button type="submit">Create</button>
          </div>
        </form>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0, fontSize: "1rem" }}>Active in range</h2>
        <table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {blockPage.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.roomNumber} <code style={{ fontSize: "0.75rem" }}>{b.roomId.slice(0, 8)}…</code>
                </td>
                <td>{b.blockType}</td>
                <td>{b.startDate}</td>
                <td>{b.endDate}</td>
                <td>
                  {!b.releasedAt ? (
                    <button type="button" onClick={() => release(b.id)}>
                      Release
                    </button>
                  ) : (
                    "released"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          noun="blocks"
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
