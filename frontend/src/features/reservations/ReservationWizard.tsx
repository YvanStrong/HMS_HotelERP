"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  createReservation,
  createWaitlist,
  loadAvailability,
  loadRoomTypes,
  previewReservation,
  searchGuests,
} from "./reservationWizardApi";
import type {
  AvailabilityResponse,
  CreateReservationResponse,
  GuestSearchHit,
  ReservationPreviewResponse,
  RoomTypeOption,
  WizardFormState,
} from "./reservationWizardTypes";

function localYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function inputClass() {
  return "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100";
}

function labelClass() {
  return "text-xs font-bold uppercase tracking-[0.14em] text-slate-500";
}

function initialState(props: ReservationWizardProps): WizardFormState {
  const today = localYmd();
  return {
    guestId: null,
    fullName: "",
    nationalId: "",
    dob: "",
    email: "",
    phone: "",
    country: "",
    nationality: "",
    idType: "NATIONAL_ID",
    idDocumentNumber: "",
    idExpiryDate: "",
    marketingConsent: false,
    companions: [],
    checkInDate: props.initialCheckIn && /^\d{4}-\d{2}-\d{2}$/.test(props.initialCheckIn) ? props.initialCheckIn : today,
    checkOutDate:
      props.initialCheckOut && /^\d{4}-\d{2}-\d{2}$/.test(props.initialCheckOut)
        ? props.initialCheckOut
        : addDays(today, 1),
    arrivalTime: "14:00",
    departureTime: "11:00",
    roomsRequested: 1,
    adults: Number(props.initialAdults) > 0 ? Number(props.initialAdults) : 2,
    children: 0,
    childAges: "",
    stayPurpose: "LEISURE",
    bookingIntent: props.walkIn ? "WALK_IN" : "NORMAL",
    flexibleDates: false,
    waitlistAllowed: false,
    roomTypeId: props.initialRoomTypeId || "",
    rateCode: "BAR",
    roomTypeToChargeId: "",
    packages: "",
    addOns: "",
    roomFeatures: "",
    manualRateOverride: "",
    rateOverrideReason: "",
    sourceCode: props.walkIn ? "WALK_IN" : "FRONT_DESK",
    marketCode: "TRANSIENT",
    originCode: "DIRECT",
    channelCode: "DIRECT",
    promoCode: "",
    campaignCode: "",
    reservationType: "GUARANTEED",
    guaranteeType: props.walkIn ? "CASH" : "CREDIT_CARD",
    depositRequired: props.walkIn,
    depositAmount: "",
    depositDueDate: "",
    paymentMethod: props.walkIn ? "CASH" : "CARD",
    paymentStatus: "PENDING",
    taxExempt: false,
    cancellationPolicyId: "STANDARD",
    depositPolicyId: "PROPERTY_DEFAULT",
    noShowPolicyId: "STANDARD",
    termsAccepted: false,
    accessibilityNeeds: "",
    dietaryRestrictions: "",
    allergies: "",
    bedPreference: "",
    floorPreference: "",
    arrivalTransportType: "",
    flightNumber: "",
    pickupRequired: false,
    lateCheckoutRequested: false,
    specialRequests: "",
    housekeepingInstructions: "",
    amenityInstructions: "",
    internalNotes: "",
    guestFacingNotes: "",
  };
}

type ReservationWizardProps = {
  hotelId: string;
  walkIn: boolean;
  groupId: string | null;
  initialCheckIn: string | null;
  initialCheckOut: string | null;
  initialRoomTypeId: string | null;
  initialAdults: string | null;
};

const steps = ["Stay", "Product", "Guest", "Preferences", "Guarantee", "Review"];

