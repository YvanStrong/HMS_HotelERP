"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { COUNTRY_OPTIONS, GENDER_OPTIONS } from "@/lib/guestFormConstants";
import { printReservationDocument } from "@/lib/printReservationDocument";
import { staffAppPath } from "@/lib/staffAppRoutes";

type GuestSearchHit = {
  guest: {
    id: string;
    full_name: string;
    national_id: string;
    date_of_birth: string;
    nationality: string | null;
    gender: string | null;
    email: string | null;
    phone: string | null;
    phone_country_code: string | null;
    id_type: string | null;
    id_document_type: string | null;
    id_document_number: string | null;
    id_expiry_date: string | null;
    vip_level: string | null;
    is_blacklisted: boolean;
    blacklist_reason: string | null;
    notes: string | null;
    marketing_consent: boolean;
  };
  address: {
    country: string | null;
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    street_number: string | null;
    address_notes: string | null;
  };
};

type AvailType = {
  room_type_id: string;
  name: string;
  base_price_per_night: number;
  total_price: number;
  currency: string;
  nights: number;
  available_count: number;
};

type AvailResponse = { available_room_types: AvailType[] };

type RoomListRow = {
  id: string;
  roomNumber: string;
  status: string;
  roomType: { id: string; name: string; code?: string };
};

type PagedRooms = { data: RoomListRow[] };

