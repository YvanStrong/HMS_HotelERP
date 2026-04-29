"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

function randomPassword(length = 14): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!;
  let out = pick(lower) + pick(upper) + pick(digits);
  for (let i = out.length; i < length; i++) {
    out += pick(all);
  }
  return out
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function defaultAdminUsername(hotelCode: string, hotelName: string): string {
  const fromCode = hotelCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (fromCode.length >= 2) return `${fromCode}_admin`;
  const slug = hotelName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);
  return slug.length >= 2 ? `${slug}_admin` : "hotel_admin";
}

export default function CreateHotelPage() {
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

  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdHotel, setCreatedHotel] = useState<{ id: string; name: string } | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const suggestedUsername = useMemo(() => defaultAdminUsername(code, name), [code, name]);

  const fillSuggestedUsername = useCallback(() => {
    setAdminUsername(suggestedUsername);
  }, [suggestedUsername]);

  const fillRandomPassword = useCallback(() => {
    setAdminPassword(randomPassword());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!getToken()) {
      setError("Not signed in.");
      setLoading(false);
      return;
    }

    const u = adminUsername.trim();
    const p = adminPassword;
    if (!u) {
      setError("Hotel admin username is required.");
      setLoading(false);
      return;
    }
    if (p.length < 8) {
      setError("Hotel admin password must be at least 8 characters (or use “Generate password”).");
      setLoading(false);
      return;
    }

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
        adminUsername: u,
        adminPassword: p,
      };

      const response = await apiFetch<{ id: string; name: string }>("/api/v1/platform/hotels", {
        method: "POST",
        body: JSON.stringify(body),
      });

      setCredentials({ username: u, password: p });
      setCreatedHotel(response);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create hotel");
    } finally {
      setLoading(false);
    }
  }

  if (success && createdHotel) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold mb-2">Hotel Created!</h2>
          <p className="text-muted-foreground mb-6">
            &quot;{createdHotel.name}&quot; has been successfully added to the platform.
          </p>

          {credentials && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8 text-left">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <h3 className="font-semibold text-amber-800">Hotel Staff Credentials</h3>
              </div>
              <p className="text-sm text-amber-700 mb-4">
                Share these credentials with the hotel staff to access their dashboard:
              </p>
              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-muted-foreground mb-1">Username</p>
                  <p className="font-mono text-sm font-semibold text-amber-900">{credentials.username}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-xs text-muted-foreground mb-1">Password</p>
                  <p className="font-mono text-sm font-semibold text-amber-900">{credentials.password}</p>
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-4">
                Please save these credentials securely. They will not be shown again.
              </p>
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <Link href={`/platform/hotels/${createdHotel.id}`} className="hms-btn-solid">
              View Hotel
            </Link>
            <Link href="/platform/hotels" className="hms-btn-outline">
              Back to Hotels
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/platform/hotels"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Hotels
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create New Hotel</h1>
          <p className="text-muted-foreground mt-1">Add a new hotel property to the platform</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card rounded-xl border border-border/60 p-6 shadow-soft space-y-6">
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
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Grand Hotel"
                required
              />
            </div>
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-1.5">
                Hotel Code <span className="text-muted-foreground text-xs font-normal">(optional)</span>
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., GRAND-NYC — auto-generated from name if empty"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the hotel..."
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border/60">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            Hotel admin login
          </h2>
          <p className="text-sm text-muted-foreground">
            This account signs in at the staff login and is scoped to the new hotel. Choose the username and password
            yourself; use generate if you prefer a random password.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="adminUsername" className="block text-sm font-medium mb-1.5">
                Admin username <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="adminUsername"
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder={suggestedUsername}
                  autoComplete="off"
                  className="flex-1"
                  required
                />
                <button type="button" className="hms-btn-outline shrink-0 text-sm px-3" onClick={fillSuggestedUsername}>
                  Use suggestion
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Suggestion: {suggestedUsername}</p>
            </div>
            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium mb-1.5">
                Admin password <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="adminPassword"
                  type="text"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="flex-1"
                  required
                  minLength={8}
                />
                <button type="button" className="hms-btn-outline shrink-0 text-sm px-3" onClick={fillRandomPassword}>
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="currency" className="block text-sm font-medium mb-1.5">
                Currency <span className="text-red-500">*</span>
              </label>
              <select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} required>
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
              <label htmlFor="timezone" className="block text-sm font-medium mb-1.5">
                Timezone
              </label>
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
              <label htmlFor="starRating" className="block text-sm font-medium mb-1.5">
                Star Rating
              </label>
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
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Hotel is active and visible to guests
            </label>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Contact Information
          </h2>

          <div>
            <label htmlFor="address" className="block text-sm font-medium mb-1.5">
              Address
            </label>
            <textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address..."
              rows={2}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@hotel.com"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Images
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <ImageUpload value={imageUrl} onChange={setImageUrl} label="Hotel Image" placeholder="Main hotel photo" />
            <ImageUpload value={logoUrl} onChange={setLogoUrl} label="Hotel Logo" placeholder="Hotel logo (optional)" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-6 border-t">
          <button type="submit" disabled={loading || !name.trim()} className="hms-btn-solid">
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Hotel"
            )}
          </button>
          <Link href="/platform/hotels" className="hms-btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
