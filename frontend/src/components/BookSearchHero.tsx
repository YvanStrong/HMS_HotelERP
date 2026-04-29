"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { publicFetch } from "@/lib/publicApi";

type PublicHotelCatalogRow = {
  id: string;
  name: string;
  code: string;
  currency: string;
  timezone?: string;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function optionLabel(h: PublicHotelCatalogRow): string {
  const bits = [h.name];
  if (h.code) bits.push(`(${h.code})`);
  bits.push(`· ${h.currency}`);
  return bits.join(" ");
}

export function BookSearchHero() {
  const router = useRouter();
  const [hotels, setHotels] = useState<PublicHotelCatalogRow[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [hotelId, setHotelId] = useState("");
  const [checkIn, setCheckIn] = useState(todayISODate);
  const [checkOut, setCheckOut] = useState(() => addDays(todayISODate(), 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const minCheckIn = useMemo(() => todayISODate(), []);

  const load = useCallback(async () => {
    setCatalogError(null);
    setHotels(null);
    try {
      const list = await publicFetch<PublicHotelCatalogRow[]>("/api/v1/public/hotels");
      setHotels(list);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "Could not load hotels.");
      setHotels([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (checkIn < minCheckIn) {
      setCheckIn(minCheckIn);
    }
  }, [checkIn, minCheckIn]);

  useEffect(() => {
    if (checkOut <= checkIn) {
      setCheckOut(addDays(checkIn, 1));
    }
  }, [checkIn, checkOut]);

  function bumpAdults(delta: number) {
    setAdults((a) => Math.min(20, Math.max(1, a + delta)));
  }

  function bumpChildren(delta: number) {
    setChildren((c) => Math.min(20, Math.max(0, c + delta)));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!hotelId) {
      setFormError("Choose a hotel to continue.");
      return;
    }
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    if (adults < 1) {
      setFormError("At least one adult is required.");
      return;
    }
    const q = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    router.push(`/book/hotels/${hotelId}?${q.toString()}`);
  }

  const ready = hotels !== null;
  const hasHotels = ready && hotels.length > 0;

  return (
    <div className="book-search-layout">
      <section className="book-search-hero" aria-labelledby="book-search-heading">
        <h1 id="book-search-heading" className="book-search-headline">
          Find your next stay
        </h1>
        <p className="book-search-sub">
          Choose a property, your dates, and who is traveling — then pick a room and confirm in a few steps.
        </p>

        <form className="book-search-widget" onSubmit={onSubmit} noValidate>
          <div className="book-search-widget-inner">
            <div className="book-search-field book-search-field--grow">
              <span className="book-search-field-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </span>
              <div className="book-search-field-body">
                <label className="book-search-field-label" htmlFor="book-search-hotel">
                  Property
                </label>
                {!ready && <p className="book-search-field-placeholder">Loading hotels…</p>}
                {catalogError && (
                  <p className="book-search-field-error">
                    {catalogError}{" "}
                    <button type="button" className="book-search-retry" onClick={() => void load()}>
                      Retry
                    </button>
                  </p>
                )}
                {ready && hotels.length === 0 && !catalogError && (
                  <p className="book-search-field-placeholder">No hotels available right now.</p>
                )}
                {hasHotels && (
                  <select
                    id="book-search-hotel"
                    className="book-search-widget-select"
                    value={hotelId}
                    onChange={(e) => setHotelId(e.target.value)}
                    aria-invalid={!!formError && !hotelId}
                  >
                    <option value="">Where are you staying?</option>
                    {hotels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {optionLabel(h)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="book-search-field">
              <span className="book-search-field-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div className="book-search-field-body">
                <label className="book-search-field-label" htmlFor="book-search-checkin">
                  Check-in
                </label>
                <input
                  id="book-search-checkin"
                  type="date"
                  className="book-search-date"
                  min={minCheckIn}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
            </div>

            <div className="book-search-field">
              <span className="book-search-field-icon book-search-field-icon--muted" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div className="book-search-field-body">
                <label className="book-search-field-label" htmlFor="book-search-checkout">
                  Check-out
                </label>
                <input
                  id="book-search-checkout"
                  type="date"
                  className="book-search-date"
                  min={addDays(checkIn, 1)}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="book-search-field book-search-field--party">
              <span className="book-search-field-icon" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <div className="book-search-field-body">
                <span className="book-search-field-label">Guests</span>
                <div className="book-search-party">
                  <div className="book-search-party-row">
                    <span>Adults</span>
                    <div className="book-search-stepper">
                      <button type="button" className="book-search-stepper-btn" onClick={() => bumpAdults(-1)} aria-label="Fewer adults">
                        −
                      </button>
                      <span className="book-search-stepper-val">{adults}</span>
                      <button type="button" className="book-search-stepper-btn" onClick={() => bumpAdults(1)} aria-label="More adults">
                        +
                      </button>
                    </div>
                  </div>
                  <div className="book-search-party-row">
                    <span>Children</span>
                    <div className="book-search-stepper">
                      <button type="button" className="book-search-stepper-btn" onClick={() => bumpChildren(-1)} aria-label="Fewer children">
                        −
                      </button>
                      <span className="book-search-stepper-val">{children}</span>
                      <button type="button" className="book-search-stepper-btn" onClick={() => bumpChildren(1)} aria-label="More children">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="book-search-submit-wrap">
              <button type="submit" className="book-search-submit">
                Search
              </button>
            </div>
          </div>
          {formError && <p className="book-search-form-error">{formError}</p>}
        </form>
      </section>

      <section className="book-search-secondary panel" aria-label="More options">
        <div className="book-search-links">
          <Link className="book-search-link-secondary" href="/book/lookup">
            I have a confirmation code
          </Link>
          <span className="book-search-links-dot">·</span>
          <Link className="book-search-link-muted" href="/book/hotels">
            Browse all hotels
          </Link>
        </div>
      </section>
    </div>
  );
}
