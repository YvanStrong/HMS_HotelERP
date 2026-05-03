"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import { apiFetch, getToken } from "@/lib/api";
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

const GENDER_OPTIONS = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"] as const;

const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_OPTIONS = getCountries()
  .map((iso2) => ({
    iso2,
    name: REGION_NAMES.of(iso2) ?? iso2,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const PHONE_CODE_OPTIONS = getCountries()
  .map((iso2) => {
    const name = REGION_NAMES.of(iso2) ?? iso2;
    const code = `+${getCountryCallingCode(iso2)}`;
    return {
      iso2,
      code,
      label: `${name} (${code})`,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

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
  const [searchingGuests, setSearchingGuests] = useState(false);
  const [guestId, setGuestId] = useState<string | null>(null);
  const guestSearchReqRef = useRef(0);

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
  const [roomSnapshot, setRoomSnapshot] = useState<RoomListRow[]>([]);
  const [roomSnapshotLoading, setRoomSnapshotLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
  const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);

  const bookingSource = walkIn ? "WALK_IN" : "FRONT_DESK";
  const draftKey = `hms:new-reservation:draft:${hotelId}:${walkIn ? "walkin" : "staff"}`;

  const markGuestEdited = useCallback(() => {
    if (guestId) {
      setGuestId(null);
    }
  }, [guestId]);

  const saveDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    const draft = {
      savedAt: new Date().toISOString(),
      step,
      searchQ,
      guestId,
      fullName,
      nationalId,
      dob,
      email,
      phone,
      phoneCc,
      country,
      province,
      district,
      sector,
      cell,
      village,
      streetNumber,
      addressNotes,
      nationality,
      gender,
      idType,
      idDocNumber,
      idExpiry,
      vipLevel,
      marketingConsent,
      notes,
      checkIn,
      checkOut,
      adults,
      roomTypeId,
      preferredRoomId,
      specialRequests,
      earlyCheckIn,
      deposit,
      paymentMethod,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [
    step,
    searchQ,
    guestId,
    fullName,
    nationalId,
    dob,
    email,
    phone,
    phoneCc,
    country,
    province,
    district,
    sector,
    cell,
    village,
    streetNumber,
    addressNotes,
    nationality,
    gender,
    idType,
    idDocNumber,
    idExpiry,
    vipLevel,
    marketingConsent,
    notes,
    checkIn,
    checkOut,
    adults,
    roomTypeId,
    preferredRoomId,
    specialRequests,
    earlyCheckIn,
    deposit,
    paymentMethod,
    draftKey,
  ]);

  const saveAndContinue = useCallback(
    (nextStep: number) => {
      saveDraft();
      setStep(nextStep);
    },
    [saveDraft],
  );

  const openHelperPageWithDraft = useCallback(
    (path: string) => {
      saveDraft();
      if (typeof window !== "undefined") {
        window.open(path, "_blank", "noopener,noreferrer");
      }
    },
    [saveDraft],
  );

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
    // Collapse search suggestions after choosing a guest.
    setSearchQ(g.full_name);
    setHits([]);
  }, []);

  const runGuestSearch = useCallback(async (queryOverride?: string) => {
    setError(null);
    const q = (queryOverride ?? searchQ).trim();
    if (!q) {
      setHits([]);
      setSearchingGuests(false);
      return;
    }
    const reqId = ++guestSearchReqRef.current;
    setSearchingGuests(true);
    try {
      const list = await apiFetch<GuestSearchHit[]>(
        `/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(q)}`,
      );
      if (reqId === guestSearchReqRef.current) {
        setHits(list);
      }
    } catch (e) {
      if (reqId === guestSearchReqRef.current) {
        setError(e instanceof Error ? e.message : "Search failed");
      }
    } finally {
      if (reqId === guestSearchReqRef.current) {
        setSearchingGuests(false);
      }
    }
  }, [hotelId, searchQ]);

  useEffect(() => {
    if (step !== 1) return;
    const q = searchQ.trim();
    if (!q) {
      setHits([]);
      setSearchingGuests(false);
      return;
    }
    if (q.length < 2) return;
    const t = setTimeout(() => {
      void runGuestSearch(q);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ, step, runGuestSearch]);

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
    if (step !== 2) return;
    let cancelled = false;
    (async () => {
      try {
        setRoomSnapshotLoading(true);
        const res = await apiFetch<PagedRooms>(`/api/v1/hotels/${hotelId}/rooms?page=1&size=300`);
        if (!cancelled) {
          const sorted = [...res.data].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
          setRoomSnapshot(sorted);
        }
      } catch {
        if (!cancelled) setRoomSnapshot([]);
      } finally {
        if (!cancelled) setRoomSnapshotLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, hotelId]);

  function roomStatusTone(status: string) {
    switch (status) {
      case "VACANT_CLEAN":
      case "INSPECTED":
        return { bg: "#dcfce7", fg: "#166534", border: "#86efac" };
      case "VACANT_DIRTY":
      case "RESERVED":
        return { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d" };
      case "OCCUPIED":
      case "BLOCKED":
      case "OUT_OF_ORDER":
      case "UNDER_MAINTENANCE":
        return { bg: "#fee2e2", fg: "#991b1b", border: "#fca5a5" };
      default:
        return { bg: "#e5e7eb", fg: "#374151", border: "#d1d5db" };
    }
  }

  function isRoomBookable(status: string) {
    return status === "VACANT_CLEAN" || status === "INSPECTED";
  }

  function roomStatusShort(status: string) {
    switch (status) {
      case "VACANT_CLEAN":
        return "VACANT";
      case "VACANT_DIRTY":
        return "DIRTY";
      case "OUT_OF_ORDER":
        return "OUT OF ORDER";
      case "UNDER_MAINTENANCE":
        return "MAINTENANCE";
      default:
        return status.replaceAll("_", " ");
    }
  }

  const applyDraftData = useCallback((d: Record<string, unknown>) => {
    setStep(Math.min(5, Math.max(1, Number(d.step) || 1)));
    setSearchQ(String(d.searchQ ?? ""));
    setGuestId(typeof d.guestId === "string" ? d.guestId : null);
    setFullName(String(d.fullName ?? ""));
    setNationalId(String(d.nationalId ?? ""));
    setDob(String(d.dob ?? ""));
    setEmail(String(d.email ?? ""));
    setPhone(String(d.phone ?? ""));
    setPhoneCc(String(d.phoneCc ?? "+250"));
    setCountry(String(d.country ?? "Rwanda"));
    setProvince(String(d.province ?? ""));
    setDistrict(String(d.district ?? ""));
    setSector(String(d.sector ?? ""));
    setCell(String(d.cell ?? ""));
    setVillage(String(d.village ?? ""));
    setStreetNumber(String(d.streetNumber ?? ""));
    setAddressNotes(String(d.addressNotes ?? ""));
    setNationality(String(d.nationality ?? ""));
    setGender(String(d.gender ?? ""));
    setIdType(String(d.idType ?? "NATIONAL_ID"));
    setIdDocNumber(String(d.idDocNumber ?? ""));
    setIdExpiry(String(d.idExpiry ?? ""));
    setVipLevel(String(d.vipLevel ?? "NONE"));
    setMarketingConsent(Boolean(d.marketingConsent));
    setNotes(String(d.notes ?? ""));
    setCheckIn(String(d.checkIn ?? localYmd()));
    setCheckOut(String(d.checkOut ?? addDays(localYmd(), 1)));
    setAdults(Math.max(1, Number(d.adults) || 2));
    setRoomTypeId(String(d.roomTypeId ?? ""));
    setPreferredRoomId(String(d.preferredRoomId ?? ""));
    setSpecialRequests(String(d.specialRequests ?? ""));
    setEarlyCheckIn(Boolean(d.earlyCheckIn));
    setDeposit(String(d.deposit ?? ""));
    setPaymentMethod(String(d.paymentMethod ?? "CASH"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as Record<string, unknown>;
      setPendingDraft(d);
    } catch {
      // ignore invalid draft JSON
    }
  }, [draftKey]);

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
  const roomTypePriceMap = useMemo(() => {
    const m = new Map<string, { currency: string; nightly: number; total: number }>();
    for (const t of avail?.available_room_types ?? []) {
      m.set(t.room_type_id, {
        currency: t.currency,
        nightly: t.total_price / Math.max(1, t.nights),
        total: t.total_price,
      });
    }
    return m;
  }, [avail]);

  const mapSlices = useMemo(() => {
    const sorted = [...roomSnapshot].sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
    );
    const n = sorted.length;
    const q = Math.ceil(n / 4);
    return {
      top: sorted.slice(0, q),
      right: sorted.slice(q, q * 2),
      bottom: sorted.slice(q * 2, q * 3),
      left: sorted.slice(q * 3),
    };
  }, [roomSnapshot]);

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
      if (typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
      }
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
    const standardCheckInTime = "15:00:00";
    const standardCheckOutTime = "11:00:00";
    const checkInWithTime = `${done.stay.checkIn} ${standardCheckInTime}`;
    const checkOutWithTime = `${done.stay.checkOut} ${standardCheckOutTime}`;
    const esc = (v: unknown) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    const docTitle = `Reservation-${done.booking_reference ?? done.id}`;
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${docTitle}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --line: #dbe1ea;
      --brand: #0f766e;
      --soft: #f8fafc;
    }
    * { box-sizing: border-box; }
    body {
      font-family: "Inter", "Segoe UI", Arial, sans-serif;
      margin: 0;
      color: var(--ink);
      background: white;
      padding: 28px;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(130deg, #0f766e 0%, #115e59 60%, #134e4a 100%);
      color: #fff;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      gap: 20px;
    }
    .brand {
      font-size: 12px;
      letter-spacing: .16em;
      text-transform: uppercase;
      opacity: .92;
      margin-bottom: 8px;
    }
    .hotel {
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
    }
    .title {
      font-size: 14px;
      opacity: .95;
      margin-top: 8px;
    }
    .ref-wrap {
      text-align: right;
      min-width: 240px;
    }
    .ref-label { font-size: 12px; opacity: .9; text-transform: uppercase; letter-spacing: .08em; }
    .ref {
      margin-top: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: .03em;
    }
    .body { padding: 22px; background: var(--soft); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px 15px;
    }
    .card h3 {
      margin: 0 0 10px;
      font-size: 13px;
      letter-spacing: .06em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .row {
      display: grid;
      grid-template-columns: 130px 1fr;
      gap: 8px;
      margin: 6px 0;
      font-size: 14px;
    }
    .label { color: var(--muted); }
    .value { font-weight: 600; }
    .message {
      margin-top: 14px;
      background: #ecfeff;
      border: 1px solid #99f6e4;
      color: #115e59;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.4;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      border-top: 1px solid var(--line);
      padding: 12px 22px;
      background: #fff;
      color: var(--muted);
      font-size: 12px;
    }
    .watermark {
      position: fixed;
      top: 44%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 56px;
      font-weight: 800;
      letter-spacing: .18em;
      color: rgba(15, 118, 110, 0.09);
      text-transform: uppercase;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      z-index: 0;
    }
    .sheet, .header, .body, .footer { position: relative; z-index: 1; }
    .signatures {
      margin-top: 14px;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 14px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .sig-title {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 14px;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      font-size: 12px;
      color: #334155;
    }
    @media print {
      body { padding: 0; }
      .sheet { border: none; border-radius: 0; }
      .footer { color: #666; }
    }
  </style>
</head>
<body>
  <div class="watermark">Confidential / Staff Copy</div>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">HMS • Reservation</div>
        <div class="hotel">${esc(hotelName)}</div>
        <div class="title">Reservation Confirmation Document</div>
      </div>
      <div class="ref-wrap">
        <div class="ref-label">Booking Reference</div>
        <div class="ref">${esc(done.booking_reference ?? "—")}</div>
      </div>
    </div>
    <div class="body">
      <div class="grid">
        <div class="card">
          <h3>Guest</h3>
          <div class="row"><div class="label">Name</div><div class="value">${esc(done.guest.name)}</div></div>
          <div class="row"><div class="label">Email</div><div class="value">${esc(done.guest.email ?? "—")}</div></div>
          <div class="row"><div class="label">Phone</div><div class="value">${esc(phone || "—")}</div></div>
          <div class="row"><div class="label">Phone code</div><div class="value">${esc(phoneCc || "—")}</div></div>
          <div class="row"><div class="label">National ID</div><div class="value">${esc(nationalId || "—")}</div></div>
          <div class="row"><div class="label">Date of birth</div><div class="value">${esc(dob || "—")}</div></div>
          <div class="row"><div class="label">Nationality</div><div class="value">${esc(nationality || "—")}</div></div>
          <div class="row"><div class="label">Gender</div><div class="value">${esc(gender || "—")}</div></div>
          <div class="row"><div class="label">Reservation ID</div><div class="value">${esc(done.id)}</div></div>
          <div class="row"><div class="label">Status</div><div class="value">${esc(done.status)}</div></div>
        </div>
        <div class="card">
          <h3>Stay</h3>
          <div class="row"><div class="label">Source</div><div class="value">${esc(bookingSource)}</div></div>
          <div class="row"><div class="label">Room type</div><div class="value">${esc(selectedAvail?.name ?? "—")}</div></div>
          <div class="row"><div class="label">Room</div><div class="value">${esc(done.room.roomNumber)}</div></div>
          <div class="row"><div class="label">Preferred room</div><div class="value">${esc(preferredRoomId || "Auto-assign")}</div></div>
          <div class="row"><div class="label">Check-in</div><div class="value">${esc(checkInWithTime)}</div></div>
          <div class="row"><div class="label">Check-out</div><div class="value">${esc(checkOutWithTime)}</div></div>
          <div class="row"><div class="label">Nights</div><div class="value">${esc(done.stay.nights)}</div></div>
          <div class="row"><div class="label">Adults</div><div class="value">${esc(adults)}</div></div>
          <div class="row"><div class="label">Early check-in</div><div class="value">${earlyCheckIn ? "Yes" : "No"}</div></div>
          <div class="row"><div class="label">Special requests</div><div class="value">${esc(specialRequests || "—")}</div></div>
          <div class="row"><div class="label">Nightly avg</div><div class="value">${esc(
            selectedAvail ? `${(selectedAvail.total_price / Math.max(1, selectedAvail.nights)).toFixed(2)} ${selectedAvail.currency}` : "—",
          )}</div></div>
          <div class="row"><div class="label">Stay total</div><div class="value">${esc(
            selectedAvail ? `${selectedAvail.total_price} ${selectedAvail.currency}` : "—",
          )}</div></div>
        </div>
      </div>
      <div class="grid" style="margin-top: 14px;">
        <div class="card">
          <h3>Guest Address</h3>
          <div class="row"><div class="label">Country</div><div class="value">${esc(country || "—")}</div></div>
          <div class="row"><div class="label">Province</div><div class="value">${esc(province || "—")}</div></div>
          <div class="row"><div class="label">District</div><div class="value">${esc(district || "—")}</div></div>
          <div class="row"><div class="label">Sector</div><div class="value">${esc(sector || "—")}</div></div>
          <div class="row"><div class="label">Cell</div><div class="value">${esc(cell || "—")}</div></div>
          <div class="row"><div class="label">Village</div><div class="value">${esc(village || "—")}</div></div>
          <div class="row"><div class="label">Street No.</div><div class="value">${esc(streetNumber || "—")}</div></div>
          <div class="row"><div class="label">Address notes</div><div class="value">${esc(addressNotes || "—")}</div></div>
        </div>
        <div class="card">
          <h3>ID & Payment</h3>
          <div class="row"><div class="label">ID type</div><div class="value">${esc(idType || "—")}</div></div>
          <div class="row"><div class="label">ID number</div><div class="value">${esc(idDocNumber || nationalId || "—")}</div></div>
          <div class="row"><div class="label">ID expiry</div><div class="value">${esc(idExpiry || "—")}</div></div>
          <div class="row"><div class="label">VIP level</div><div class="value">${esc(vipLevel || "NONE")}</div></div>
          <div class="row"><div class="label">Marketing consent</div><div class="value">${marketingConsent ? "Yes" : "No"}</div></div>
          <div class="row"><div class="label">Notes</div><div class="value">${esc(notes || "—")}</div></div>
          <div class="row"><div class="label">Deposit</div><div class="value">${esc(
            deposit.trim() ? `${deposit} ${selectedAvail?.currency ?? "RWF"}` : "0",
          )}</div></div>
          <div class="row"><div class="label">Payment method</div><div class="value">${esc(
            deposit.trim() ? paymentMethod : "N/A",
          )}</div></div>
        </div>
      </div>
      <div class="message">${esc(done.message)}</div>
      <div class="signatures">
        <div>
          <div class="sig-title">Guest Signature</div>
          <div class="sig-line">Name & Signature</div>
        </div>
        <div>
          <div class="sig-title">Receptionist Signature</div>
          <div class="sig-line">Name, Signature & Date</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span>Generated on ${esc(new Date().toLocaleString())}</span>
      <span>${esc(hotelName)} • HMS</span>
    </div>
  </div>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
      return;
    }

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-sm mb-2">
          <Link href={staffAppPath("reservations")} className="text-primary">
            ← Reservations
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">New reservation</h1>
        <p className="text-muted-foreground text-sm mt-2">
          {walkIn ? "Walk-in / counter booking" : "Staff booking"} — complete each step, then confirm.
        </p>
      </div>
      {error && <div className="error">{error}</div>}
      {pendingDraft && !done && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
          <p className="text-sm font-medium text-amber-900">
            Unfinished reservation draft found
          </p>
          <p className="text-xs text-amber-800">
            {pendingDraft.savedAt
              ? `Saved on ${new Date(String(pendingDraft.savedAt)).toLocaleString()}.`
              : "A previous reservation draft exists on this device."}{" "}
            Continue it, or discard and start a fresh booking.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="hms-btn-solid"
              onClick={() => {
                applyDraftData(pendingDraft);
                setPendingDraft(null);
              }}
            >
              Continue draft
            </button>
            <button
              type="button"
              className="hms-btn-outline"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem(draftKey);
                }
                setPendingDraft(null);
              }}
            >
              Start new booking
            </button>
          </div>
        </div>
      )}

      {done ? (
        <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-3">
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
          <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {[
                { id: 1, label: "Guest" },
                { id: 2, label: "Stay" },
                { id: 3, label: "Room" },
                { id: 4, label: "Preview" },
                { id: 5, label: "Confirm" },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    if (s.id <= step) setStep(s.id);
                  }}
                  className={`px-3 py-1.5 rounded-full border ${
                    step === s.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border"
                  }`}
                >
                  {s.id}. {s.label}
                </button>
              ))}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${(step / 5) * 100}%`, transition: "width 180ms ease" }}
              />
            </div>
          </div>

          {step === 1 && (
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold">Guest</h2>
              <div className="flex flex-wrap gap-2">
                <input
                  className="flex-1 min-w-[12rem]"
                  placeholder="Optional: search existing guest by name or national ID"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
                <button
                  type="button"
                  className="hms-btn-outline"
                  onClick={() => void runGuestSearch()}
                  disabled={searchingGuests || searchQ.trim().length < 2}
                >
                  {searchingGuests ? "Searching..." : "Search"}
                </button>
              </div>
              {hits.length > 0 && (
                <ul className="space-y-2 border rounded-xl p-3 bg-muted/20">
                  {hits.map((h) => (
                    <li key={h.guest.id}>
                      <button
                        type="button"
                        className="text-left w-full hover:bg-muted/80 rounded-lg px-3 py-2"
                        onClick={() => applyHit(h)}
                      >
                        <strong>{h.guest.full_name}</strong> · {h.guest.national_id}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground -mt-1">
                Use search only when reusing an existing guest profile. You can also fill this form directly for a new guest.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block sm:col-span-2">
                  Full name *
                  <input
                    value={fullName}
                    onChange={(e) => {
                      markGuestEdited();
                      setFullName(e.target.value);
                    }}
                    required
                  />
                </label>
                <label>
                  National ID *
                  <input
                    value={nationalId}
                    onChange={(e) => {
                      markGuestEdited();
                      setNationalId(e.target.value);
                    }}
                    required
                  />
                </label>
                <label>
                  Date of birth *
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => {
                      markGuestEdited();
                      setDob(e.target.value);
                    }}
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      markGuestEdited();
                      setEmail(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={phone}
                    onChange={(e) => {
                      markGuestEdited();
                      setPhone(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Phone country code
                  <select
                    value={phoneCc}
                    onChange={(e) => {
                      markGuestEdited();
                      setPhoneCc(e.target.value);
                    }}
                  >
                    {PHONE_CODE_OPTIONS.map((entry) => (
                      <option key={`${entry.iso2}-${entry.code}`} value={entry.code}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nationality
                  <input
                    value={nationality}
                    onChange={(e) => {
                      markGuestEdited();
                      setNationality(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Gender
                  <select
                    value={gender}
                    onChange={(e) => {
                      markGuestEdited();
                      setGender(e.target.value);
                    }}
                  >
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
                <label className="sm:col-span-2">
                  Country *
                  <select
                    value={country}
                    onChange={(e) => {
                      markGuestEdited();
                      const selectedCountry = e.target.value;
                      setCountry(selectedCountry);
                      setNationality(selectedCountry);
                    }}
                    required
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.iso2} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {!COUNTRY_OPTIONS.some((c) => c.name === country) && country ? (
                      <option value={country}>{country}</option>
                    ) : null}
                  </select>
                </label>
                <label>
                  Province
                  <input
                    value={province}
                    onChange={(e) => {
                      markGuestEdited();
                      setProvince(e.target.value);
                    }}
                  />
                </label>
                <label>
                  District
                  <input
                    value={district}
                    onChange={(e) => {
                      markGuestEdited();
                      setDistrict(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Sector
                  <input
                    value={sector}
                    onChange={(e) => {
                      markGuestEdited();
                      setSector(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Cell
                  <input
                    value={cell}
                    onChange={(e) => {
                      markGuestEdited();
                      setCell(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Village
                  <input
                    value={village}
                    onChange={(e) => {
                      markGuestEdited();
                      setVillage(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Street number
                  <input
                    value={streetNumber}
                    onChange={(e) => {
                      markGuestEdited();
                      setStreetNumber(e.target.value);
                    }}
                  />
                </label>
                <label className="sm:col-span-2">
                  Address notes
                  <textarea
                    value={addressNotes}
                    onChange={(e) => {
                      markGuestEdited();
                      setAddressNotes(e.target.value);
                    }}
                    rows={2}
                  />
                </label>
                <label>
                  ID type
                  <select
                    value={idType}
                    onChange={(e) => {
                      markGuestEdited();
                      setIdType(e.target.value);
                    }}
                  >
                    <option value="NATIONAL_ID">National ID</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="REFUGEE_ID">Refugee ID</option>
                    <option value="DRIVERS_LICENSE">Driver&apos;s license</option>
                  </select>
                </label>
                {idType !== "NATIONAL_ID" && (
                  <label>
                    ID document number
                    <input
                      value={idDocNumber}
                      onChange={(e) => {
                        markGuestEdited();
                        setIdDocNumber(e.target.value);
                      }}
                      placeholder="Enter passport / license / refugee ID number"
                    />
                  </label>
                )}
                {idType !== "NATIONAL_ID" && (
                  <label>
                    ID expiry
                    <input
                      type="date"
                      value={idExpiry}
                      onChange={(e) => {
                        markGuestEdited();
                        setIdExpiry(e.target.value);
                      }}
                    />
                  </label>
                )}
                <label>
                  VIP level
                  <select
                    value={vipLevel}
                    onChange={(e) => {
                      markGuestEdited();
                      setVipLevel(e.target.value);
                    }}
                  >
                    <option value="NONE">None</option>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                  </select>
                </label>
                <div
                  className="sm:col-span-2"
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>Marketing consent</p>
                    <p className="text-xs text-muted-foreground" style={{ margin: "4px 0 0" }}>
                      Guest agrees to receive promotional offers, loyalty updates, and campaign email/SMS.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      markGuestEdited();
                      setMarketingConsent((v) => !v);
                    }}
                    aria-pressed={marketingConsent}
                    style={{
                      width: "56px",
                      height: "30px",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      background: marketingConsent ? "#0f766e" : "#e5e7eb",
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: "3px",
                        left: marketingConsent ? "29px" : "3px",
                        width: "22px",
                        height: "22px",
                        borderRadius: "999px",
                        background: "#fff",
                        transition: "left 120ms ease",
                      }}
                    />
                  </button>
                </div>
                <label className="sm:col-span-2">
                  Notes
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      markGuestEdited();
                      setNotes(e.target.value);
                    }}
                    rows={2}
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => saveDraft()}>
                  Save draft
                </button>
                <button type="button" className="hms-btn-solid" onClick={() => saveAndContinue(2)}>
                  Save &amp; continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
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
              <button type="button" className="hms-btn-outline" onClick={() => setMapOpen(true)}>
                Open hotel room map
              </button>
              {avail && (
                <div>
                  <p className="text-sm font-medium mb-2">Available room types</p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
                      gap: "14px",
                    }}
                  >
                    {avail.available_room_types.map((t) => {
                      const selected = roomTypeId === t.room_type_id;
                      const nightly = t.total_price / Math.max(1, t.nights);
                      return (
                        <button
                          key={t.room_type_id}
                          type="button"
                          onClick={() => setRoomTypeId(t.room_type_id)}
                          style={{
                            textAlign: "left",
                            borderRadius: "14px",
                            border: selected ? "2px solid #0f766e" : "1px solid #dbe1ea",
                            background: selected ? "#ecfeff" : "#fff",
                            padding: "14px 14px",
                            cursor: "pointer",
                            boxShadow: selected
                              ? "0 6px 20px rgba(15,118,110,0.16), 0 0 0 2px rgba(15,118,110,0.18)"
                              : "0 3px 12px rgba(15,23,42,0.06)",
                            minHeight: "112px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                            <strong style={{ fontSize: "1rem", lineHeight: 1.3 }}>{t.name}</strong>
                            <span
                              style={{
                                fontSize: "0.74rem",
                                borderRadius: "999px",
                                padding: "3px 8px",
                                background: selected ? "#99f6e4" : "#eef2f7",
                                color: selected ? "#0f766e" : "#475569",
                                fontWeight: 800,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {selected ? "SELECTED" : "SELECT"}
                            </span>
                          </div>
                          <div style={{ marginTop: "8px", fontSize: "0.86rem", color: "#475569" }}>
                            <strong>{t.available_count}</strong> room{t.available_count > 1 ? "s" : ""} free
                          </div>
                          <div style={{ marginTop: "6px", fontSize: "0.92rem", color: "#0f172a", lineHeight: 1.35 }}>
                            <strong>{nightly.toFixed(2)} {t.currency}</strong> / night
                            <span style={{ color: "#64748b" }}>
                              {" "}
                              · {t.total_price} {t.currency} total ({t.nights} night{t.nights > 1 ? "s" : ""})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {avail.available_room_types.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-sm">No inventory for these dates.</p>
                      <p className="text-xs text-muted-foreground">
                        These buttons save your current reservation draft first, then open room setup in a new tab.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="hms-btn-outline text-sm"
                          onClick={() => openHelperPageWithDraft(staffAppPath("rooms", "new"))}
                        >
                          + Create room
                        </button>
                        <button
                          type="button"
                          className="hms-btn-outline text-sm"
                          onClick={() => openHelperPageWithDraft(staffAppPath("room-types", "new"))}
                        >
                          + Create room type
                        </button>
                        <button
                          type="button"
                          className="hms-btn-outline text-sm"
                          onClick={() => openHelperPageWithDraft(staffAppPath("rooms"))}
                        >
                          Manage rooms
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Selected room from map</p>
                  {roomSnapshotLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the Open hotel room map action to browse all rooms without making this page too long.
                </p>
                <p className="text-sm mt-2">
                  {preferredRoomId
                    ? `Selected room: ${roomSnapshot.find((r) => r.id === preferredRoomId)?.roomNumber ?? preferredRoomId}`
                    : "No room selected yet."}
                </p>
              </div>

              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="hms-btn-outline" onClick={() => saveDraft()}>
                  Save draft
                </button>
                <button
                  type="button"
                  className="hms-btn-solid"
                  disabled={!roomTypeId}
                  onClick={() => saveAndContinue(3)}
                >
                  Save &amp; continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && mapOpen && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15,23,42,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 60,
                padding: "1rem",
              }}
            >
              <div
                className="panel"
                style={{
                  width: "min(1100px, 100%)",
                  maxHeight: "90vh",
                  overflow: "auto",
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 style={{ margin: 0 }}>Hotel room map</h3>
                  <button type="button" className="hms-btn-outline" onClick={() => setMapOpen(false)}>
                    Close map
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="px-2 py-1 rounded" style={{ background: "#dcfce7", color: "#166534" }}>
                    Green = Available
                  </span>
                  <span className="px-2 py-1 rounded" style={{ background: "#fef3c7", color: "#92400e" }}>
                    Amber = Reserved/Needs cleaning
                  </span>
                  <span className="px-2 py-1 rounded" style={{ background: "#fee2e2", color: "#991b1b" }}>
                    Red = Occupied/Blocked
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  {(avail?.available_room_types ?? []).map((t) => {
                    const nightly = t.total_price / Math.max(1, t.nights);
                    return (
                      <span
                        key={t.room_type_id}
                        className="px-2 py-1 rounded"
                        style={{ background: "#eef2ff", color: "#3730a3" }}
                      >
                        {t.name}: {nightly.toFixed(2)} {t.currency}/night
                      </span>
                    );
                  })}
                </div>

                <div style={{ background: "#374151", borderRadius: "16px", padding: "14px" }}>
                  <div style={{ display: "grid", gap: "10px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(84px,1fr))", gap: "8px" }}>
                      {mapSlices.top.map((r) => {
                        const tone = roomStatusTone(r.status);
                        const selected = preferredRoomId === r.id;
                        const bookable = isRoomBookable(r.status);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              if (!bookable) return;
                              setPreferredRoomId(r.id);
                              setRoomTypeId(r.roomType.id);
                            }}
                            disabled={!bookable}
                            style={{
                              border: selected ? "2px solid #0f766e" : `1px solid ${tone.border}`,
                              background: tone.bg,
                              color: tone.fg,
                              borderRadius: "8px",
                              padding: "8px 6px",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: bookable ? "pointer" : "not-allowed",
                              opacity: bookable ? 1 : 0.78,
                            }}
                          >
                            <div>{r.roomNumber}</div>
                            <div style={{ fontSize: "10px", marginTop: "3px", opacity: 0.9 }}>
                              {roomTypePriceMap.get(r.roomType.id)
                                ? `${roomTypePriceMap.get(r.roomType.id)!.nightly.toFixed(0)} ${roomTypePriceMap.get(r.roomType.id)!.currency}`
                                : r.roomType.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px", gap: "10px", alignItems: "stretch" }}>
                      <div style={{ display: "grid", gap: "8px" }}>
                        {mapSlices.left.map((r) => {
                          const tone = roomStatusTone(r.status);
                          const selected = preferredRoomId === r.id;
                          const bookable = isRoomBookable(r.status);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                if (!bookable) return;
                                setPreferredRoomId(r.id);
                                setRoomTypeId(r.roomType.id);
                              }}
                              disabled={!bookable}
                              style={{
                                border: selected ? "2px solid #0f766e" : `1px solid ${tone.border}`,
                                background: tone.bg,
                                color: tone.fg,
                                borderRadius: "8px",
                                padding: "8px 6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: bookable ? "pointer" : "not-allowed",
                                opacity: bookable ? 1 : 0.78,
                              }}
                            >
                              <div>{r.roomNumber}</div>
                              <div style={{ fontSize: "10px", marginTop: "3px", opacity: 0.9 }}>
                                {roomTypePriceMap.get(r.roomType.id)
                                  ? `${roomTypePriceMap.get(r.roomType.id)!.nightly.toFixed(0)} ${roomTypePriceMap.get(r.roomType.id)!.currency}`
                                  : r.roomType.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          borderRadius: "14px",
                          background: "#d1bda4",
                          border: "2px solid #b79b7b",
                          minHeight: "240px",
                          display: "grid",
                          placeItems: "center",
                          color: "#5b4631",
                          fontWeight: 700,
                        }}
                      >
                        CENTRAL AREA
                      </div>

                      <div style={{ display: "grid", gap: "8px" }}>
                        {mapSlices.right.map((r) => {
                          const tone = roomStatusTone(r.status);
                          const selected = preferredRoomId === r.id;
                          const bookable = isRoomBookable(r.status);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                if (!bookable) return;
                                setPreferredRoomId(r.id);
                                setRoomTypeId(r.roomType.id);
                              }}
                              disabled={!bookable}
                              style={{
                                border: selected ? "2px solid #0f766e" : `1px solid ${tone.border}`,
                                background: tone.bg,
                                color: tone.fg,
                                borderRadius: "8px",
                                padding: "8px 6px",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: bookable ? "pointer" : "not-allowed",
                                opacity: bookable ? 1 : 0.78,
                              }}
                            >
                              <div>{r.roomNumber}</div>
                              <div style={{ fontSize: "10px", marginTop: "3px", opacity: 0.9 }}>
                                {roomTypePriceMap.get(r.roomType.id)
                                  ? `${roomTypePriceMap.get(r.roomType.id)!.nightly.toFixed(0)} ${roomTypePriceMap.get(r.roomType.id)!.currency}`
                                  : r.roomType.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(84px,1fr))", gap: "8px" }}>
                      {mapSlices.bottom.map((r) => {
                        const tone = roomStatusTone(r.status);
                        const selected = preferredRoomId === r.id;
                        const bookable = isRoomBookable(r.status);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              if (!bookable) return;
                              setPreferredRoomId(r.id);
                              setRoomTypeId(r.roomType.id);
                            }}
                            disabled={!bookable}
                            style={{
                              border: selected ? "2px solid #0f766e" : `1px solid ${tone.border}`,
                              background: tone.bg,
                              color: tone.fg,
                              borderRadius: "8px",
                              padding: "8px 6px",
                              fontSize: "12px",
                              fontWeight: 700,
                              cursor: bookable ? "pointer" : "not-allowed",
                              opacity: bookable ? 1 : 0.78,
                            }}
                          >
                            <div>{r.roomNumber}</div>
                            <div style={{ fontSize: "10px", marginTop: "3px", opacity: 0.9 }}>
                              {roomTypePriceMap.get(r.roomType.id)
                                ? `${roomTypePriceMap.get(r.roomType.id)!.nightly.toFixed(0)} ${roomTypePriceMap.get(r.roomType.id)!.currency}`
                                : r.roomType.name}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold">Room &amp; extras</h2>
              {selectedAvail && (
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    padding: "12px",
                    background: "linear-gradient(180deg,#ffffff 0%, #f8fafc 100%)",
                  }}
                >
                  <p className="text-xs text-muted-foreground" style={{ margin: 0 }}>Rate summary</p>
                  <p style={{ margin: "6px 0 0", fontSize: "0.95rem" }}>
                    Nightly avg:{" "}
                    <strong>
                      {(selectedAvail.total_price / Math.max(1, selectedAvail.nights)).toFixed(2)} {selectedAvail.currency}
                    </strong>
                    {" · "}
                    Stay total: <strong>{selectedAvail.total_price} {selectedAvail.currency}</strong>
                  </p>
                </div>
              )}

              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "12px",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Early check-in</p>
                  <p className="text-xs text-muted-foreground" style={{ margin: "4px 0 0" }}>
                    {checkIn === todayYmd
                      ? "Allow early check-in for today."
                      : "Unavailable because check-in date is not today."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEarlyCheckIn((v) => !v)}
                  disabled={checkIn !== todayYmd}
                  aria-pressed={earlyCheckIn}
                  style={{
                    width: "56px",
                    height: "30px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: earlyCheckIn ? "#0f766e" : "#e5e7eb",
                    position: "relative",
                    cursor: checkIn === todayYmd ? "pointer" : "not-allowed",
                    opacity: checkIn === todayYmd ? 1 : 0.55,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: earlyCheckIn ? "29px" : "3px",
                      width: "22px",
                      height: "22px",
                      borderRadius: "999px",
                      background: "#fff",
                      transition: "left 120ms ease",
                    }}
                  />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <label>
                  Room (optional)
                  <select value={preferredRoomId} onChange={(e) => setPreferredRoomId(e.target.value)}>
                    <option value="">Auto-assign best room</option>
                    {roomsOfType.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} ({r.status})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Special requests
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={2}
                    placeholder="e.g. quiet room, near elevator, extra pillows"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="button" className="hms-btn-outline" onClick={() => saveDraft()}>
                  Save draft
                </button>
                <button type="button" className="hms-btn-solid" onClick={() => saveAndContinue(4)}>
                  Save &amp; continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
              <h2 className="text-lg font-semibold">Preview reservation</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Guest</p>
                  <p className="font-medium">{fullName || "—"}</p>
                  <p className="text-sm text-muted-foreground">{email || "No email"} · {phoneCc} {phone || "No phone"}</p>
                  <p className="text-sm text-muted-foreground">ID: {idType === "NATIONAL_ID" ? nationalId || "—" : idDocNumber || "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Stay</p>
                  <p className="font-medium">{checkIn} → {checkOut}</p>
                  <p className="text-sm text-muted-foreground">Adults: {adults} · Early check-in: {earlyCheckIn ? "Yes" : "No"}</p>
                  <p className="text-sm text-muted-foreground">Room type: {selectedAvail?.name ?? "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Room selection</p>
                  <p className="font-medium">
                    {preferredRoomId
                      ? roomSnapshot.find((r) => r.id === preferredRoomId)?.roomNumber ?? preferredRoomId
                      : "Auto-assign"}
                  </p>
                  <p className="text-sm text-muted-foreground">Special requests: {specialRequests || "None"}</p>
                </div>
                <div className="rounded-xl border border-border/60 p-3 bg-background">
                  <p className="text-xs text-muted-foreground mb-1">Price preview</p>
                  <p className="font-medium">
                    {selectedAvail ? `${selectedAvail.total_price} ${selectedAvail.currency}` : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Nightly avg:{" "}
                    {selectedAvail
                      ? `${(selectedAvail.total_price / Math.max(1, selectedAvail.nights)).toFixed(2)} ${selectedAvail.currency}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline" onClick={() => setStep(3)}>
                  Back
                </button>
                <button type="button" className="hms-btn-outline" onClick={() => saveDraft()}>
                  Save draft
                </button>
                <button type="button" className="hms-btn-solid" onClick={() => saveAndContinue(5)}>
                  Continue to confirm
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="bg-card rounded-2xl border border-border/60 p-6 shadow-sm space-y-5">
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
                <button type="button" className="hms-btn-outline" onClick={() => setStep(4)}>
                  Back
                </button>
                <button type="button" className="hms-btn-outline" onClick={() => saveDraft()}>
                  Save draft
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
