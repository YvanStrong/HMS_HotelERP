import { apiFetch } from "@/lib/api";
import type {
  AvailabilityResponse,
  CreateReservationResponse,
  GuestSearchHit,
  ReservationPreviewResponse,
  RoomTypeOption,
  WizardFormState,
} from "./reservationWizardTypes";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function childAges(value: string): number[] {
  return splitCsv(value)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 17);
}

function money(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function buildWizardPayload(form: WizardFormState, walkIn: boolean, groupId: string | null) {
  const manualRate = money(form.manualRateOverride);
  const deposit = money(form.depositAmount);
  const packages = splitCsv(form.packages);
  const addOns = splitCsv(form.addOns);
  const roomFeatures = [
    ...splitCsv(form.roomFeatures),
    form.bedPreference ? `Bed: ${form.bedPreference}` : "",
    form.floorPreference ? `Floor: ${form.floorPreference}` : "",
  ].filter(Boolean);

  return {
    guestId: form.guestId,
    guest: form.guestId
      ? null
      : {
          fullName: form.fullName,
          national_id: form.nationalId,
          date_of_birth: form.dob,
          email: form.email || null,
          phone: form.phone || null,
          country: form.country || null,
          nationality: form.nationality || form.country || null,
          id_type: form.idType,
          id_document_number: form.idDocumentNumber || null,
          id_expiry_date: form.idExpiryDate || null,
          marketing_consent: form.marketingConsent,
          notes: form.internalNotes || null,
        },
    companions: form.companions
      .filter((c) => c.fullName.trim())
      .map((c) => ({
        fullName: c.fullName.trim(),
        phone: c.phone || null,
        idDocumentNumber: c.idDocumentNumber || null,
        accessibilityNeeds: form.accessibilityNeeds || null,
        dietaryRestrictions: form.dietaryRestrictions || null,
        allergies: form.allergies || null,
        roomFeaturePreferences: roomFeatures,
      })),
    checkInDate: form.checkInDate,
    checkOutDate: form.checkOutDate,
    arrivalTime: form.arrivalTime || null,
    departureTime: form.departureTime || null,
    roomsRequested: form.roomsRequested,
    adults: form.adults,
    children: form.children,
    childAges: childAges(form.childAges),
    stayPurpose: form.stayPurpose || null,
    bookingIntent: form.bookingIntent || (walkIn ? "WALK_IN" : "NORMAL"),
    waitlistAllowed: form.waitlistAllowed,
    flexibleDates: form.flexibleDates,
    roomTypeId: form.roomTypeId || null,
    preferredRoomId: null,
    roomTypeToChargeId: form.roomTypeToChargeId || form.roomTypeId || null,
    rateCode: form.rateCode || null,
    manualRateOverride: manualRate,
    rateOverrideReason: form.rateOverrideReason || null,
    packages,
    addOns,
    roomFeatures,
    upgradeReason: null,
    specialRequests: form.specialRequests || null,
    source: walkIn ? "WALK_IN" : "FRONT_DESK",
    sales: {
      marketCode: form.marketCode || null,
      sourceCode: form.sourceCode || (walkIn ? "WALK_IN" : "FRONT_DESK"),
      originCode: form.originCode || null,
      channelCode: form.channelCode || "DIRECT",
      promoCode: form.promoCode || null,
      campaignCode: form.campaignCode || null,
    },
    guarantee: {
      reservationType: form.reservationType,
      guaranteeType: form.guaranteeType,
      deductInventory: true,
      depositRequired: form.depositRequired,
      depositAmount: deposit,
      depositDueDate: form.depositDueDate || null,
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      taxExempt: form.taxExempt,
    },
    policy: {
      cancellationPolicyId: form.cancellationPolicyId || null,
      depositPolicyId: form.depositPolicyId || null,
      noShowPolicyId: form.noShowPolicyId || null,
      termsAccepted: form.termsAccepted,
      termsAcceptedAt: form.termsAccepted ? new Date().toISOString() : null,
      registrationCardSigned: false,
    },
    operations: {
      arrivalTransportType: form.arrivalTransportType || null,
      flightNumber: form.flightNumber || null,
      pickupRequired: form.pickupRequired,
      lateCheckoutRequested: form.lateCheckoutRequested,
      housekeepingInstructions: form.housekeepingInstructions || null,
      amenityInstructions: form.amenityInstructions || null,
      internalNotes: form.internalNotes || null,
      guestFacingNotes: form.guestFacingNotes || null,
    },
    segments: [
      {
        roomTypeId: form.roomTypeId || null,
        roomTypeToChargeId: form.roomTypeToChargeId || form.roomTypeId || null,
        segmentStart: form.checkInDate,
        segmentEnd: form.checkOutDate,
        adults: form.adults,
        children: form.children,
        rateCode: form.rateCode || null,
        nightlyRate: manualRate,
        packages,
        addOns,
        roomFeatures,
      },
    ],
    group_booking_id: groupId || null,
  };
}

export function loadRoomTypes(hotelId: string) {
  return apiFetch<RoomTypeOption[]>(`/api/v1/hotels/${hotelId}/room-types`, { quiet: true });
}

export function loadAvailability(hotelId: string, form: WizardFormState) {
  const params = new URLSearchParams({
    check_in: form.checkInDate,
    check_out: form.checkOutDate,
    adults: String(form.adults),
  });
  return apiFetch<AvailabilityResponse>(`/api/v1/hotels/${hotelId}/rooms/availability?${params}`, { quiet: true });
}

export function searchGuests(hotelId: string, query: string) {
  return apiFetch<GuestSearchHit[]>(`/api/v1/hotels/${hotelId}/guests/search?q=${encodeURIComponent(query)}`, {
    quiet: true,
  });
}

export function previewReservation(hotelId: string, form: WizardFormState, walkIn: boolean, groupId: string | null) {
  return apiFetch<ReservationPreviewResponse>(`/api/v1/hotels/${hotelId}/reservations/preview`, {
    method: "POST",
    body: JSON.stringify(buildWizardPayload(form, walkIn, groupId)),
  });
}

export function createReservation(hotelId: string, form: WizardFormState, walkIn: boolean, groupId: string | null) {
  return apiFetch<CreateReservationResponse>(`/api/v1/hotels/${hotelId}/reservations/wizard`, {
    method: "POST",
    body: JSON.stringify(buildWizardPayload(form, walkIn, groupId)),
  });
}

export function createWaitlist(hotelId: string, form: WizardFormState, groupId: string | null) {
  return apiFetch<{ id: string; message: string }>(`/api/v1/hotels/${hotelId}/reservations/waitlist`, {
    method: "POST",
    body: JSON.stringify({
      guestId: form.guestId,
      guest: form.guestId
        ? null
        : {
            fullName: form.fullName,
            national_id: form.nationalId,
            date_of_birth: form.dob,
            email: form.email || null,
            phone: form.phone || null,
          },
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
      roomTypeId: form.roomTypeId || null,
      adults: form.adults,
      children: form.children,
      childAges: childAges(form.childAges),
      flexibleDates: form.flexibleDates,
      sourceCode: form.sourceCode || null,
      marketCode: form.marketCode || null,
      priority: "NORMAL",
      notes: form.specialRequests || null,
      group_booking_id: groupId || null,
    }),
  });
}