type CreateRes = {
  id: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  guest: { id: string; name: string; email: string | null };
  room: { id: string; roomNumber: string; floor: number | null };
  stay: { checkIn: string; checkOut: string; nights: number };
  message: string;
};

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function NewStaffReservationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const walkIn = searchParams.get("type") === "walkin";

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<GuestSearchHit[]>([]);
  const [guestId, setGuestId] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCc, setPhoneCc] = useState("+250");
  const [country, setCountry] = useState("Rwanda");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [sector, setSector] = useState("");
  const [cell, setCell] = useState("");
  const [village, setVillage] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [addressNotes, setAddressNotes] = useState("");
  const [nationality, setNationality] = useState("");
  const [gender, setGender] = useState("");
  const [idType, setIdType] = useState("NATIONAL_ID");
  const [idDocNumber, setIdDocNumber] = useState("");
  const [idExpiry, setIdExpiry] = useState("");
  const [vipLevel, setVipLevel] = useState("NONE");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [notes, setNotes] = useState("");

  const [checkIn, setCheckIn] = useState(localYmd());
  const [checkOut, setCheckOut] = useState(addDays(localYmd(), 1));
  const [adults, setAdults] = useState(2);
  const [avail, setAvail] = useState<AvailResponse | null>(null);
  const [roomTypeId, setRoomTypeId] = useState("");
  const [roomsOfType, setRoomsOfType] = useState<RoomListRow[]>([]);
  const [preferredRoomId, setPreferredRoomId] = useState<string>("");

  const [specialRequests, setSpecialRequests] = useState("");
  const [earlyCheckIn, setEarlyCheckIn] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<CreateRes | null>(null);
  const [hotelName, setHotelName] = useState("Hotel");

  const bookingSource = walkIn ? "WALK_IN" : "FRONT_DESK";

  const applyHit = useCallback((h: GuestSearchHit) => {
    const g = h.guest;
    const a = h.address;
    setGuestId(g.id);
    setFullName(g.full_name);
    setNationalId(g.national_id);
    setDob(g.date_of_birth);
    setEmail(g.email ?? "");
    setPhone(g.phone ?? "");
    setPhoneCc(g.phone_country_code ?? "+250");
    setCountry(a.country ?? "Rwanda");
    setProvince(a.province ?? "");
    setDistrict(a.district ?? "");
    setSector(a.sector ?? "");
    setCell(a.cell ?? "");
    setVillage(a.village ?? "");
    setStreetNumber(a.street_number ?? "");
    setAddressNotes(a.address_notes ?? "");
    setNationality(g.nationality ?? a.country ?? "");
    setGender(g.gender ?? "");
    setIdType(g.id_type ?? "NATIONAL_ID");
    setIdDocNumber(g.id_document_number ?? g.national_id);
    setIdExpiry(g.id_expiry_date ?? "");
    setVipLevel(g.vip_level ?? "NONE");
    setMarketingConsent(g.marketing_consent);
    setNotes(g.notes ?? "");
  }, []);

  async function runGuestSearch() {
    setError(null);
    setHits([]);
    if (!searchQ.trim()) return;
    try {
      const list = await apiFetch<GuestSearchHit[]>(
        `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(searchQ.trim())}`,
      );
      setHits(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    }
  }

  async function loadAvailability() {
    setError(null);
    setAvail(null);
    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    try {
      const p = new URLSearchParams({
        check_in: checkIn,
        check_out: checkOut,
        adults: String(adults),
      });
      const data = await apiFetch<AvailResponse>(`/api/v1/hotels/${hotelId}/rooms/availability?${p}`);
      setAvail(data);
      if (data.available_room_types.length && !roomTypeId) {
        setRoomTypeId(data.available_room_types[0].room_type_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Availability failed");
    }
  }

  useEffect(() => {
    if (step !== 2) return;
    void loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, hotelId]);

  useEffect(() => {
    if (step !== 3 || !roomTypeId) return;
    let c = false;
    (async () => {
      try {
        const res = await apiFetch<PagedRooms>(
          `/api/v1/hotels/${hotelId}/rooms?page=1&size=200&roomType=${encodeURIComponent(roomTypeId)}`,
        );
        if (!c) setRoomsOfType(res.data);
      } catch {
        if (!c) setRoomsOfType([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [step, hotelId, roomTypeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hotels = await apiFetch<{ id: string; name: string }[]>("/api/v1/public/hotels");
        const match = hotels.find((h) => h.id === hotelId);
        if (!cancelled && match?.name) {
          setHotelName(match.name);
        }
      } catch {
        // keep fallback title
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const selectedAvail = useMemo(
    () => avail?.available_room_types.find((x) => x.room_type_id === roomTypeId),
    [avail, roomTypeId],
  );

  function guestPayload() {
    const parts = fullName.trim().split(/\s+/, 2);
    return {
      firstName: parts[0] || "Guest",
      lastName: parts[1] || "Guest",
      fullName: fullName.trim(),
      national_id: nationalId.trim(),
      date_of_birth: dob,
      nationality: nationality.trim() || null,
      gender: gender.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      phone_country_code: phoneCc.trim() || null,
      country: country.trim() || "Rwanda",
      province: province.trim() || null,
      district: district.trim() || null,
      sector: sector.trim() || null,
      cell: cell.trim() || null,
      village: village.trim() || null,
      street_number: streetNumber.trim() || null,
      address_notes: addressNotes.trim() || null,
      id_type: idType,
      id_expiry_date: idExpiry || null,
      idDocument: {
        type: idType,
        number: (idDocNumber.trim() || nationalId.trim()) || null,
      },
      vip_level: vipLevel,
      marketing_consent: marketingConsent,
      notes: notes.trim() || null,
      is_blacklisted: false,
      blacklist_reason: null,
    };
  }

  async function ensureGuest(): Promise<string> {
    if (guestId) return guestId;
    if (!nationalId.trim() || !dob) throw new Error("National ID and date of birth are required.");
    const created = await apiFetch<GuestSearchHit>(`/api/v1/hotels/${hotelId}/guests`, {
      method: "POST",
      body: JSON.stringify(guestPayload()),
    });
    setGuestId(created.guest.id);
    return created.guest.id;
  }

  async function confirmBooking() {
    setError(null);
    setSubmitting(true);
    setDone(null);
    try {
      if (!getToken()) throw new Error("Not signed in.");
      const gid = await ensureGuest();
      const dep = deposit.trim() ? Number(deposit) : 0;
      const body = {
        guestId: gid,
        guest: null,
        roomTypeId,
        roomTypeCode: null,
        preferredRoomId: preferredRoomId || null,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults,
        children: 0,
        specialRequests: [specialRequests.trim(), earlyCheckIn ? "Early check-in requested" : ""]
          .filter(Boolean)
          .join(" · ") || null,
        source: bookingSource,
        ratePlan: {
          nightlyRate: selectedAvail ? selectedAvail.total_price / Math.max(1, selectedAvail.nights) : null,
          includesBreakfast: false,
          cancellationPolicy: null,
        },
        payment:
          dep > 0
            ? {
                depositRequired: true,
                depositAmount: dep,
                paymentMethod,
              }
            : null,
      };
      const res = await apiFetch<CreateRes>(`/api/v1/hotels/${hotelId}/reservations`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDone(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  const todayYmd = localYmd();
  const showCheckInNow = done && done.stay.checkIn === todayYmd && done.status === "CONFIRMED";

  function printOrDownloadConfirmation() {
    if (!done) return;
    const roomTypeLabel = selectedAvail?.name ?? "—";
    const nightlyAvg =
      selectedAvail != null
        ? `${(selectedAvail.total_price / Math.max(1, selectedAvail.nights)).toFixed(2)} ${selectedAvail.currency}`
        : "—";
    const stayTotal =
      selectedAvail != null ? `${selectedAvail.total_price} ${selectedAvail.currency}` : "—";
    printReservationDocument({
      variant: "staff",
      hotelName,
      sourceLabel: bookingSource,
      guest: {
        name: done.guest.name,
        email: done.guest.email,
        phone: phone || null,
        phoneCc: phoneCc || null,
        nationalId: nationalId || null,
        dob: dob || null,
        nationality: nationality || null,
        gender: gender || null,
        country,
        province,
        district,
        sector,
        cell,
        village,
        streetNumber,
        addressNotes,
        idType,
        idNumber: idDocNumber || nationalId,
        idExpiry: idExpiry || null,
        vipLevel,
        marketingConsent,
        notes,
      },
      stay: {
        reservationId: done.id,
        confirmationCode: done.confirmationCode,
        bookingReference: done.booking_reference ?? done.confirmationCode,
        status: done.status,
        roomTypeName: roomTypeLabel,
        roomNumber: done.room.roomNumber,
        checkIn: done.stay.checkIn,
        checkOut: done.stay.checkOut,
        nights: done.stay.nights,
        adults,
        children: 0,
        specialRequests: specialRequests || null,
        message: done.message,
        pricingLines: [
          { label: "Nightly avg", value: nightlyAvg },
          { label: "Stay total", value: stayTotal },
        ],
      },
      staffExtras: {
        earlyCheckIn,
        preferredRoomLabel: preferredRoomId || "Auto-assign",
        depositLabel: deposit.trim() ? `${deposit} ${selectedAvail?.currency ?? "RWF"}` : "0",
        paymentMethodLabel: deposit.trim() ? paymentMethod : "N/A",
      },
    });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <p>
        <Link href={staffAppPath("reservations")} className="text-primary">
          ← Reservations
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight">New reservation</h1>
      <p className="text-muted-foreground text-sm">
        {walkIn ? "Walk-in / counter booking" : "Staff booking"} — complete each step, then confirm.
      </p>
      {error && <div className="error">{error}</div>}

      {done ? (
        <div className="bg-card rounded-xl border border-border/60 p-6 shadow-soft space-y-3">
          <h2 className="text-lg font-semibold">Confirmed</h2>
          <p>
            Booking reference:{" "}
            <code className="text-base font-mono bg-muted px-2 py-1 rounded">{done.booking_reference}</code>
          </p>
          <p className="text-sm text-muted-foreground">{done.message}</p>
          <p>
            Guest <strong>{done.guest.name}</strong> · Room <strong>{done.room.roomNumber}</strong>
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href={staffAppPath("reservations", done.id)} className="hms-btn-solid">
              Open reservation
            </Link>
            <button type="button" className="hms-btn-outline" onClick={printOrDownloadConfirmation}>
              Print / Download
            </button>
            {showCheckInNow && (
              <Link href={staffAppPath("reservations", done.id)} className="hms-btn-outline">
                Check in now
              </Link>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 text-sm">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`px-2 py-1 rounded ${step === s ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {s}. {s === 1 ? "Guest" : s === 2 ? "Stay" : s === 3 ? "Room" : "Confirm"}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-4">
              <h2 className="text-lg font-semibold">Guest</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 min-w-[12rem]"
                  placeholder="Search name or national ID"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                <button type="button" className="hms-btn-outline" onClick={() => void runGuestSearch()}>
                  Search
                </button>
              </div>
              {hits.length > 0 && (
                <ul className="space-y-2 border rounded-lg p-3 bg-muted/30">
                  {hits.map((h) => (
                    <li key={h.guest.id}>
                      <button
                        type="button"
                        className="text-left w-full hover:bg-muted/80 rounded px-2 py-1"
                        onClick={() => applyHit(h)}
                      >
                        <strong>{h.guest.full_name}</strong> · {h.guest.national_id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  Full name *
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </label>
                <label>
                  National ID *
                  <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
                </label>
                <label>
                  Date of birth *
                  <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
                </label>
                <label>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                  Phone
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label>
                  Phone country code
                  <input value={phoneCc} onChange={(e) => setPhoneCc(e.target.value)} />
                </label>
                <label>
                  Nationality
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} />
                </label>
                <label>
                  Gender
                  <select value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select gender</option>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g.replaceAll("_", " ")}
                      </option>
                    ))}
                    {gender && !GENDER_OPTIONS.includes(gender as (typeof GENDER_OPTIONS)[number]) && (
                      <option value={gender}>{gender}</option>
                    )}
                  </select>
                </label>
                <label>
                  Country *
                  <select
                    value={country}
                    onChange={(e) => {
                      const selectedCountry = e.target.value;
                      setCountry(selectedCountry);
                      setNationality(selectedCountry);
                    }}
                    required
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!COUNTRY_OPTIONS.includes(country as (typeof COUNTRY_OPTIONS)[number]) && (
                      <option value={country}>{country}</option>
                    )}
                  </select>
                </label>
                <label>
                  Province
                  <input value={province} onChange={(e) => setProvince(e.target.value)} />
                </label>
                <label>
                  District
                  <input value={district} onChange={(e) => setDistrict(e.target.value)} />
                </label>
                <label>
                  Sector
                  <input value={sector} onChange={(e) => setSector(e.target.value)} />
                </label>
                <label>
                  Cell
                  <input value={cell} onChange={(e) => setCell(e.target.value)} />
                </label>
                <label>
                  Village
                  <input value={village} onChange={(e) => setVillage(e.target.value)} />
                </label>
                <label>
                  Street number
                  <input value={streetNumber} onChange={(e) => setStreetNumber(e.target.value)} />
                </label>
                <label className="sm:col-span-2">
                  Address notes
                  <textarea value={addressNotes} onChange={(e) => setAddressNotes(e.target.value)} rows={2} />
                </label>
                <label>
                  ID type
                  <select value={idType} onChange={(e) => setIdType(e.target.value)}>
                    <option value="NATIONAL_ID">National ID</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="REFUGEE_ID">Refugee ID</option>
                    <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
                  </select>
                </label>
                <label>
                  ID document number
                  <input value={idDocNumber} onChange={(e) => setIdDocNumber(e.target.value)} />
                </label>
                <label>
                  ID expiry
                  <input type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} />
                </label>
                <label>
                  VIP level
                  <select value={vipLevel} onChange={(e) => setVipLevel(e.target.value)}>
                    <option value="NONE">None</option>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                  />
                  Marketing consent
                </label>
                <label className="sm:col-span-2">
                  Notes
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </label>
              </div>
              <button type="button" className="hms-btn-solid" onClick={() => setStep(2)}>
                Continue to dates
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-4">
              <h2 className="text-lg font-semibold">Stay</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                <label>
                  Check-in
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
                </label>
                <label>
                  Check-out
                  <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
                </label>
                <label>
                  Adults
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value) || 1)}
                  />
                </label>
              </div>
              <button type="button" className="hms-btn-outline" onClick={() => void loadAvailability()}>
                Refresh availability
              </button>
              {avail && (
                <div>
                  <p className="text-sm font-medium mb-2">Available room types</p>
                  <select
                    value={roomTypeId}
                    onChange={(e) => setRoomTypeId(e.target.value)}
                    className="w-full"
                    disabled={avail.available_room_types.length === 0}
                  >
                    <option value="">Select available room type...</option>
                    {avail.available_room_types.map((t) => (
                      <option key={t.room_type_id} value={t.room_type_id}>
                        {t.name} — {t.available_count} free · {t.total_price} {t.currency} total ({t.nights} nights)
                      </option>
                    ))}
                  </select>
                  {avail.available_room_types.length === 0 && (
                    <p className="text-muted-foreground text-sm">No inventory for these dates.</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  className="hms-btn-solid"
                  disabled={!roomTypeId}
                  onClick={() => setStep(3)}
                >
                  Pick room
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-4">
              <h2 className="text-lg font-semibold">Room &amp; extras</h2>
              {selectedAvail && (
                <p className="text-sm">
                  Nightly (avg):{" "}
                  <strong>
                    {(selectedAvail.total_price / Math.max(1, selectedAvail.nights)).toFixed(2)}{" "}
                    {selectedAvail.currency}
                  </strong>{" "}
                  · Stay total <strong>{selectedAvail.total_price}</strong> {selectedAvail.currency}
                </p>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={earlyCheckIn}
                  onChange={(e) => setEarlyCheckIn(e.target.checked)}
                  disabled={checkIn !== todayYmd}
                />
                Early check-in (only if check-in is today)
              </label>
              <label>
                Special requests
                <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} />
              </label>
              <label>
                Room (optional — leave blank to auto-assign)
                <select
                  value={preferredRoomId}
                  onChange={(e) => setPreferredRoomId(e.target.value)}
                >
                  <option value="">Auto-assign</option>
                  {roomsOfType.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} ({r.status})
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="button" className="hms-btn-solid" onClick={() => setStep(4)}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-card rounded-xl border border-border/60 p-5 shadow-soft space-y-4">
              <h2 className="text-lg font-semibold">Payment &amp; confirm</h2>
              <label>
                Deposit amount ({selectedAvail?.currency ?? "RWF"})
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={deposit}
                  onChange={(e) => setDeposit(e.target.value)}
                />
              </label>
              <label>
                Payment method (if deposit &gt; 0)
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="MOBILE_MONEY">MOBILE_MONEY</option>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(3)}>
                  Back
                </button>
                <button
                  type="button"
                  className="hms-btn-solid"
                  disabled={submitting || !roomTypeId}
                  onClick={() => void confirmBooking()}
                >
                  {submitting ? "Saving…" : "Confirm reservation"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
