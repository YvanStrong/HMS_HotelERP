"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/api";
import { isGuestPortalUser, loadAuthUser } from "@/lib/auth";
import { publicBook, publicFetch } from "@/lib/publicApi";

type RoomTypeRow = {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  baseRate: number;
  maxOccupancy?: number;
  bedCount?: number;
  amenities?: string[];
};

type RoomOfferRow = {
  roomId: string;
  roomNumber: string;
  floor: number | null;
  roomTypeId: string;
  roomTypeName: string;
  indicativeNightlyFrom: number;
  includedFeatures: string[];
};

type AvailabilityResponse = {
  available: boolean;
  availableRooms: { roomId: string; roomNumber: string; floor: number | null; rate: number }[];
  alternativeDates: { checkIn: string; available: boolean }[];
  pricing: { baseRate: number; taxes: number; fees: number; totalPerNight: number };
  availabilityHint?: string | null;
};

type CreateReservationResponse = {
  id: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  guest: { id: string; name: string; email: string };
  room: { id: string; roomNumber: string; floor: number | null };
  stay: { checkIn: string; checkOut: string; nights: number };
  pricing: {
    nightlyRate: number;
    roomSubtotal: number;
    estimatedTaxes: number;
    estimatedFees: number;
    depositPaid: number;
    balanceDue: number;
  };
  message: string;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse stay query from `/book` search widget; returns null if invalid or incomplete. */
function parseStayQuery(searchParams: URLSearchParams): {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
} | null {
  const ci = searchParams.get("checkIn");
  const co = searchParams.get("checkOut");
  if (!ci || !co || !ISO_DATE.test(ci) || !ISO_DATE.test(co)) {
    return null;
  }
  if (co <= ci) {
    return null;
  }
  let adults = 2;
  let children = 0;
  const adRaw = searchParams.get("adults");
  const chRaw = searchParams.get("children");
  if (adRaw != null) {
    const n = parseInt(adRaw, 10);
    if (Number.isFinite(n)) {
      adults = Math.min(20, Math.max(1, n));
    }
  }
  if (chRaw != null) {
    const n = parseInt(chRaw, 10);
    if (Number.isFinite(n)) {
      children = Math.min(20, Math.max(0, n));
    }
  }
  return { checkIn: ci, checkOut: co, adults, children };
}

function BookHotelStayPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const [types, setTypes] = useState<RoomTypeRow[]>([]);
  const [offers, setOffers] = useState<RoomOfferRow[]>([]);
  const [hotelName, setHotelName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState<string | null>(null);
  const [roomTypeId, setRoomTypeId] = useState<string>("");
  const [checkIn, setCheckIn] = useState(todayISODate());
  const [checkOut, setCheckOut] = useState(addDays(todayISODate(), 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [avail, setAvail] = useState<AvailabilityResponse | null>(null);
  const [availLoading, setAvailLoading] = useState(false);
  const [availErr, setAvailErr] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [dob, setDob] = useState("");
  const [guestCountry, setGuestCountry] = useState("Rwanda");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [sector, setSector] = useState("");
  const [cell, setCell] = useState("");
  const [village, setVillage] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [nationality, setNationality] = useState("");
  const [gender, setGender] = useState("");
  const [phoneCc, setPhoneCc] = useState("+250");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [special, setSpecial] = useState("");
  const [bookMsg, setBookMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<CreateReservationResponse | null>(null);
  const [portalSameHotel, setPortalSameHotel] = useState(false);

  useEffect(() => {
    const u = loadAuthUser();
    setPortalSameHotel(Boolean(u && isGuestPortalUser(u) && u.hotelId === hotelId));
    if (u && isGuestPortalUser(u) && u.hotelId === hotelId && u.email) {
      setEmail(u.email);
    }
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const hotels = await publicFetch<{ id: string; name: string; currency: string }[]>("/api/v1/public/hotels");
        const me = hotels.find((h) => h.id === hotelId);
        if (!cancelled && me) {
          setHotelName(me.name);
          setCurrency(me.currency ?? "USD");
        }
        const [rt, off] = await Promise.all([
          publicFetch<RoomTypeRow[]>(`/api/v1/public/hotels/${hotelId}/room-types`),
          publicFetch<RoomOfferRow[]>(`/api/v1/public/hotels/${hotelId}/rooms/offers`),
        ]);
        if (!cancelled) {
          setTypes(rt);
          setOffers(off);
          setRoomTypeId((prev) => prev || rt[0]?.id || "");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load hotel");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const stayQueryKey = searchParams.toString();

  useEffect(() => {
    const parsed = parseStayQuery(searchParams);
    if (!parsed) {
      return;
    }
    setCheckIn(parsed.checkIn);
    setCheckOut(parsed.checkOut);
    setAdults(parsed.adults);
    setChildren(parsed.children);
  }, [hotelId, stayQueryKey, searchParams]);

  const searchUrl = useMemo(() => {
    const q = new URLSearchParams({
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(children),
    });
    if (roomTypeId) q.set("roomTypeId", roomTypeId);
    return `/api/v1/hotels/${hotelId}/reservations/availability?${q.toString()}`;
  }, [hotelId, checkIn, checkOut, adults, children, roomTypeId]);

  const refreshAvailability = useCallback(async () => {
    setAvailErr(null);
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setAvail(null);
      setAvailErr("Check-out must be after check-in.");
      return;
    }
    setAvailLoading(true);
    try {
      const data = await publicFetch<AvailabilityResponse>(searchUrl);
      setAvail(data);
    } catch (err) {
      setAvail(null);
      setAvailErr(err instanceof Error ? err.message : "Availability failed");
    } finally {
      setAvailLoading(false);
    }
  }, [searchUrl, checkIn, checkOut]);

  useEffect(() => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    const tm = setTimeout(() => {
      void refreshAvailability();
    }, 480);
    return () => clearTimeout(tm);
  }, [checkIn, checkOut, adults, children, roomTypeId, hotelId, refreshAvailability]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setBookMsg(null);
    setConfirmed(null);
    setError(null);
    await refreshAvailability();
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookMsg(null);
    if (!roomTypeId) {
      setBookMsg("Select a room type.");
      return;
    }
    if (!nationalId.trim() || !dob) {
      setBookMsg("National ID and date of birth are required.");
      return;
    }
    if (!province.trim() || !district.trim() || !sector.trim() || !cell.trim() || !village.trim()) {
      setBookMsg("Please complete province, district, sector, cell, and village.");
      return;
    }
    try {
      const token = portalSameHotel ? getToken() : null;
      const fn = firstName.trim();
      const ln = lastName.trim();
      const body = {
        guestId: null,
        guest: {
          firstName: fn || "Guest",
          lastName: ln || "Guest",
          fullName: `${fn} ${ln}`.trim() || "Guest Guest",
          email: email.trim() || null,
          phone: phone.trim() || null,
          phone_country_code: phoneCc.trim() || null,
          national_id: nationalId.trim(),
          date_of_birth: dob,
          nationality: nationality.trim() || null,
          gender: gender.trim() || null,
          country: guestCountry.trim() || "Rwanda",
          province: province.trim(),
          district: district.trim(),
          sector: sector.trim(),
          cell: cell.trim(),
          village: village.trim(),
          street_number: streetNumber.trim() || null,
          address_notes: addressNotes.trim() || null,
          id_type: "NATIONAL_ID",
          id_expiry_date: null,
          idDocument: { type: "NATIONAL_ID", number: nationalId.trim() },
          vip_level: "NONE",
          marketing_consent: marketingConsent,
          notes: null,
          is_blacklisted: false,
          blacklist_reason: null,
        },
        roomTypeId,
        roomTypeCode: null,
        preferredRoomId: null,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults,
        children,
        specialRequests: special.trim() || null,
        source: "web",
        ratePlan: { nightlyRate: null, includesBreakfast: false, cancellationPolicy: null },
        payment: null,
      };
      const res = await publicBook<CreateReservationResponse>(hotelId, body, token);
      setConfirmed(res);
      setBookMsg(res.message);
    } catch (err) {
      setBookMsg(err instanceof Error ? err.message : "Booking failed");
    }
  }

  const offersForSelectedType = offers.filter((o) => o.roomTypeId === roomTypeId);

  return (
    <div className="container-page py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-6">
        <Link href="/book" className="text-muted-foreground hover:text-primary flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Search
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <Link href="/book/hotels" className="text-muted-foreground hover:text-primary">Hotels</Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium">Book</span>
      </nav>

      {/* Hotel Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-2xl p-6 mb-8 border border-border/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{hotelName || "Hotel"}</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Prices in {currency}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!portalSameHotel && (
              <Link 
                href={`/book/register?hotelId=${encodeURIComponent(hotelId)}`}
                className="hms-btn-outline text-sm"
              >
                Create Account
              </Link>
            )}
          </div>
        </div>

        {portalSameHotel && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mt-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm text-foreground">
                You are signed in as a guest for this property. This booking will be linked to your account.
                Use the <strong>same email</strong> as your profile ({email || "see field below"}).
              </p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Select Room Type
        </h2>
        <div className="grid gap-4">
          {types.map((t) => (
            <label
              key={t.id}
              className={`relative flex gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all hover:shadow-soft ${
                roomTypeId === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 bg-card hover:border-primary/30"
              }`}
            >
              <input
                type="radio"
                name="rt"
                checked={roomTypeId === t.id}
                onChange={() => setRoomTypeId(t.id)}
                className="mt-1 w-4 h-4 accent-primary"
              />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold text-foreground text-lg">{t.name}</span>
                  {t.code && <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.code}</code>}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <strong className="text-foreground">{t.baseRate}</strong> / night
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Up to {t.maxOccupancy ?? "—"} guests
                  </span>
                  {t.bedCount != null && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      {t.bedCount} beds
                    </span>
                  )}
                </div>
                
                {t.description && (
                  <p className="text-sm text-muted-foreground mt-2">{t.description}</p>
                )}
                
                {t.amenities && t.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {t.amenities.map((a) => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs text-muted-foreground">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {offersForSelectedType.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft mt-4">
          <h2 className="text-lg font-semibold mb-2">Assignable rooms (sample)</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Public snapshot of inventory that can be assigned for stays like yours. Final room is chosen when you book.
          </p>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offersForSelectedType.slice(0, 8).map((o) => (
              <li key={o.roomId} className="p-3 bg-muted/50 rounded-lg text-sm">
                <strong className="text-foreground">#{o.roomNumber}</strong>
                {o.floor != null && <span className="text-muted-foreground ml-1">· floor {o.floor}</span>}
                <span className="text-muted-foreground"> — from {o.indicativeNightlyFrom} / night</span>
                {o.includedFeatures?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{o.includedFeatures.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft mt-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Dates & Guests
        </h2>
        <form noValidate onSubmit={runSearch} className="grid sm:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label>Check-in</label>
            <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label>Check-out</label>
            <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </div>
          <div>
            <label>Adults</label>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={adults}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setAdults(Number.isFinite(n) ? Math.max(1, n) : 1);
              }}
            />
          </div>
          <div>
            <label>Children</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={children}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setChildren(Number.isFinite(n) ? Math.max(0, n) : 0);
              }}
            />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button 
              type="submit" 
              disabled={availLoading}
              className="hms-btn-solid w-full"
            >
              {availLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Checking...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Check Availability
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {availErr && <div className="error panel mt-4">{availErr}</div>}

      {avail && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft mt-4">
          <h2 className="text-lg font-semibold mb-3">Results</h2>
          <p className="mb-2">
            {avail.available ? (
              <span className="badge badge-success">Rooms available</span>
            ) : (
              <span className="badge badge-destructive">No assignable room for these dates.</span>
            )}
          </p>
          {avail.availabilityHint && (
            <p className="text-sm text-foreground">{avail.availabilityHint}</p>
          )}
          <p className="text-muted-foreground text-sm">
            From <strong>{avail.pricing.baseRate}</strong> / night + taxes &amp; fees (estimate{" "}
            <strong>{avail.pricing.totalPerNight}</strong> / night incl.).
          </p>
          {avail.availableRooms.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Sample rooms:{" "}
              {avail.availableRooms.slice(0, 5).map((r) => (
                <span key={r.roomId} className="font-medium ml-1">#{r.roomNumber}</span>
              ))}
            </p>
          )}
          {!avail.available && avail.alternativeDates.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm font-medium text-amber-900 mb-2">Alternative check-in dates:</p>
              <ul className="text-sm space-y-1">
                {avail.alternativeDates.map((a) => (
                  <li key={a.checkIn} className="flex items-center gap-2">
                    <span className="font-medium">{a.checkIn}:</span>
                    {a.available ? (
                      <span className="text-green-600 font-medium">rooms likely free</span>
                    ) : (
                      <span className="text-muted-foreground">still tight</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {avail?.available && (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft mt-4">
          <h2 className="text-lg font-semibold mb-4">Guest details &amp; confirm</h2>
          <form onSubmit={submitBooking} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label>First name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label>Last name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!portalSameHotel} />
              {portalSameHotel && (
                <p className="text-xs text-muted-foreground mt-1">
                  Optional when signed in; if provided it must match your guest profile.
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label>Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label>Phone country code</label>
              <input value={phoneCc} onChange={(e) => setPhoneCc(e.target.value)} />
            </div>
            <div>
              <label>National ID *</label>
              <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
            </div>
            <div>
              <label>Date of birth *</label>
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </div>
            <div>
              <label>Nationality</label>
              <input value={nationality} onChange={(e) => setNationality(e.target.value)} />
            </div>
            <div>
              <label>Gender</label>
              <input value={gender} onChange={(e) => setGender(e.target.value)} />
            </div>
            <div>
              <label>Country *</label>
              <input value={guestCountry} onChange={(e) => setGuestCountry(e.target.value)} required />
            </div>
            <div>
              <label>Province *</label>
              <input value={province} onChange={(e) => setProvince(e.target.value)} required />
            </div>
            <div>
              <label>District *</label>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} required />
            </div>
            <div>
              <label>Sector *</label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} required />
            </div>
            <div>
              <label>Cell *</label>
              <input value={cell} onChange={(e) => setCell(e.target.value)} required />
            </div>
            <div>
              <label>Village *</label>
              <input value={village} onChange={(e) => setVillage(e.target.value)} required />
            </div>
            <div>
              <label>Street number</label>
              <input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label>Address notes</label>
              <textarea value={addressNotes} onChange={(e) => setAddressNotes(e.target.value)} rows={2} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(e) => setMarketingConsent(e.target.checked)}
              />
              I agree to receive marketing communications (optional)
            </label>
            <div className="sm:col-span-2">
              <label>Special requests</label>
              <textarea
                value={special}
                onChange={(e) => setSpecial(e.target.value)}
                rows={3}
                className="w-full"
              />
            </div>
            <div className="sm:col-span-2 mt-4">
              <button type="submit" className="hms-btn-solid w-full sm:w-auto">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Confirm Booking
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {bookMsg && !confirmed && <div className="panel mt-4">{bookMsg}</div>}

      {confirmed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-green-900">You are booked</h2>
          </div>
          <p className="text-foreground">
            Booking reference:{" "}
            <strong className="font-mono">{confirmed.booking_reference ?? confirmed.confirmationCode}</strong>
          </p>
          <p className="text-muted-foreground text-sm">
            Confirmation code: <span className="font-mono">{confirmed.confirmationCode}</span>
          </p>
          <p className="text-muted-foreground text-sm mt-1">
            Room {confirmed.room.roomNumber} · {confirmed.stay.nights} nights · Balance due{" "}
            <strong>{confirmed.pricing.balanceDue} {currency}</strong>
          </p>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <Link href={`/book/lookup?hotelId=${hotelId}`} className="font-medium">Find reservation</Link>
            {portalSameHotel && (
              <>
                <span className="text-muted-foreground">·</span>
                <Link href="/book/me" className="font-medium">My trips</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookHotelStayPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded-lg" />
            <div className="h-48 bg-muted rounded-xl" />
            <div className="h-32 bg-muted rounded-xl" />
          </div>
        </div>
      }
    >
      <BookHotelStayPageInner />
    </Suspense>
  );
}
