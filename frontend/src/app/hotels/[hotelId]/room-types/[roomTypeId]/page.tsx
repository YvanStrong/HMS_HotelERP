"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";

type RoomTypeSummary = {
  id: string;
  code?: string;
  name: string;
  baseRate: number;
  maxOccupancy?: number;
  bedCount?: number;
};

type RoomRow = {
  id: string;
  roomNumber: string;
  floor: number | null;
  status: string;
  roomType: { id: string; name: string };
};

type PagedRooms = {
  data: RoomRow[];
};

type RateEntry = { rateDate: string; nightlyRate: number };

function next30Days() {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + 30);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function RoomTypeDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const roomTypeId = String(params.roomTypeId);
  const [roomType, setRoomType] = useState<RoomTypeSummary | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"rooms" | "rates">("rooms");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("");
  const [bedCount, setBedCount] = useState("");

  const range = useMemo(() => next30Days(), []);

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const [rt, roomList, ratesList] = await Promise.all([
        apiFetch<RoomTypeSummary>(`/api/v1/hotels/${hotelId}/room-types/${roomTypeId}`),
        apiFetch<PagedRooms>(`/api/v1/hotels/${hotelId}/rooms?page=1&size=500&roomType=${encodeURIComponent(roomTypeId)}`),
        apiFetch<RateEntry[]>(
          `/api/v1/hotels/${hotelId}/room-types/${roomTypeId}/nightly-rates?from=${range.from}&to=${range.to}`,
        ),
      ]);
      setRoomType(rt);
      setRooms(roomList.data);
      setRates(ratesList);
      setName(rt.name ?? "");
      setCode(rt.code ?? "");
      setBaseRate(String(rt.baseRate ?? ""));
      setMaxOccupancy(rt.maxOccupancy != null ? String(rt.maxOccupancy) : "");
      setBedCount(rt.bedCount != null ? String(rt.bedCount) : "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load room type");
    }
  }, [hotelId, roomTypeId, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveChanges() {
    setBanner(null);
    if (!name.trim() || !code.trim()) {
      setBanner("Name and code are required.");
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/room-types/${roomTypeId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: null,
          baseRate: Number(baseRate) || 0,
          maxOccupancy: Number(maxOccupancy) || 1,
          bedCount: Number(bedCount) || 1,
          amenities: [],
        }),
      });
      setEditOpen(false);
      setBanner("Room type updated.");
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Update failed");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRoomType() {
    setBanner(null);
    setIsDeleting(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/room-types/${roomTypeId}`, { method: "DELETE" });
      window.location.href = staffAppPath("room-types");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-sm mb-2">
          <Link href={staffAppPath("room-types")} className="text-primary">
            ← Room types
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">{roomType?.name ?? "Room Type"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Rooms and rate overrides for this room type.</p>
      </div>
      {error && <div className="error">{error}</div>}
      {banner && <div className="panel">{banner}</div>}
      {roomType && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Code</p>
            <p className="mt-1 text-lg font-semibold">{roomType.code || "—"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Base Rate</p>
            <p className="mt-1 text-lg font-semibold">{roomType.baseRate}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Max Occupancy</p>
            <p className="mt-1 text-lg font-semibold">{roomType.maxOccupancy ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Linked Rooms</p>
            <p className="mt-1 text-lg font-semibold">{rooms.length}</p>
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" className="hms-btn-outline" onClick={() => setEditOpen(true)}>
          Edit room type
        </button>
        <button type="button" className="hms-btn-outline" disabled={isDeleting} onClick={() => void deleteRoomType()}>
          {isDeleting ? "Deleting..." : "Delete room type"}
        </button>
        <Link href={staffAppPath("room-types", roomTypeId, "rates")} className="hms-btn-solid">
          Open full rates editor
        </Link>
      </div>

      <div className="panel rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={activeTab === "rooms" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setActiveTab("rooms")}
          >
            Rooms
          </button>
          <button
            type="button"
            className={activeTab === "rates" ? "hms-btn-solid text-sm" : "hms-btn-outline text-sm"}
            onClick={() => setActiveTab("rates")}
          >
            Rates (30 days)
          </button>
        </div>
      </div>

      {activeTab === "rooms" && (
        <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Rooms using this type</h2>
          {rooms.length === 0 ? (
            <p className="text-muted-foreground">No rooms currently linked to this room type.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-t border-border/50">
                      <td>{r.roomNumber}</td>
                      <td>{r.floor ?? "—"}</td>
                      <td>{r.status.replaceAll("_", " ")}</td>
                      <td className="text-right">
                        <Link href={staffAppPath("rooms", r.id)} className="text-primary text-xs">
                          Open room
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "rates" && (
        <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-3">Nightly overrides ({range.from} to {range.to})</h2>
          {rates.length === 0 ? (
            <p className="text-muted-foreground">No overrides in this range. Base rate applies.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th>Date</th>
                    <th>Nightly Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((r) => (
                    <tr key={r.rateDate} className="border-t border-border/50">
                      <td>{r.rateDate}</td>
                      <td>{r.nightlyRate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Edit room type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                Code
                <input value={code} onChange={(e) => setCode(e.target.value)} />
              </label>
              <label>
                Base rate
                <input type="number" min="0" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} />
              </label>
              <label>
                Max occupancy
                <input type="number" min="1" value={maxOccupancy} onChange={(e) => setMaxOccupancy(e.target.value)} />
              </label>
              <label>
                Bed count
                <input type="number" min="1" value={bedCount} onChange={(e) => setBedCount(e.target.value)} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" disabled={isSaving} onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button type="button" className="hms-btn-solid" disabled={isSaving} onClick={() => void saveChanges()}>
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
