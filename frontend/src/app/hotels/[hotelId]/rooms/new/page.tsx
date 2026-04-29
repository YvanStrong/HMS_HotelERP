"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { ImageUpload } from "@/components/ImageUpload";

type RoomType = {
  id: string;
  name: string;
  baseRate: number;
  maxOccupancy?: number;
};

export default function CreateRoomPage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = String(params.hotelId);
  
  const [roomNumber, setRoomNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [building, setBuilding] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [maintenanceNotes, setMaintenanceNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load room types
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        return;
      }
      try {
        const types = await apiFetch<RoomType[]>(`/api/v1/hotels/${hotelId}/room-types`);
        if (!cancelled) {
          setRoomTypes(types);
          if (types.length > 0) {
            setRoomTypeId(types[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) setError("Failed to load room types");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const body = {
        roomNumber: roomNumber.trim(),
        floor: floor ? parseInt(floor, 10) : null,
        building: building.trim() || null,
        roomTypeId: roomTypeId || null,
        imageUrl: imageUrl || null,
        maintenanceNotes: maintenanceNotes.trim() || null,
      };
      
      await apiFetch(`/api/v1/hotels/${hotelId}/rooms`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      
      setSuccess(true);
      setTimeout(() => {
        router.push(staffAppPath("rooms"));
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Room Created!</h2>
          <p className="text-muted-foreground">Redirecting to rooms list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={staffAppPath("rooms")}
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Rooms
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Create New Room</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border/60 p-6 shadow-soft space-y-5">
        {/* Room Number */}
        <div>
          <label htmlFor="roomNumber" className="block text-sm font-medium mb-1.5">
            Room Number <span className="text-red-500">*</span>
          </label>
          <input
            id="roomNumber"
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="e.g., 101, A-205"
            required
          />
        </div>

        {/* Floor & Building */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="floor" className="block text-sm font-medium mb-1.5">Floor</label>
            <input
              id="floor"
              type="number"
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              placeholder="e.g., 1"
              min="0"
            />
          </div>
          <div>
            <label htmlFor="building" className="block text-sm font-medium mb-1.5">Building</label>
            <input
              id="building"
              type="text"
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="e.g., Main, Annex"
            />
          </div>
        </div>

        {/* Room Type */}
        <div>
          <label htmlFor="roomType" className="block text-sm font-medium mb-1.5">
            Room Type <span className="text-red-500">*</span>
          </label>
          <select
            id="roomType"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            required
            className="w-full"
          >
            <option value="">Select a room type...</option>
            {roomTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} — Base Rate: {type.baseRate}, Max: {type.maxOccupancy || "—"} guests
              </option>
            ))}
          </select>
          {roomTypes.length === 0 && (
            <p className="text-sm text-amber-600 mt-1">
              No room types available. Please create room types first.
            </p>
          )}
        </div>

        {/* Image Upload */}
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label="Room Image"
          placeholder="Enter image URL or upload"
        />

        {/* Maintenance Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1.5">Maintenance Notes</label>
          <textarea
            id="notes"
            value={maintenanceNotes}
            onChange={(e) => setMaintenanceNotes(e.target.value)}
            placeholder="Any special notes about this room..."
            rows={3}
          />
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading || !roomNumber.trim() || !roomTypeId}
            className="hms-btn-solid"
          >
            {loading ? "Creating..." : "Create Room"}
          </button>
          <Link href={staffAppPath("rooms")} className="hms-btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
