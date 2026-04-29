"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { ImageUpload } from "@/components/ImageUpload";

export default function CreateRoomTypePage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = String(params.hotelId);
  
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [baseRate, setBaseRate] = useState("");
  const [maxOccupancy, setMaxOccupancy] = useState("");
  const [bedCount, setBedCount] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [amenities, setAmenities] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const body = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        baseRate: parseFloat(baseRate) || 0,
        maxOccupancy: maxOccupancy ? parseInt(maxOccupancy, 10) : null,
        bedCount: bedCount ? parseInt(bedCount, 10) : null,
        imageUrl: imageUrl || null,
        amenities: amenities.split(",").map(a => a.trim()).filter(Boolean),
      };
      
      await apiFetch(`/api/v1/hotels/${hotelId}/room-types`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      
      setSuccess(true);
      setTimeout(() => {
        router.push(staffAppPath("room-types"));
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room type");
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
          <h2 className="text-xl font-semibold mb-2">Room Type Created!</h2>
          <p className="text-muted-foreground">Redirecting to room types list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={staffAppPath("room-types")}
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Room Types
        </Link>
      </div>

      <h1 className="text-2xl font-bold tracking-tight mb-6">Create New Room Type</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border/60 p-6 shadow-soft space-y-5">
        {/* Name & Code */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Deluxe King"
              required
            />
          </div>
          <div>
            <label htmlFor="code" className="block text-sm font-medium mb-1.5">Code</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., DLX-KG"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1.5">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Room features, view, size, etc."
            rows={3}
          />
        </div>

        {/* Base Rate */}
        <div>
          <label htmlFor="baseRate" className="block text-sm font-medium mb-1.5">
            Base Rate <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              id="baseRate"
              type="number"
              min="0"
              step="0.01"
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              placeholder="0.00"
              required
              className="pl-8"
            />
          </div>
        </div>

        {/* Occupancy & Beds */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="maxOccupancy" className="block text-sm font-medium mb-1.5">Max Occupancy</label>
            <input
              id="maxOccupancy"
              type="number"
              min="1"
              value={maxOccupancy}
              onChange={(e) => setMaxOccupancy(e.target.value)}
              placeholder="e.g., 2"
            />
          </div>
          <div>
            <label htmlFor="bedCount" className="block text-sm font-medium mb-1.5">Bed Count</label>
            <input
              id="bedCount"
              type="number"
              min="0"
              value={bedCount}
              onChange={(e) => setBedCount(e.target.value)}
              placeholder="e.g., 1"
            />
          </div>
        </div>

        {/* Image Upload */}
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
          label="Room Type Image"
          placeholder="Enter image URL or upload"
        />

        {/* Amenities */}
        <div>
          <label htmlFor="amenities" className="block text-sm font-medium mb-1.5">
            Amenities <span className="text-muted-foreground font-normal">(comma-separated)</span>
          </label>
          <input
            id="amenities"
            type="text"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="e.g., WiFi, TV, Mini Bar, Ocean View"
          />
          <p className="text-xs text-muted-foreground mt-1">Separate amenities with commas</p>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={loading || !name.trim() || !baseRate}
            className="hms-btn-solid"
          >
            {loading ? "Creating..." : "Create Room Type"}
          </button>
          <Link href={staffAppPath("room-types")} className="hms-btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
