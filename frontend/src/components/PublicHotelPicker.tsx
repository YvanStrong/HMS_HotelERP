"use client";

import { useEffect, useMemo, useState } from "react";
import { publicFetch } from "@/lib/publicApi";

export type PublicHotelCatalogRow = {
  id: string;
  name: string;
  code: string;
  currency: string;
  timezone?: string;
};

function optionLabel(h: PublicHotelCatalogRow): string {
  const bits = [h.name];
  if (h.code) bits.push(`(${h.code})`);
  bits.push(`· ${h.currency}`);
  return bits.join(" ");
}

type Props = {
  value: string;
  onChange: (hotelId: string) => void;
  /** Prefix for input ids when multiple pickers exist on one page */
  idPrefix?: string;
  /** Show one-line confirmation under the dropdown */
  showSelectionSummary?: boolean;
  /** If set and not in the catalog after load, selection is cleared */
  presetHotelId?: string;
  /** Fires once the public catalog request finishes (count may be 0; error set if load failed) */
  onCatalogSettled?: (summary: { hotelCount: number; loadError: string | null }) => void;
  /** HTML5 required on the drop-down (e.g. guest registration when the catalog loaded) */
  selectRequired?: boolean;
};

export function PublicHotelPicker({
  value,
  onChange,
  idPrefix = "hotel",
  showSelectionSummary = true,
  presetHotelId,
  onCatalogSettled,
  selectRequired = false,
}: Props) {
  const [hotels, setHotels] = useState<PublicHotelCatalogRow[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setCatalogError(null);
    setHotels(null);
    try {
      const list = await publicFetch<PublicHotelCatalogRow[]>("/api/v1/public/hotels");
      setHotels(list);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "Could not load hotels.");
      setHotels([]);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (hotels === null) return;
    onCatalogSettled?.({ hotelCount: hotels.length, loadError: catalogError });
  }, [hotels, catalogError, onCatalogSettled]);

  useEffect(() => {
    if (!hotels?.length || !presetHotelId) return;
    if (!hotels.some((h) => h.id === presetHotelId) && value === presetHotelId) {
      onChange("");
    }
  }, [hotels, presetHotelId, value, onChange]);

  const filtered = useMemo(() => {
    if (!hotels?.length) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return hotels;
    return hotels.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.code.toLowerCase().includes(q) ||
        h.currency.toLowerCase().includes(q) ||
        (h.timezone && h.timezone.toLowerCase().includes(q)),
    );
  }, [hotels, filter]);

  const selected = useMemo(() => hotels?.find((h) => h.id === value) ?? null, [hotels, value]);

  const selectOptions = useMemo(() => {
    if (!hotels?.length) return [];
    if (!value || filtered.some((h) => h.id === value)) {
      return filtered;
    }
    const cur = hotels.find((h) => h.id === value);
    return cur ? [cur, ...filtered] : filtered;
  }, [hotels, value, filtered]);

  const ready = hotels !== null;
  const hasList = ready && hotels.length > 0;

  return (
    <div className="book-register-hotel-block">
      {!ready && <p className="book-register-muted" style={{ marginTop: 0 }}>Loading properties…</p>}

      {catalogError && (
        <div className="error panel" style={{ marginBottom: "1rem" }}>
          <strong>Could not load hotels.</strong> {catalogError}
          <div style={{ marginTop: "0.75rem" }}>
            <button type="button" className="secondary" onClick={() => void load()}>
              Try again
            </button>
          </div>
        </div>
      )}

      {hasList && (
        <>
          <label htmlFor={`${idPrefix}-filter`}>Search (optional)</label>
          <input
            id={`${idPrefix}-filter`}
            type="search"
            placeholder="Narrow by name, code, or currency…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoComplete="off"
          />
          <p className="book-register-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
            Choose your hotel from the drop-down (opens when clicked).
          </p>
          <label htmlFor={`${idPrefix}-select`} style={{ marginTop: "0.75rem" }}>
            Property
          </label>
          <select
            id={`${idPrefix}-select`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={selectRequired}
            className="book-register-hotel-select"
          >
            <option value="">Choose a hotel…</option>
            {selectOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {optionLabel(h)}
              </option>
            ))}
          </select>
          {filtered.length === 0 && hotels.length > 0 && (
            <p className="book-register-muted" style={{ marginTop: "0.5rem" }}>
              No matches — clear the search box to see all hotels.
            </p>
          )}
          {showSelectionSummary && selected && (
            <p className="book-register-muted" style={{ marginTop: "0.65rem", fontSize: "0.82rem" }}>
              Selected: <strong>{selected.name}</strong>
              {selected.code ? ` (${selected.code})` : ""}.
            </p>
          )}
        </>
      )}

      {ready && hotels.length === 0 && !catalogError && (
        <p className="book-register-muted">No hotels are available in the public catalog.</p>
      )}
    </div>
  );
}
