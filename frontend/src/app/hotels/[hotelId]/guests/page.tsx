"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { apiFetch, getToken } from "@/lib/api";

type GuestProfile = {
  id: string;
  name: string;
  email: string;
  loyalty?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  stayHistory?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  flags?: Record<string, unknown>;
};

type ReservationRow = {
  guestId: string;
  guestName: string;
  guestEmail: string;
  confirmationCode: string;
  checkInDate: string;
  checkOutDate: string;
};

function stayRangeParams(): string {
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const p = new URLSearchParams();
  p.set("stayStart", start.toISOString().slice(0, 10));
  p.set("stayEnd", end.toISOString().slice(0, 10));
  return p.toString();
}

export default function GuestsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [guestId, setGuestId] = useState("");
  const [manualGuestId, setManualGuestId] = useState("");
  const [guestFilter, setGuestFilter] = useState("");
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [resErr, setResErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReservations = useCallback(async () => {
    setResErr(null);
    if (!getToken()) {
      setResErr("Not signed in.");
      return;
    }
    try {
      const rows = await apiFetch<ReservationRow[]>(
        `/api/v1/hotels/${hotelId}/reservations?${stayRangeParams()}`,
      );
      setReservations(rows);
    } catch (e) {
      setReservations([]);
      setResErr(e instanceof Error ? e.message : "Could not load reservations");
    }
  }, [hotelId]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  const guestChoices = useMemo(() => {
    const map = new Map<string, ReservationRow>();
    for (const r of reservations) {
      if (!r.guestId) continue;
      if (!map.has(r.guestId)) map.set(r.guestId, r);
    }
    return Array.from(map.values()).sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [reservations]);

  const filteredGuests = useMemo(() => {
    const q = guestFilter.trim().toLowerCase();
    if (!q) return guestChoices;
    return guestChoices.filter(
      (g) =>
        g.guestName.toLowerCase().includes(q) ||
        g.guestEmail.toLowerCase().includes(q) ||
        g.confirmationCode.toLowerCase().includes(q),
    );
  }, [guestChoices, guestFilter]);

  const selectGuestOptions = useMemo(() => {
    if (!guestId || filteredGuests.some((g) => g.guestId === guestId)) {
      return filteredGuests;
    }
    const cur = guestChoices.find((g) => g.guestId === guestId);
    return cur ? [cur, ...filteredGuests] : filteredGuests;
  }, [guestChoices, guestId, filteredGuests]);

  async function loadProfile() {
    setError(null);
    setProfile(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    const id = manualGuestId.trim() || guestId.trim();
    if (!id) {
      setError("Choose a guest from the list, or paste an id in “Guest not on the list”.");
      return;
    }
    try {
      const json = await apiFetch<GuestProfile>(`/api/v1/hotels/${hotelId}/guests/${id}/profile`);
      setProfile(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <h1>Guests</h1>
      <p style={{ color: "var(--muted)", maxWidth: "40rem", lineHeight: 1.55 }}>
        Pick someone who has a reservation in the last year (name and email), then load their profile. For guests not
        on the list, use the advanced section.
      </p>
      {resErr && <div className="error panel">{resErr}</div>}
      <div className="panel book-register-form" style={{ maxWidth: 560 }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Find guest</h2>
        <label htmlFor="guest-filter">Search (optional)</label>
        <input
          id="guest-filter"
          type="search"
          placeholder="Name, email, or confirmation code…"
          value={guestFilter}
          onChange={(e) => setGuestFilter(e.target.value)}
          autoComplete="off"
        />
        <label htmlFor="guest-select" style={{ marginTop: "0.75rem" }}>
          Guest
        </label>
        <select
          id="guest-select"
          value={guestId}
          onChange={(e) => {
            setGuestId(e.target.value);
            setManualGuestId("");
          }}
          className="book-register-hotel-select"
        >
          <option value="">Choose a guest…</option>
          {selectGuestOptions.map((g) => (
            <option key={g.guestId} value={g.guestId}>
              {g.guestName} · {g.guestEmail} · {g.confirmationCode}
            </option>
          ))}
        </select>
        {guestChoices.length === 0 && !resErr && (
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.5rem" }}>
            No reservations in range — add stays or use advanced.
          </p>
        )}
        {filteredGuests.length === 0 && guestChoices.length > 0 && (
          <p style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: "0.5rem" }}>
            No matches — clear search to see all guests from reservations.
          </p>
        )}
        <div style={{ marginTop: "0.85rem" }}>
          <button type="button" onClick={loadProfile}>
            Load profile
          </button>
        </div>
        <details className="book-register-advanced" style={{ marginTop: "1rem" }}>
          <summary>Guest not on the list?</summary>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Paste the guest id from the API, PMS export, or a deep link if staff gave you one.
          </p>
          <label htmlFor="guest-manual-id">Guest id</label>
          <input
            id="guest-manual-id"
            value={manualGuestId}
            onChange={(e) => setManualGuestId(e.target.value)}
            placeholder="uuid"
            autoComplete="off"
            spellCheck={false}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.88rem" }}
          />
          <div style={{ marginTop: "0.65rem" }}>
            <button type="button" onClick={loadProfile}>
              Load profile
            </button>
          </div>
        </details>
      </div>
      {error && <div className="error panel">{error}</div>}
      {profile != null && (
        <>
          <div className="panel">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>{profile.name}</h2>
            <p style={{ margin: "0.25rem 0", color: "var(--muted)" }}>{profile.email}</p>
            <p style={{ fontSize: "0.8rem", margin: 0 }}>
              <code>{profile.id}</code>
            </p>
          </div>
          <KeyValueTable title="Loyalty" rows={recordToRows(profile.loyalty)} />
          <KeyValueTable title="Preferences" rows={recordToRows(profile.preferences)} />
          <KeyValueTable title="Stay history" rows={recordToRows(profile.stayHistory)} />
          <KeyValueTable title="Communication" rows={recordToRows(profile.communication)} />
          <KeyValueTable title="Flags" rows={recordToRows(profile.flags)} />
        </>
      )}
    </>
  );
}