export function ReservationWizard(props: ReservationWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormState>(() => initialState(props));
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [preview, setPreview] = useState<ReservationPreviewResponse | null>(null);
  const [guestQuery, setGuestQuery] = useState("");
  const [guestHits, setGuestHits] = useState<GuestSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CreateReservationResponse | null>(null);
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);

  const selectedAvailability = useMemo(
    () => availability?.available_room_types.find((x) => x.room_type_id === form.roomTypeId) ?? null,
    [availability, form.roomTypeId],
  );

  const selectedRoomType = useMemo(
    () => roomTypes.find((x) => x.id === form.roomTypeId) ?? null,
    [roomTypes, form.roomTypeId],
  );
  const selectedNightlyRate = useMemo(() => {
    const manual = Number(form.manualRateOverride);
    if (Number.isFinite(manual) && manual > 0) return manual;
    const availableRate = Number(selectedAvailability?.base_price_per_night ?? 0);
    if (Number.isFinite(availableRate) && availableRate > 0) return availableRate;
    const baseRate = Number(selectedRoomType?.baseRate ?? 0);
    return Number.isFinite(baseRate) && baseRate > 0 ? baseRate : 0;
  }, [form.manualRateOverride, selectedAvailability, selectedRoomType]);

  useEffect(() => {
    let cancelled = false;
    loadRoomTypes(props.hotelId)
      .then((data) => {
        if (cancelled) return;
        setRoomTypes(data ?? []);
        if (!form.roomTypeId && data?.[0]?.id) {
          setForm((prev) => ({
            ...prev,
            roomTypeId: data[0].id,
            roomTypeToChargeId: data[0].id,
            manualRateOverride: data[0].baseRate && data[0].baseRate > 0 ? String(data[0].baseRate) : prev.manualRateOverride,
          }));
        } else if (form.roomTypeId) {
          const selected = data?.find((rt) => rt.id === form.roomTypeId);
          if (selected?.baseRate && selected.baseRate > 0) {
            setForm((prev) => ({
              ...prev,
              roomTypeToChargeId: prev.roomTypeToChargeId || prev.roomTypeId,
              manualRateOverride: prev.manualRateOverride || String(selected.baseRate),
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) setRoomTypes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [props.hotelId]);

  function update<K extends keyof WizardFormState>(key: K, value: WizardFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function refreshAvailability() {
    setError(null);
    setLoading(true);
    try {
      const data = await loadAvailability(props.hotelId, form);
      setAvailability(data);
      if (!form.roomTypeId && data.available_room_types[0]) {
        const first = data.available_room_types[0];
        setForm((prev) => ({
          ...prev,
          roomTypeId: first.room_type_id,
          roomTypeToChargeId: first.room_type_id,
          manualRateOverride:
            prev.manualRateOverride || first.base_price_per_night <= 0
              ? prev.manualRateOverride
              : String(first.base_price_per_night),
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load availability");
    } finally {
      setLoading(false);
    }
  }

  async function runGuestSearch() {
    if (guestQuery.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      setGuestHits(await searchGuests(props.hotelId, guestQuery.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Guest search failed");
    } finally {
      setLoading(false);
    }
  }

  function applyGuest(hit: GuestSearchHit) {
    setForm((prev) => ({
      ...prev,
      guestId: hit.guest.id,
      fullName: hit.guest.full_name,
      nationalId: hit.guest.national_id,
      dob: hit.guest.date_of_birth,
      email: hit.guest.email ?? "",
      phone: hit.guest.phone ?? "",
      country: hit.address.country ?? "",
      nationality: hit.guest.nationality ?? hit.address.country ?? "",
      idType: hit.guest.id_type ?? "NATIONAL_ID",
      idDocumentNumber: hit.guest.id_document_number ?? "",
      idExpiryDate: hit.guest.id_expiry_date ?? "",
      marketingConsent: hit.guest.marketing_consent,
      internalNotes: hit.guest.notes ?? "",
    }));
    setGuestHits([]);
    setGuestQuery(hit.guest.full_name);
  }

  function validateCurrentStep(): string | null {
    if (step === 0 && (!form.checkInDate || !form.checkOutDate || form.checkOutDate <= form.checkInDate)) {
      return "Check-out must be after check-in.";
    }
    if (step === 1 && !form.roomTypeId) return "Select a room type.";
    if (step === 1 && selectedNightlyRate <= 0) {
      return "Enter a positive nightly room rate before continuing. This prevents zero-balance reservations.";
    }
    if (step === 2) {
      if (!form.guestId && (!form.fullName.trim() || !form.nationalId.trim() || !form.dob)) {
        return "Guest full name, national ID, and date of birth are required for new guests.";
      }
    }
    if (step === 4 && form.depositRequired && !form.depositAmount.trim()) {
      return "Deposit is required, so enter the deposit amount.";
    }
    return null;
  }

  async function goNext() {
    const msg = validateCurrentStep();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    if (step === 0) await refreshAvailability();
    if (step === 4 || step === 5) await refreshPreview();
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }

  async function refreshPreview() {
    if (selectedNightlyRate <= 0) {
      setError("Enter a positive nightly room rate before previewing or booking.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setPreview(await previewReservation(props.hotelId, form, props.walkIn, props.groupId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitReservation() {
    const msg = validateCurrentStep();
    if (msg) {
      setError(msg);
      return;
    }
    if (!preview) {
      await refreshPreview();
      return;
    }
    if (Number(preview.estimatedTotal ?? 0) <= 0) {
      setError("Reservation total is zero. Enter a positive nightly rate and refresh preview before booking.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setDone(await createReservation(props.hotelId, form, props.walkIn, props.groupId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create reservation");
    } finally {
      setLoading(false);
    }
  }

  async function submitWaitlist() {
    setLoading(true);
    setError(null);
    try {
      const res = await createWaitlist(props.hotelId, form, props.groupId);
      setWaitlistMessage(res.message || "Waitlist entry created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create waitlist entry");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <section className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Reservation created</p>
          <h1 className="mt-2 text-2xl font-black text-emerald-950">{done.booking_reference ?? done.confirmationCode}</h1>
          <p className="mt-2 text-sm text-emerald-900">{done.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="hms-btn-solid" href={staffAppPath("reservations", done.id)}>
              Open reservation
            </Link>
            <Link className="hms-btn-outline" href={staffAppPath("reservations", "new")}>
              Create another
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-3 sm:p-6">
      <header className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">PMS reservation wizard</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {props.walkIn ? "Walk-in reservation" : "New reservation"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Guided booking with stay search, rate/product selection, guest profile, preferences, guarantee, policies,
              warnings, and review.
            </p>
          </div>
          <Link href={staffAppPath("reservations")} className="hms-btn-outline w-fit">
            Back to reservations
          </Link>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-2xl border px-3 py-3 text-left text-sm font-bold transition ${
                step === i
                  ? "border-slate-900 bg-slate-950 text-white shadow-md"
                  : i < step
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <span className="block text-[11px] opacity-70">Step {i + 1}</span>
              {s}
            </button>
          ))}
        </div>
      </header>

      {props.groupId && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-950">
          This reservation will be linked to group booking `{props.groupId.slice(0, 8)}`.
        </div>
      )}

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>}
      {waitlistMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {waitlistMessage}
        </div>
      )}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {step === 0 && (
          <div className="space-y-5">
            <StepTitle title="Search Stay" text="Start with dates, times, rooms, guests, children, and booking intent." />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Arrival date"><input className={inputClass()} type="date" value={form.checkInDate} onChange={(e) => update("checkInDate", e.target.value)} /></Field>
              <Field label="Departure date"><input className={inputClass()} type="date" value={form.checkOutDate} onChange={(e) => update("checkOutDate", e.target.value)} /></Field>
              <Field label="Rooms needed"><input className={inputClass()} type="number" min={1} value={form.roomsRequested} onChange={(e) => update("roomsRequested", Number(e.target.value) || 1)} /></Field>
              <Field label="Arrival time"><input className={inputClass()} type="time" value={form.arrivalTime} onChange={(e) => update("arrivalTime", e.target.value)} /></Field>
              <Field label="Departure time"><input className={inputClass()} type="time" value={form.departureTime} onChange={(e) => update("departureTime", e.target.value)} /></Field>
              <Field label="Stay purpose">
                <select className={inputClass()} value={form.stayPurpose} onChange={(e) => update("stayPurpose", e.target.value)}>
                  <option value="LEISURE">Leisure</option><option value="BUSINESS">Business</option><option value="EVENT">Event</option><option value="TRANSIT">Transit</option><option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Adults"><input className={inputClass()} type="number" min={1} value={form.adults} onChange={(e) => update("adults", Number(e.target.value) || 1)} /></Field>
              <Field label="Children"><input className={inputClass()} type="number" min={0} value={form.children} onChange={(e) => update("children", Number(e.target.value) || 0)} /></Field>
              <Field label="Children ages"><input className={inputClass()} placeholder="Example: 4, 7" value={form.childAges} onChange={(e) => update("childAges", e.target.value)} /></Field>
            </div>
            <Toggle label="Flexible dates" checked={form.flexibleDates} onChange={(v) => update("flexibleDates", v)} />
            <Toggle label="Allow waitlist if no inventory" checked={form.waitlistAllowed} onChange={(v) => update("waitlistAllowed", v)} />
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <StepTitle title="Select Product" text="Choose room type, rate code, package/add-ons, and charge room type." />
            <div className="flex flex-wrap gap-2">
              <button className="hms-btn-outline" type="button" onClick={() => void refreshAvailability()} disabled={loading}>
                {loading ? "Checking..." : "Refresh availability"}
              </button>
              <Link href={staffAppPath("room-types")} className="hms-btn-outline">Manage room types</Link>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(availability?.available_room_types ?? []).map((rt) => (
                <button
                  key={rt.room_type_id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      roomTypeId: rt.room_type_id,
                      roomTypeToChargeId: rt.room_type_id,
                      manualRateOverride:
                        prev.manualRateOverride || rt.base_price_per_night <= 0
                          ? prev.manualRateOverride
                          : String(rt.base_price_per_night),
                    }));
                  }}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                    form.roomTypeId === rt.room_type_id ? "border-slate-950 bg-slate-50 ring-2 ring-slate-200" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <strong className="text-slate-950">{rt.name}</strong>
                  <p className="mt-1 text-sm text-slate-600">{rt.available_count} available · {rt.base_price_per_night} {rt.currency}/night</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{rt.total_price} {rt.currency} total</p>
                </button>
              ))}
              {!availability && roomTypes.map((rt) => (
                <button
                  key={rt.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      roomTypeId: rt.id,
                      roomTypeToChargeId: rt.id,
                      manualRateOverride:
                        prev.manualRateOverride || !rt.baseRate || rt.baseRate <= 0
                          ? prev.manualRateOverride
                          : String(rt.baseRate),
                    }));
                  }}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                    form.roomTypeId === rt.id ? "border-slate-950 bg-slate-50 ring-2 ring-slate-200" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <strong className="text-slate-950">{rt.name}</strong>
                  <p className="mt-1 text-sm text-slate-600">{rt.code || "Room type"} · max {rt.maxOccupancy ?? "-"} guests</p>
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Rate code"><input className={inputClass()} value={form.rateCode} onChange={(e) => update("rateCode", e.target.value)} /></Field>
              <Field label="Manual nightly rate"><input className={inputClass()} type="number" min={0} value={form.manualRateOverride} onChange={(e) => update("manualRateOverride", e.target.value)} placeholder={selectedAvailability ? String(selectedAvailability.base_price_per_night) : selectedRoomType?.baseRate ? String(selectedRoomType.baseRate) : ""} /></Field>
              <Field label="Rate override reason"><input className={inputClass()} value={form.rateOverrideReason} onChange={(e) => update("rateOverrideReason", e.target.value)} /></Field>
              <Field label="Packages"><input className={inputClass()} value={form.packages} onChange={(e) => update("packages", e.target.value)} placeholder="Breakfast, spa package" /></Field>
              <Field label="Add-ons"><input className={inputClass()} value={form.addOns} onChange={(e) => update("addOns", e.target.value)} placeholder="Airport pickup, extra bed" /></Field>
              <Field label="Room features"><input className={inputClass()} value={form.roomFeatures} onChange={(e) => update("roomFeatures", e.target.value)} placeholder="High floor, quiet room" /></Field>
            </div>
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                selectedNightlyRate > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-rose-200 bg-rose-50 text-rose-950"
              }`}
            >
              <strong>Room price:</strong>{" "}
              {selectedNightlyRate > 0
                ? `${selectedNightlyRate.toFixed(2)} per night. This rate will be used to calculate the room subtotal, tax, and balance.`
                : "Missing. Enter a positive nightly rate before booking."}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <StepTitle title="Guest Profiles" text="Search existing guests or create a new primary guest, then add companions." />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={inputClass()} value={guestQuery} onChange={(e) => setGuestQuery(e.target.value)} placeholder="Search name or national ID" />
              <button className="hms-btn-outline" type="button" onClick={() => void runGuestSearch()} disabled={loading}>Search guest</button>
            </div>
            {guestHits.length > 0 && (
              <div className="grid gap-2">
                {guestHits.map((hit) => (
                  <button key={hit.guest.id} type="button" onClick={() => applyGuest(hit)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm hover:border-slate-300">
                    <strong>{hit.guest.full_name}</strong> · {hit.guest.national_id}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name"><input className={inputClass()} value={form.fullName} onChange={(e) => { update("guestId", null); update("fullName", e.target.value); }} /></Field>
              <Field label="National ID"><input className={inputClass()} value={form.nationalId} onChange={(e) => { update("guestId", null); update("nationalId", e.target.value); }} /></Field>
              <Field label="Date of birth"><input className={inputClass()} type="date" value={form.dob} onChange={(e) => { update("guestId", null); update("dob", e.target.value); }} /></Field>
              <Field label="Email"><input className={inputClass()} type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
              <Field label="Phone"><input className={inputClass()} value={form.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
              <Field label="Country"><input className={inputClass()} value={form.country} onChange={(e) => update("country", e.target.value)} /></Field>
              <Field label="Nationality"><input className={inputClass()} value={form.nationality} onChange={(e) => update("nationality", e.target.value)} /></Field>
              <Field label="ID type">
                <select className={inputClass()} value={form.idType} onChange={(e) => update("idType", e.target.value)}>
                  <option value="NATIONAL_ID">National ID</option><option value="PASSPORT">Passport</option><option value="DRIVERS_LICENSE">Driver license</option><option value="OTHER">Other</option>
                </select>
              </Field>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><h3 className="font-black text-slate-950">Companions</h3><p className="text-sm text-slate-600">Add adult companions or shared guests.</p></div>
                <button type="button" className="hms-btn-outline" onClick={() => update("companions", [...form.companions, { fullName: "", phone: "", idDocumentNumber: "" }])}>Add companion</button>
              </div>
              <div className="mt-3 grid gap-3">
                {form.companions.map((c, index) => (
                  <div key={index} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-3">
                    <input className={inputClass()} placeholder="Full name" value={c.fullName} onChange={(e) => {
                      const next = [...form.companions]; next[index] = { ...c, fullName: e.target.value }; update("companions", next);
                    }} />
                    <input className={inputClass()} placeholder="Phone" value={c.phone} onChange={(e) => {
                      const next = [...form.companions]; next[index] = { ...c, phone: e.target.value }; update("companions", next);
                    }} />
                    <input className={inputClass()} placeholder="ID document number" value={c.idDocumentNumber} onChange={(e) => {
                      const next = [...form.companions]; next[index] = { ...c, idDocumentNumber: e.target.value }; update("companions", next);
                    }} />
                  </div>
                ))}
              </div>
            </div>
            <Toggle label="Marketing consent" checked={form.marketingConsent} onChange={(v) => update("marketingConsent", v)} />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <StepTitle title="Preferences And Operations" text="Capture the questions that improve arrival, housekeeping, F&B, and guest experience." />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Bed preference"><input className={inputClass()} value={form.bedPreference} onChange={(e) => update("bedPreference", e.target.value)} placeholder="King, twin, any" /></Field>
              <Field label="Floor preference"><input className={inputClass()} value={form.floorPreference} onChange={(e) => update("floorPreference", e.target.value)} placeholder="High floor, low floor" /></Field>
              <Field label="Accessibility needs"><textarea className={inputClass()} value={form.accessibilityNeeds} onChange={(e) => update("accessibilityNeeds", e.target.value)} /></Field>
              <Field label="Dietary restrictions"><textarea className={inputClass()} value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)} /></Field>
              <Field label="Allergies"><textarea className={inputClass()} value={form.allergies} onChange={(e) => update("allergies", e.target.value)} /></Field>
              <Field label="Special requests"><textarea className={inputClass()} value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} /></Field>
              <Field label="Transport type"><input className={inputClass()} value={form.arrivalTransportType} onChange={(e) => update("arrivalTransportType", e.target.value)} placeholder="Flight, car, shuttle" /></Field>
              <Field label="Flight number"><input className={inputClass()} value={form.flightNumber} onChange={(e) => update("flightNumber", e.target.value)} /></Field>
              <Field label="Housekeeping instructions"><textarea className={inputClass()} value={form.housekeepingInstructions} onChange={(e) => update("housekeepingInstructions", e.target.value)} /></Field>
              <Field label="Amenity instructions"><textarea className={inputClass()} value={form.amenityInstructions} onChange={(e) => update("amenityInstructions", e.target.value)} /></Field>
            </div>
            <Toggle label="Pickup required" checked={form.pickupRequired} onChange={(v) => update("pickupRequired", v)} />
            <Toggle label="Late checkout requested" checked={form.lateCheckoutRequested} onChange={(v) => update("lateCheckoutRequested", v)} />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <StepTitle title="Guarantee, Source And Policies" text="This is what makes reporting, no-show handling, deposits, and policy automation work." />
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Reservation type"><select className={inputClass()} value={form.reservationType} onChange={(e) => update("reservationType", e.target.value)}><option value="GUARANTEED">Guaranteed</option><option value="SIX_PM_HOLD">6 PM hold</option><option value="NON_DEDUCT">Non-deduct</option></select></Field>
              <Field label="Guarantee type"><select className={inputClass()} value={form.guaranteeType} onChange={(e) => update("guaranteeType", e.target.value)}><option value="CREDIT_CARD">Credit card</option><option value="CASH">Cash</option><option value="COMPANY">Company</option><option value="DIRECT_BILL">Direct bill</option><option value="OTA">OTA</option><option value="NONE">None</option></select></Field>
              <Field label="Payment method"><select className={inputClass()} value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)}><option value="CARD">Card</option><option value="CASH">Cash</option><option value="MOBILE_MONEY">Mobile money</option><option value="BANK_TRANSFER">Bank transfer</option><option value="DIRECT_BILL">Direct bill</option></select></Field>
              <Field label="Market code"><input className={inputClass()} value={form.marketCode} onChange={(e) => update("marketCode", e.target.value)} /></Field>
              <Field label="Source code"><input className={inputClass()} value={form.sourceCode} onChange={(e) => update("sourceCode", e.target.value)} /></Field>
              <Field label="Channel code"><input className={inputClass()} value={form.channelCode} onChange={(e) => update("channelCode", e.target.value)} /></Field>
              <Field label="Origin code"><input className={inputClass()} value={form.originCode} onChange={(e) => update("originCode", e.target.value)} /></Field>
              <Field label="Promo code"><input className={inputClass()} value={form.promoCode} onChange={(e) => update("promoCode", e.target.value)} /></Field>
              <Field label="Campaign code"><input className={inputClass()} value={form.campaignCode} onChange={(e) => update("campaignCode", e.target.value)} /></Field>
              <Field label="Deposit amount"><input className={inputClass()} type="number" min={0} value={form.depositAmount} onChange={(e) => update("depositAmount", e.target.value)} /></Field>
              <Field label="Deposit due date"><input className={inputClass()} type="date" value={form.depositDueDate} onChange={(e) => update("depositDueDate", e.target.value)} /></Field>
              <Field label="Cancellation policy"><input className={inputClass()} value={form.cancellationPolicyId} onChange={(e) => update("cancellationPolicyId", e.target.value)} /></Field>
            </div>
            <Toggle label="Deposit required" checked={form.depositRequired} onChange={(v) => update("depositRequired", v)} />
            <Toggle label="Tax exempt" checked={form.taxExempt} onChange={(v) => update("taxExempt", v)} />
            <Toggle label="Guest accepted booking terms" checked={form.termsAccepted} onChange={(v) => update("termsAccepted", v)} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <StepTitle title="Review And Book" text="Check pricing, policies, risk warnings, and operational notes before saving." />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => void refreshPreview()} disabled={loading}>Refresh preview</button>
              <button type="button" className="hms-btn-outline" onClick={() => void submitWaitlist()} disabled={loading}>Create waitlist instead</button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-black text-slate-950">Booking summary</h3>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Summary label="Guest" value={form.fullName || "Not entered"} />
                  <Summary label="Stay" value={`${form.checkInDate} to ${form.checkOutDate}`} />
                  <Summary label="Room type" value={selectedAvailability?.name || selectedRoomType?.name || "Not selected"} />
                  <Summary label="Guests" value={`${form.adults} adult(s), ${form.children} child(ren)`} />
                  <Summary label="Source / Market" value={`${form.sourceCode} / ${form.marketCode}`} />
                  <Summary label="Guarantee" value={`${form.guaranteeType} · ${form.paymentMethod}`} />
                </dl>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="font-black text-slate-950">Price and policy</h3>
                {preview ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <Summary label="Room subtotal" value={`${preview.roomSubtotal} ${preview.currency}`} />
                    <Summary label="Taxes" value={`${preview.estimatedTaxes} ${preview.currency}`} />
                    <Summary label="Fees" value={`${preview.estimatedFees} ${preview.currency}`} />
                    <Summary label="Estimated total" value={`${preview.estimatedTotal} ${preview.currency}`} strong />
                    {preview.policySummaries.map((p) => <p key={p} className="text-xs font-semibold text-slate-600">{p}</p>)}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">Refresh preview to calculate server-side price and warnings.</p>
                )}
              </div>
            </div>
            {preview?.warnings?.length ? (
              <div className="space-y-2">
                {preview.warnings.map((w) => (
                  <div key={w.code} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <strong>{w.code}:</strong> {w.message}
                  </div>
                ))}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Internal notes"><textarea className={inputClass()} value={form.internalNotes} onChange={(e) => update("internalNotes", e.target.value)} /></Field>
              <Field label="Guest-facing notes"><textarea className={inputClass()} value={form.guestFacingNotes} onChange={(e) => update("guestFacingNotes", e.target.value)} /></Field>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
          <button type="button" className="hms-btn-outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>Back</button>
          <div className="flex flex-wrap gap-2">
            {step < steps.length - 1 ? (
              <button type="button" className="hms-btn-solid" onClick={() => void goNext()} disabled={loading}>{loading ? "Working..." : "Continue"}</button>
            ) : (
              <button type="button" className="hms-btn-solid" onClick={() => void submitReservation()} disabled={loading}>{loading ? "Booking..." : "Book reservation"}</button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function StepTitle({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={labelClass()}>
      {label}
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
        checked ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      {checked ? "Yes" : "No"} · {label}
    </button>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right ${strong ? "font-black text-slate-950" : "font-semibold text-slate-800"}`}>{value}</dd>
    </div>
  );
}
