"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";
import { publicFetch } from "@/lib/publicApi";
import { ImageUpload } from "@/components/ImageUpload";

type Hotel = {
  id: string;
  name: string;
  code: string;
  description?: string;
  currency: string;
  timezone?: string;
  address?: string;
  phone?: string;
  email?: string;
  imageUrl?: string;
  logoUrl?: string;
  starRating?: number;
  isActive: boolean;
};

export default function EditHotelPage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = String(params.hotelId);

  const [hotel, setHotel] = useState<Hotel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("UTC");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [starRating, setStarRating] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getToken()) {
        setError("Not signed in.");
        setLoading(false);
        return;
      }
      try {
        // Load hotel from public API
        const hotelsData = await publicFetch<Hotel[]>("/api/v1/public/hotels");
        const hotelData = hotelsData.find((h) => h.id === hotelId);
        if (!hotelData) {
          throw new Error("Hotel not found");
        }
        if (!cancelled) {
          setHotel(hotelData);
          // Set form values
          setName(hotelData.name);
          setCode(hotelData.code || "");
          setDescription(hotelData.description || "");
          setCurrency(hotelData.currency);
          setTimezone(hotelData.timezone || "UTC");
          setAddress(hotelData.address || "");
          setPhone(hotelData.phone || "");
          setEmail(hotelData.email || "");
          setImageUrl(hotelData.imageUrl || "");
          setLogoUrl(hotelData.logoUrl || "");
          setStarRating(hotelData.starRating?.toString() || "");
          setIsActive(hotelData.isActive);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load hotel");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        currency: currency.trim(),
        timezone: timezone.trim() || "UTC",
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        imageUrl: imageUrl || null,
        logoUrl: logoUrl || null,
        starRating: starRating ? parseInt(starRating, 10) : null,
        isActive,
      };

      await apiFetch(`/api/v1/platform/hotels/${hotelId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });

      setSuccess(true);
      setTimeout(() => {
        router.push(`/platform/hotels/${hotelId}`);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update hotel";
      if (message.includes("404") || message.includes("Not Found")) {
        setError("Update API not implemented on backend. Hotel editing is currently not available. Please use the database or API directly to update hotels.");
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-6">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground mb-4">{error || "Hotel not found"}</p>
        <Link href="/platform/hotels" className="hms-btn-outline">
          Back to Hotels
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold mb-2">Hotel Updated!</h2>
        <p className="text-muted-foreground">Redirecting to hotel details...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/platform/hotels/${hotelId}`}
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Hotel Details
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Hotel</h1>
          <p className="text-muted-foreground mt-1">Update {hotel.name} details</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border/60 p-6 shadow-soft space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Basic Information
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                Hotel Name <span className="text-red-500">*</span>
              </label>
              <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-1.5">Hotel Code</label>
              <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1.5">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        {/* Settings */}
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1.5">Currency</label>
              <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (C$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CNY">CNY (¥)</option>
                <option value="AED">AED (د.إ)</option>
              </select>
            </div>
            <div>
              <label htmlFor="timezone" className="block text-sm font-medium mb-1.5">Timezone</label>
              <select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Dubai">Dubai</option>
                <option value="Asia/Tokyo">Tokyo</option>
                <option value="Asia/Singapore">Singapore</option>
                <option value="Australia/Sydney">Sydney</option>
              </select>
            </div>
            <div>
              <label htmlFor="starRating" className="block text-sm font-medium mb-1.5">Star Rating</label>
              <select id="starRating" value={starRating} onChange={(e) => setStarRating(e.target.value)}>
                <option value="">Not rated</option>
                <option value="1">1 Star</option>
                <option value="2">2 Stars</option>
                <option value="3">3 Stars</option>
                <option value="4">4 Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
            <label htmlFor="isActive" className="text-sm font-medium">Hotel is active and visible to guests</label>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Contact Information
          </h2>

          <div>
            <label htmlFor="address" className="block text-sm font-medium mb-1.5">Address</label>
            <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-1.5">Phone</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Images
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <ImageUpload value={imageUrl} onChange={setImageUrl} label="Hotel Image" placeholder="Main hotel photo" />
            <ImageUpload value={logoUrl} onChange={setLogoUrl} label="Hotel Logo" placeholder="Hotel logo (optional)" />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center gap-3 pt-6 border-t">
          <button type="submit" disabled={saving || !name.trim()} className="hms-btn-solid">
            {saving ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
          <Link href={`/platform/hotels/${hotelId}`} className="hms-btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
