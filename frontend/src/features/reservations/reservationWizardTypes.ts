export type RoomTypeOption = {
  id: string;
  code?: string;
  name: string;
  baseRate?: number;
  maxOccupancy?: number;
};

export type AvailabilityType = {
  room_type_id: string;
  name: string;
  base_price_per_night: number;
  total_price: number;
  currency: string;
  nights: number;
  available_count: number;
};

export type AvailabilityResponse = {
  available_room_types: AvailabilityType[];
};

export type GuestSearchHit = {
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

export type ReservationPreviewResponse = {
  available: boolean;
  nightlyRate: number;
  roomSubtotal: number;
  estimatedTaxes: number;
  estimatedFees: number;
  estimatedTotal: number;
  depositDue: number;
  currency: string;
  warnings: Array<{ code: string; tone: string; message: string }>;
  policySummaries: string[];
};

export type CreateReservationResponse = {
  id: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  guest: { id: string; name: string; email: string | null };
  room: { id: string; roomNumber: string; floor: number | null };
  stay: { checkIn: string; checkOut: string; nights: number };
  message: string;
};

export type WizardFormState = {
  guestId: string | null;
  fullName: string;
  nationalId: string;
  dob: string;
  email: string;
  phone: string;
  country: string;
  nationality: string;
  idType: string;
  idDocumentNumber: string;
  idExpiryDate: string;
  marketingConsent: boolean;
  companions: Array<{ fullName: string; phone: string; idDocumentNumber: string }>;
  checkInDate: string;
  checkOutDate: string;
  arrivalTime: string;
  departureTime: string;
  roomsRequested: number;
  adults: number;
  children: number;
  childAges: string;
  stayPurpose: string;
  bookingIntent: string;
  flexibleDates: boolean;
  waitlistAllowed: boolean;
  roomTypeId: string;
  rateCode: string;
  roomTypeToChargeId: string;
  packages: string;
  addOns: string;
  roomFeatures: string;
  manualRateOverride: string;
  rateOverrideReason: string;
  sourceCode: string;
  marketCode: string;
  originCode: string;
  channelCode: string;
  promoCode: string;
  campaignCode: string;
  reservationType: string;
  guaranteeType: string;
  depositRequired: boolean;
  depositAmount: string;
  depositDueDate: string;
  paymentMethod: string;
  paymentStatus: string;
  taxExempt: boolean;
  cancellationPolicyId: string;
  depositPolicyId: string;
  noShowPolicyId: string;
  termsAccepted: boolean;
  accessibilityNeeds: string;
  dietaryRestrictions: string;
  allergies: string;
  bedPreference: string;
  floorPreference: string;
  arrivalTransportType: string;
  flightNumber: string;
  pickupRequired: boolean;
  lateCheckoutRequested: boolean;
  specialRequests: string;
  housekeepingInstructions: string;
  amenityInstructions: string;
  internalNotes: string;
  guestFacingNotes: string;
};
