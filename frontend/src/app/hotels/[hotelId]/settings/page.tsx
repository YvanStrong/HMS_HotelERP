"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

type PublicHotel = {
  id: string;
  name: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const LOCAL_KEY_PREFIX = "hms:hotel:settings:";

function localSettingsKey(hotelId: string): string {
  return `${LOCAL_KEY_PREFIX}${hotelId}`;
}

export default function HotelSettingsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [hotelName, setHotelName] = useState("Hotel");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hotels = await apiFetch<PublicHotel[]>("/api/v1/public/hotels");
        const hotel = hotels.find((h) => h.id === hotelId);
        if (!hotel || cancelled) return;
        setHotelName(hotel.name || "Hotel");
        setLogoUrl(hotel.logoUrl ?? "");
        setHeroImageUrl(hotel.imageUrl ?? "");
      } catch {
        // Keep local fallback only.
      }

      try {
        const raw = localStorage.getItem(localSettingsKey(hotelId));
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as { logoUrl?: string; imageUrl?: string };
        if (parsed.logoUrl) setLogoUrl(parsed.logoUrl);
        if (parsed.imageUrl) setHeroImageUrl(parsed.imageUrl);
      } catch {
        // Ignore malformed local cache.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function saveSettings() {
    setState("saving");
    setError(null);

    const body = {
      logoUrl: logoUrl.trim() || null,
      imageUrl: heroImageUrl.trim() || null,
    };

    let remoteSaved = false;
    try {
      await apiFetch(`/api/v1/platform/hotels/${hotelId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      remoteSaved = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Settings could not be saved";
      setError(`${message}. Saved locally for now.`);
    }

    try {
      localStorage.setItem(localSettingsKey(hotelId), JSON.stringify(body));
    } catch {
      // Best effort.
    }

    setState(remoteSaved ? "saved" : "error");
    window.setTimeout(() => setState("idle"), 1800);
  }

  const headerCopy = useMemo(() => {
    if (state === "saving") return "Saving settings...";
    if (state === "saved") return "Settings saved.";
    if (state === "error") return "Saved locally; backend update failed.";
    return "Set your hotel branding for invoices, pages, and printed docs.";
  }, [state]);

  return (
    <div className="space-y-6">
      <section className="hms-section-card">
        <div className="hms-section-head">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Hotel Settings</h1>
            <p className="text-muted-foreground">{hotelName}</p>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={state === "saving"}
            className="hms-btn-solid hms-btn-sm"
          >
            {state === "saving" ? "Saving..." : "Save Branding"}
          </button>
        </div>

        <p className="text-sm text-muted-foreground">{headerCopy}</p>
        {error && <p className="text-sm text-amber-700 mt-2">{error}</p>}
      </section>

      <section className="hms-section-card space-y-6">
        <ImageUpload
          value={logoUrl}
          onChange={setLogoUrl}
          label="Hotel logo"
          placeholder="Paste logo URL or upload/paste image"
        />

        <ImageUpload
          value={heroImageUrl}
          onChange={setHeroImageUrl}
          label="Hotel cover image"
          placeholder="Paste cover image URL or upload/paste image"
        />
      </section>
    </div>
  );
}
