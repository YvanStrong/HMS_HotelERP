"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Users } from "lucide-react";
import { API_BASE, apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { useHotelContext } from "@/lib/useHotelContext";
import {
  buildTaxInvoiceHtml,
  guessPaymentMethodFromItems,
  openTaxInvoicePrintWindow,
  summarizeFromLineItems,
} from "@/lib/taxInvoiceHtml";

type PreferenceMoveActions = { onMove: (roomId: string) => void; movingRoomId: string | null };

function renderSuggestedAlternativesBlock(
  m: Record<string, unknown>,
  moveActions?: PreferenceMoveActions | null,
): ReactNode {
  const alts = m.suggestedAlternatives;
  if (!Array.isArray(alts)) return null;
  const msg = typeof m.message === "string" ? m.message : "";
  const cur = m.currentRoomNumber;
  return (
    <div className="space-y-3">
      {msg ? <p className="text-foreground">{msg}</p> : null}
      {cur != null && String(cur).length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Assigned room: <strong className="text-foreground">{String(cur)}</strong>
        </p>
      ) : null}
      {alts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No other vacant-ready rooms matched this room type and stay dates — inventory is tight for this window.
        </p>
      ) : (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested alternatives (same type, ready for sale)
          </p>
          <ul className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background p-3">
            {alts.map((item, idx) => {
              const row = item as Record<string, unknown>;
              const num = row.roomNumber ?? row.room_number;
              const fl = row.floor;
              const reason = row.reason ?? row.reasonSummary;
              const ridRaw = row.roomId ?? row.room_id;
              const ridStr = typeof ridRaw === "string" ? ridRaw : ridRaw != null ? String(ridRaw) : "";
              return (
                <li key={idx} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-semibold text-foreground">{String(num ?? "—")}</span>
                    {fl != null && String(fl).length > 0 ? (
                      <span className="text-muted-foreground"> · Floor {String(fl)}</span>
                    ) : null}
                    {typeof reason === "string" && reason ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{reason}</span>
                    ) : null}
                  </div>
                  {moveActions && ridStr ? (
                    <button
                      type="button"
                      className="hms-btn-outline shrink-0 px-3 py-1.5 text-xs"
                      disabled={moveActions.movingRoomId != null}
                      onClick={() => void moveActions.onMove(ridStr)}
                    >
                      {moveActions.movingRoomId === ridStr
                        ? "Moving…"
                        : `Move to ${String(num ?? "room")}`}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function humanizePrefsSectionKey(key: string): string {
  switch (key) {
    case "roomAssigned":
      return "Room";
    case "amenitiesPrepared":
      return "Amenities";
    case "servicesScheduled":
      return "Services";
    default:
      return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
  }
}

function renderAppliedPreferenceValue(key: string, v: unknown): ReactNode {
  if (v == null) return "—";
  if (key === "roomAssigned" && typeof v === "object" && v !== null && !Array.isArray(v)) {
    const m = v as Record<string, unknown>;
    const alts = m.suggestedAlternatives;
    if (Array.isArray(alts)) {
      return renderSuggestedAlternativesBlock(m, null);
    }
    if (Array.isArray(m.matchedPreferences) && (m.roomNumber != null || m.roomId != null)) {
      return (
        <span>
          Reassigned to room <strong>{String(m.roomNumber ?? m.roomId)}</strong>
          {m.matchedPreferences.length > 0 ? (
            <span className="text-muted-foreground"> (matched: {m.matchedPreferences.join(", ")})</span>
          ) : null}
        </span>
      );
    }
    if (typeof m.message === "string") {
      const msg = m.message;
      if (msg.includes("No preferredFloor")) {
        return (
          <span>
            Nothing to auto-move: guest preferences do not include a numeric{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">preferredFloor</code> (or{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">preferred_floor</code>). The current room stays
            assigned.
          </span>
        );
      }
      if (msg.includes("No better-matching")) {
        return (
          <span>
            No vacant-clean room on the preferred floor matched this stay window and room type, so the current room was
            kept.
          </span>
        );
      }
      return <span>{msg}</span>;
    }
    const rn = m.roomNumber;
    const rid = m.roomId;
    if (rn != null || rid != null) {
      return (
        <span>
          Reassigned to room <strong>{String(rn ?? rid)}</strong>
        </span>
      );
    }
  }
  if (Array.isArray(v)) {
    if (v.length === 0) {
      if (key === "amenitiesPrepared") {
        return "None logged automatically — review dietary / pillow notes on the guest profile.";
      }
      if (key === "servicesScheduled") {
        return "None scheduled automatically.";
      }
      return "None";
    }
    return (
      <ul className="ml-4 list-disc space-y-0.5">
        {v.map((item, i) => (
          <li key={i}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object") {
    return <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(v)}</span>;
  }
  return String(v);
}

type Folio = {
  reservationId: string;
  hotelId: string;
  confirmationCode?: string;
  booking_reference?: string;
  billing_routed_from_reservation_id?: string | null;
  billing_routed_to_reservation_id?: string | null;
  billing_route_note?: string | null;
  roomId: string | null;
  guest: { id: string; name: string; email: string };
  stay: { checkIn: string; checkOut: string; reservationStatus: string; totalNights: number };
  roomNumber: string;
  roomTypeName: string;
  charges: {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: string;
    quantity: number;
    postedBy: string;
    originating_reservation_id?: string | null;
  }[];
  summary: {
    reservation_id?: string;
    room_charges_total?: number;
    other_charges_total?: number;
    gross_total?: number;
    tax_total?: number;
    discount_total?: number;
    grand_total?: number;
    deposit_credit?: number;
    payments_total?: number;
    balanceDue?: number;
    balance_due?: number;
    depositPaid?: number;
    totalCharges?: number;
    currency: string;
  };
  payments: {
    id: string | null;
    postedAt: string;
    method: string;
    amount: number;
    type: string;
    status: string;
    reference?: string | null;
    notes?: string | null;
  }[];
  ledger?: {
    id: string;
    type: string;
    category: string;
    description: string;
    amount: number;
    debit_credit: string;
    reference?: string | null;
    createdAt: string;
  }[];
};

function folioTaxLabel(summary: Folio["summary"]): string {
  const gross = Number(summary.gross_total ?? 0);
  const tax = Number(summary.tax_total ?? 0);
  if (gross > 0.0001 && tax >= 0) {
    const pct = Math.round((tax / gross) * 1000) / 10;
    if (Number.isFinite(pct) && pct > 0) {
      return `Tax (${pct}%)`;
    }
  }
  return "Tax";
}

type StaffReservationDetail = {
  reservation_id: string;
  booking_reference: string;
  confirmation_code: string;
  status: string;
  booking_source: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
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
  guest_address: {
    country: string | null;
    province: string | null;
    district: string | null;
    sector: string | null;
    cell: string | null;
    village: string | null;
    street_number: string | null;
    address_notes: string | null;
  };
  room: {
    roomId: string;
    roomNumber: string;
    room_status?: string;
    cleanliness: string;
  } | null;
  timeline: { phase: string; at: string }[];
  folio_api_path: string;
  group_booking?: {
    id: string;
    group_name: string;
    group_code?: string | null;
  } | null;
};

type FeePolicy = {
  earlyCheckinFee: number;
  lateCheckoutFee: number;
  noShowDefaultFee: number;
  currency: string;
  overstayAutoPostEnabled?: boolean;
  overstayGraceMinutes?: number;
  overstayHourlyPercent?: number;
  overstayHalfDayCapPercent?: number;
  overstayFullNightAfterHours?: number;
  overstayMaxDailyPercent?: number;
  overstayApplyTax?: boolean;
  overstayPostTiming?: string;
};

type OverstayStatus = {
  enabled: boolean;
  postTiming: string;
  graceMinutes?: number;
  hourlyPercent?: number;
  halfDayCapPercent?: number;
  fullNightAfterHours?: number;
  maxDailyPercent?: number;
  applyTax?: boolean;
  scheduledCheckoutAt: string;
  graceEndsAt: string;
  evaluatedAt: string;
  inGrace: boolean;
  overdue: boolean;
  minutesLate: number;
  billableHours: number;
  fullNight: boolean;
  nightlyRate: number;
  projectedCharge: number;
  alreadyPosted: number;
  amountToPost: number;
  currency: string;
  message: string;
};

type PagedRooms = {
  data: { id: string; roomNumber: string; status: string }[];
};

type CheckOutResponse = {
  reservationId: string;
  status: string;
  room: { id: string; roomNumber: string; status: string; cleanliness: string };
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    pdfUrl?: string | null;
    items: { description: string; amount: number }[];
    bookingReference?: string;
    confirmationCode?: string;
    guestName?: string;
    roomNumber?: string | null;
    roomTypeName?: string | null;
    currency?: string;
    createdAt?: string;
  };
  invoiceBreakdown?: {
    roomCharges: number;
    consumptionCharges: number;
    subtotalBeforeTax: number;
    taxes: number;
    depositCredit: number;
    grandTotal: number;
  };
};

type FinalInvoiceDto = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  items: { description: string; amount: number }[];
  bookingReference?: string;
  confirmationCode?: string;
  guestName?: string;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  currency?: string;
  createdAt?: string;
};

function canOverrideBalance(role: string | undefined) {
  return role === "MANAGER" || role === "FINANCE" || role === "SUPER_ADMIN" || role === "HOTEL_ADMIN";
}

/** Whether checkout-side payment covers remaining folio balance (tolerates cent rounding). */
function checkoutAmountCoversDue(due: number, pay: number): boolean {
  if (due <= 0.01) return true;
  return pay >= due - 0.02;
}

const MIN_OVERRIDE_BALANCE_REASON_LEN = 10;

type GroupBookingSummary = NonNullable<StaffReservationDetail["group_booking"]>;

function ReservationGroupCard({ group }: { group: GroupBookingSummary }) {
  return (
    <div className="rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-violet-50/60 p-4 shadow-sm ring-1 ring-indigo-100/80 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
            <Users className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">Group block</p>
            <p className="truncate text-lg font-bold tracking-tight text-slate-900">{group.group_name}</p>
            {group.group_code ? (
              <p className="font-mono text-xs text-slate-600">Code {group.group_code}</p>
            ) : null}
          </div>
        </div>
        <Link
          href={staffAppPath("groups", group.id)}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition hover:bg-indigo-50"
        >
          View group →
        </Link>
      </div>
    </div>
  );
}

export default function StaffReservationDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const reservationId = String(params.reservationId);
  const { hotel } = useHotelContext(hotelId);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [staffDetail, setStaffDetail] = useState<StaffReservationDetail | null>(null);
  const [overstayStatus, setOverstayStatus] = useState<OverstayStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkOutOpen, setCheckOutOpen] = useState(false);
  const [roomChoices, setRoomChoices] = useState<{ id: string; roomNumber: string }[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [guestIdOk, setGuestIdOk] = useState(false);
  const [earlyIn, setEarlyIn] = useState(false);
  const [fees, setFees] = useState<FeePolicy | null>(null);

  const [minibarOk, setMinibarOk] = useState(false);
  const [lateOut, setLateOut] = useState(false);
  const [overrideBal, setOverrideBal] = useState(false);
  const [overrideBalReason, setOverrideBalReason] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyCheckIn, setModifyCheckIn] = useState("");
  const [modifyCheckOut, setModifyCheckOut] = useState("");
  const [modifyRebookingFee, setModifyRebookingFee] = useState("");
  const [modifyReason, setModifyReason] = useState("");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsResult, setPrefsResult] = useState<{
    appliedPreferences?: Record<string, unknown>;
    alerts?: Array<Record<string, unknown>>;
    nextSteps?: string[];
  } | null>(null);
  const [prefsMoveRoomId, setPrefsMoveRoomId] = useState<string | null>(null);
  /** When true, completing Record payment refreshes folio and syncs amount into the checkout form. */
  const [paymentOpenedFromCheckout, setPaymentOpenedFromCheckout] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [folioPaymentAmount, setFolioPaymentAmount] = useState("");
  const [folioPaymentMethod, setFolioPaymentMethod] = useState("CASH");
  const [folioPaymentRef, setFolioPaymentRef] = useState("");
  const [folioPaymentNotes, setFolioPaymentNotes] = useState("");
  const [checkoutPayAmount, setCheckoutPayAmount] = useState("");
  const [checkoutPayMethod, setCheckoutPayMethod] = useState("CASH");
  const [checkoutPayTypesUsed, setCheckoutPayTypesUsed] = useState("");
  const [checkoutPayRef, setCheckoutPayRef] = useState("");
  const [checkoutPayNotes, setCheckoutPayNotes] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeType, setChargeType] = useState("MINIBAR");
  const [chargeDesc, setChargeDesc] = useState("");

  const user = typeof window !== "undefined" ? loadAuthUser() : null;

  const load = useCallback(async (): Promise<Folio | null> => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return null;
    }
    try {
      const f = await apiFetch<Folio>(`/api/v1/hotels/${hotelId}/folios/${reservationId}`);
      setFolio(f);
      try {
        const d = await apiFetch<StaffReservationDetail>(
          `/api/v1/hotels/${hotelId}/reservations/${reservationId}/staff-detail`,
        );
        setStaffDetail(d);
      } catch {
        setStaffDetail(null);
      }
      try {
        setOverstayStatus(
          await apiFetch<OverstayStatus>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/overstay-status`),
        );
      } catch {
        setOverstayStatus(null);
      }
      return f;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load folio");
      return null;
    }
  }, [hotelId, reservationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function openCheckInModal() {
    setBanner(null);
    setGuestIdOk(false);
    setEarlyIn(false);
    setSelectedRoomId(folio?.roomId ?? "");
    try {
      const [policy, roomsJson] = await Promise.all([
        apiFetch<FeePolicy>(`/api/v1/hotels/${hotelId}/fee-policy`),
        apiFetch<PagedRooms>(
          `/api/v1/hotels/${hotelId}/rooms?page=1&size=200&status=VACANT_CLEAN,INSPECTED`,
        ),
      ]);
      setFees(policy);
      let rooms = roomsJson.data.map((r) => ({ id: r.id, roomNumber: r.roomNumber }));
      if (folio?.roomId && !rooms.some((r) => r.id === folio.roomId)) {
        rooms = [{ id: folio.roomId, roomNumber: folio.roomNumber || "Assigned" }, ...rooms];
      }
      setRoomChoices(rooms);
      setCheckInOpen(true);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not load check-in data" });
    }
  }

  async function submitCheckIn() {
    if (!guestIdOk) return;
    setBanner(null);
    try {
      const body: Record<string, unknown> = {
        guest_id_verified: true,
        is_early_checkin: earlyIn,
      };
      if (selectedRoomId && (!folio?.roomId || selectedRoomId !== folio.roomId)) {
        body.room_id = selectedRoomId;
      }
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/check-in`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCheckInOpen(false);
      setBanner({ kind: "ok", text: "Checked in successfully." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Check-in failed" });
    }
  }

  async function openCheckOutModal() {
    setBanner(null);
    // Default to checked to reduce friction; staff can turn it off if inspection is not done yet.
    setMinibarOk(true);
    setLateOut(false);
    setOverrideBal(false);
    setOverrideBalReason("");
    setCheckoutPayMethod("CASH");
    setCheckoutPayTypesUsed("");
    setCheckoutPayRef("");
    setCheckoutPayNotes("");
    const due =
      typeof folio?.summary.balanceDue === "number"
        ? folio.summary.balanceDue
        : typeof folio?.summary.balance_due === "number"
          ? folio.summary.balance_due
          : 0;
    try {
      const [policy, overstay] = await Promise.all([
        apiFetch<FeePolicy>(`/api/v1/hotels/${hotelId}/fee-policy`),
        apiFetch<OverstayStatus>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/overstay-status`).catch(
          () => null,
        ),
      ]);
      setFees(policy);
      setOverstayStatus(overstay);
      const projectedDue = due + (overstay?.amountToPost ?? 0);
      setCheckoutPayAmount(projectedDue > 0.01 ? String(Math.round(projectedDue * 100) / 100) : "0");
      setCheckOutOpen(true);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not load fee policy" });
    }
  }

  async function submitCheckOut() {
    if (!minibarOk) return;
    setBanner(null);
    const paid = Number(checkoutPayAmount || "0");
    const checkoutPayParsedSubmit = Number.isFinite(paid) ? paid : 0;
    const waivedByOverride =
      overrideBal &&
      checkoutBalance > 0.01 &&
      !checkoutAmountCoversDue(checkoutBalance, checkoutPayParsedSubmit);
    if (waivedByOverride && overrideBalReason.trim().length < MIN_OVERRIDE_BALANCE_REASON_LEN) {
      setBanner({
        kind: "err",
        text: `Explain why checkout proceeds without full payment (at least ${MIN_OVERRIDE_BALANCE_REASON_LEN} characters).`,
      });
      return;
    }
    try {
      const result = await apiFetch<CheckOutResponse>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          minibar_inspected: minibarOk,
          is_late_checkout: lateOut,
          override_balance_warning: overrideBal,
          ...(waivedByOverride
            ? { override_balance_reason: overrideBalReason.trim() }
            : {}),
          finalPayment: {
            method: checkoutPayTypesUsed.trim() || checkoutPayMethod,
            amount: checkoutPayParsedSubmit,
            transactionId:
              [checkoutPayRef.trim(), checkoutPayNotes.trim()].filter(Boolean).join(" — ").slice(0, 240) || null,
          },
        }),
      });
      setCheckOutOpen(false);
      setBanner({ kind: "ok", text: "Checked out successfully." });
      printInvoiceDoc(result);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Check-out failed";
      const hints: string[] = [];
      if (msg.includes("RESERVATION_WRONG_STATUS") || msg.includes("CHECKED_IN")) {
        hints.push("Reservation must be in CHECKED_IN status.");
      }
      if (msg.includes("MINIBAR_NOT_INSPECTED") || msg.toLowerCase().includes("minibar")) {
        hints.push("Enable 'Minibar inspected'.");
      }
      if (msg.includes("FOLIO_BALANCE_DUE") || msg.toLowerCase().includes("outstanding balance")) {
        hints.push("Settle folio balance or enable authorized override.");
      }
      if (msg.includes("OVERRIDE_REASON_REQUIRED")) {
        hints.push("Enter a clear reason for waiving the unpaid balance (manager / finance).");
      }
      if (msg.includes("NO_ROOM_ASSIGNED")) {
        hints.push("Assign a room before checkout.");
      }
      setBanner({
        kind: "err",
        text: hints.length ? `${msg} • ${hints.join(" ")}` : msg,
      });
    }
  }

  function printInvoiceDoc(result: CheckOutResponse) {
    if (!folio) return;
    const bd = result.invoiceBreakdown;
    let totalCharges: number;
    let depositPaid: number;
    let remainingBeforePayment: number;
    if (bd) {
      const sub = Number(bd.subtotalBeforeTax ?? 0);
      const tax = Number(bd.taxes ?? 0);
      totalCharges = sub + tax;
      depositPaid = Number(bd.depositCredit ?? 0);
      remainingBeforePayment = Number(bd.grandTotal ?? 0);
    } else {
      const items = result.invoice.items ?? [];
      let positives = 0;
      let deposit = 0;
      for (const it of items) {
        const a = Number(it.amount);
        if (a > 0) positives += a;
        if (String(it.description).toLowerCase().includes("deposit")) deposit = Math.abs(a);
      }
      totalCharges = positives;
      depositPaid = deposit;
      remainingBeforePayment = Math.max(0, totalCharges - depositPaid);
    }
    const paid = Number(checkoutPayAmount || "0");
    const dueAfterPayment = Math.max(0, remainingBeforePayment - paid);
    const checkoutAt = new Date().toLocaleString();
    const inv = result.invoice;
    const roomLabel =
      inv.roomNumber != null || inv.roomTypeName != null
        ? `${inv.roomNumber ?? folio.roomNumber ?? "—"} (${inv.roomTypeName ?? folio.roomTypeName ?? "—"})`
        : `${folio.roomNumber || "—"} (${folio.roomTypeName || "—"})`;
    const bookingRef =
      inv.bookingReference && inv.bookingReference !== "-"
        ? inv.bookingReference
        : staffDetail?.booking_reference ?? folio.booking_reference ?? "—";
    const guestNm = inv.guestName ?? folio.guest.name;
    const curr = inv.currency ?? folio.summary.currency;
    const whenLbl = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : checkoutAt;
    const html = buildTaxInvoiceHtml({
      invoiceNumber: result.invoice.invoiceNumber,
      items: result.invoice.items ?? [],
      bookingRef,
      guestName: guestNm,
      roomLabel,
      whenLabel: whenLbl,
      currency: curr,
      totalCharges,
      depositPaid,
      remainingBeforePayment,
      paidAtCheckout: paid,
      paymentMethodLabel: checkoutPayMethod,
      paymentTypesUsed: checkoutPayTypesUsed || checkoutPayMethod,
      balanceAfter: dueAfterPayment,
      hotelLogoUrl: hotel.logoUrl,
      hotelName: hotel.name,
    });
    openTaxInvoicePrintWindow(html);
  }

  async function doCancel() {
    const reason = window.prompt("Cancellation reason", "Guest requested cancellation");
    if (reason == null) return;
    if (!confirm("Cancel this reservation? The system will calculate penalty/refund according to policy.")) return;
    setBanner(null);
    try {
      const res = await apiFetch<{
        message?: string;
        cancellationPenalty?: number;
        refundableAmount?: number;
        policySummary?: string;
      }>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || "Staff cancelled via HMS UI" }),
      });
      setBanner({
        kind: "ok",
        text: `${res.message ?? "Cancelled."} Penalty: ${res.cancellationPenalty ?? 0}. Refundable: ${
          res.refundableAmount ?? 0
        }. ${res.policySummary ?? ""}`,
      });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Cancel failed" });
    }
  }

  function openModifyModal() {
    setModifyCheckIn(folio?.stay.checkIn ?? "");
    setModifyCheckOut(folio?.stay.checkOut ?? "");
    setModifyRebookingFee("");
    setModifyReason("");
    setModifyOpen(true);
  }

  async function submitModifyReservation() {
    if (!modifyCheckIn || !modifyCheckOut || modifyCheckOut <= modifyCheckIn) {
      setBanner({ kind: "err", text: "Check-out must be after check-in." });
      return;
    }
    setBanner(null);
    try {
      const fee = modifyRebookingFee.trim() ? Number(modifyRebookingFee) : 0;
      const res = await apiFetch<{ message?: string; pricing?: { balanceDue?: number } }>(
        `/api/v1/hotels/${hotelId}/reservations/${reservationId}/modify`,
        {
          method: "POST",
          body: JSON.stringify({
            checkInDate: modifyCheckIn,
            checkOutDate: modifyCheckOut,
            rebookingFee: Number.isFinite(fee) && fee > 0 ? fee : 0,
            reason: modifyReason || null,
          }),
        },
      );
      setModifyOpen(false);
      setBanner({ kind: "ok", text: res.message ?? "Reservation updated." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not modify reservation" });
    }
  }

  async function applyGuestPreferences() {
    setBanner(null);
    setPrefsLoading(true);
    setPrefsResult(null);
    try {
      const result = await apiFetch<{
        appliedPreferences?: Record<string, unknown>;
        alerts?: Array<Record<string, unknown>>;
        nextSteps?: string[];
      }>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/apply-guest-preferences`, {
        method: "POST",
        body: JSON.stringify({ applyPreferences: { roomAssignment: true, amenities: true, services: true } }),
      });
      setPrefsResult(result);
      setPrefsOpen(true);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Failed to apply preferences" });
    } finally {
      setPrefsLoading(false);
    }
  }

  async function reassignToSuggestedRoom(roomId: string) {
    setBanner(null);
    setPrefsMoveRoomId(roomId);
    try {
      await apiFetch<{ message?: string }>(
        `/api/v1/hotels/${hotelId}/reservations/${reservationId}/reassign-room`,
        {
          method: "POST",
          body: JSON.stringify({ room_id: roomId }),
        },
      );
      setPrefsOpen(false);
      setPrefsResult(null);
      setBanner({ kind: "ok", text: "Room reassigned successfully." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not reassign room" });
    } finally {
      setPrefsMoveRoomId(null);
    }
  }

  async function submitPayment() {
    const amt = Number(folioPaymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setBanner(null);
    const fromCheckout = paymentOpenedFromCheckout;
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/folios/${reservationId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: "PARTIAL",
          method: folioPaymentMethod,
          amount: amt,
          currency: folio?.summary.currency ?? "RWF",
          reference: folioPaymentRef || null,
          notes: folioPaymentNotes || null,
        }),
      });
      setPaymentOpen(false);
      setFolioPaymentAmount("");
      setFolioPaymentRef("");
      setFolioPaymentNotes("");
      setBanner({ kind: "ok", text: "Payment recorded." });
      const f = await load();
      if (fromCheckout && f) {
        const due =
          typeof f.summary.balanceDue === "number"
            ? f.summary.balanceDue
            : typeof f.summary.balance_due === "number"
              ? f.summary.balance_due
              : 0;
        setCheckoutPayAmount(due > 0.01 ? String(Math.round(due * 100) / 100) : "0");
      }
      setPaymentOpenedFromCheckout(false);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Payment failed" });
    }
  }

  async function submitCharge() {
    const amt = Number(chargeAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !chargeDesc.trim()) return;
    if (/^\s*payment\s*$/i.test(chargeDesc.trim())) {
      setBanner({
        kind: "err",
        text: "Use '+ Record Payment' for money received. '+ Add Charge' adds to the guest balance.",
      });
      return;
    }
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/folios/${reservationId}/charges`, {
        method: "POST",
        body: JSON.stringify({
          charge_type: chargeType,
          description: chargeDesc.trim(),
          amount: amt,
          currency: folio?.summary.currency ?? "RWF",
        }),
      });
      setChargeOpen(false);
      setChargeAmount("");
      setChargeDesc("");
      setBanner({ kind: "ok", text: "Charge posted." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Charge failed" });
    }
  }

  async function printInvoicePdf() {
    if (!folio) return;
    setBanner(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/hotels/${hotelId}/reservations/${reservationId}/final-invoice`,
        {
          headers: {
            Authorization: `Bearer ${getToken() ?? ""}`,
            "X-Hotel-ID": hotelId,
          },
        },
      );
      const fallbackRoomLabel = `${folio.roomNumber || "—"} (${folio.roomTypeName || "—"})`;
      const fallbackBookingRef = staffDetail?.booking_reference ?? folio.booking_reference ?? "—";
      const fallbackCurrency = folio.summary.currency;

      if (res.ok) {
        const inv = (await res.json()) as FinalInvoiceDto;
        const bal = Number(inv.totalAmount ?? 0);
        const sums = summarizeFromLineItems(inv.items ?? [], bal);
        const pm = guessPaymentMethodFromItems(inv.items ?? []);
        const roomLabel =
          inv.roomNumber != null || inv.roomTypeName != null
            ? `${inv.roomNumber ?? folio.roomNumber ?? "—"} (${inv.roomTypeName ?? folio.roomTypeName ?? "—"})`
            : fallbackRoomLabel;
        const bookingRef =
          inv.bookingReference && inv.bookingReference !== "-"
            ? inv.bookingReference
            : fallbackBookingRef;
        const guestNm = inv.guestName ?? folio.guest.name;
        const currency = inv.currency ?? fallbackCurrency;
        const whenLabel = inv.createdAt ? new Date(inv.createdAt).toLocaleString() : new Date().toLocaleString();
        const html = buildTaxInvoiceHtml({
          invoiceNumber: inv.invoiceNumber,
          items: inv.items ?? [],
          bookingRef,
          guestName: guestNm,
          roomLabel,
          whenLabel,
          currency,
          totalCharges: sums.totalCharges,
          depositPaid: sums.depositPaid,
          remainingBeforePayment: sums.remainingBeforePayment,
          paidAtCheckout: sums.paidAtCheckout,
          paymentMethodLabel: pm,
          paymentTypesUsed: pm,
          balanceAfter: sums.balanceAfter,
          hotelLogoUrl: hotel.logoUrl,
          hotelName: hotel.name,
        });
        openTaxInvoicePrintWindow(html);
        return;
      }

      if (res.status !== 404) {
        throw new Error(await res.text());
      }

      const items: { description: string; amount: number }[] = [
        { description: "Subtotal (room & posted charges)", amount: Number(folio.summary.gross_total ?? 0) },
        { description: folioTaxLabel(folio.summary), amount: Number(folio.summary.tax_total ?? 0) },
      ];
      for (const p of folio.payments.filter((x) => x.status === "COMPLETED")) {
        const label =
          String(p.type).toUpperCase() === "DEPOSIT" ? "Deposit Paid" : `Payment received (${p.method})`;
        items.push({ description: label, amount: -Number(p.amount) });
      }
      const bal = Number(folio.summary.balance_due ?? folio.summary.balanceDue ?? 0);
      const sums = summarizeFromLineItems(items, bal);
      const lastPay = [...folio.payments]
        .reverse()
        .find((p) => p.status === "COMPLETED" && String(p.type).toUpperCase() !== "DEPOSIT");
      const pm = lastPay?.method ?? "—";
      const html = buildTaxInvoiceHtml({
        invoiceNumber: `Estimate · ${folio.booking_reference ?? folio.confirmationCode ?? folio.reservationId}`,
        items,
        bookingRef: fallbackBookingRef,
        guestName: folio.guest.name,
        roomLabel: fallbackRoomLabel,
        whenLabel: new Date().toLocaleString(),
        currency: fallbackCurrency,
        totalCharges: sums.totalCharges,
        depositPaid: sums.depositPaid,
        remainingBeforePayment: sums.remainingBeforePayment,
        paidAtCheckout: sums.paidAtCheckout,
        paymentMethodLabel: pm,
        paymentTypesUsed: pm,
        balanceAfter: sums.balanceAfter,
        hotelLogoUrl: hotel.logoUrl,
        hotelName: hotel.name,
      });
      openTaxInvoicePrintWindow(html);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Invoice print failed" });
    }
  }

  function printReservationDoc() {
    if (!folio) return;
    const standardCheckInTime = "15:00:00";
    const standardCheckOutTime = "11:00:00";
    const checkedInAt = staffDetail?.timeline?.find((t) => t.phase === "CHECKED_IN")?.at ?? null;
    const checkInWithTime = checkedInAt
      ? checkedInAt.slice(0, 19).replace("T", " ")
      : `${folio.stay.checkIn} ${standardCheckInTime}`;
    const checkOutWithTime = `${folio.stay.checkOut} ${standardCheckOutTime}`;
    const esc = (v: unknown) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const timelineRows = staffDetail?.timeline?.length
      ? staffDetail.timeline
          .map(
            (t) =>
              `<div class="row"><span class="label">${esc(t.phase)}</span>${esc(
                t.at ? t.at.slice(0, 19).replace("T", " ") : "—",
              )}</div>`,
          )
          .join("")
      : `<div class="row"><span class="label">Timeline</span>—</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Reservation ${esc(
      folio.booking_reference ?? folio.confirmationCode ?? folio.reservationId,
    )}</title>
    <style>
    :root{--ink:#0f172a;--muted:#475569;--line:#d9e2ec;--soft:#f8fafc;--brand:#0f766e}
    body{font-family:Inter,Segoe UI,Arial,sans-serif;margin:18px;color:var(--ink);position:relative;background:#fff}
    .watermark{position:fixed;top:47%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:58px;font-weight:900;letter-spacing:.12em;color:rgba(15,118,110,.08);text-transform:uppercase;white-space:nowrap;pointer-events:none;user-select:none;z-index:0}
    .wrap{position:relative;z-index:1}
    .top{max-width:960px;border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:linear-gradient(180deg,#ffffff 0%,#f7fbfb 100%);margin-bottom:10px}
    .top h1{margin:0 0 6px;font-size:23px}
    .top .meta{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--muted);font-size:12px}
    .chip{display:inline-block;border:1px solid #99f6e4;color:#115e59;background:#ecfeff;border-radius:999px;padding:3px 10px;font-weight:700}
    .card{border:1px solid var(--line);border-radius:12px;padding:14px 14px;max-width:960px;background:#fff;box-shadow:0 1px 0 rgba(15,23,42,.03)}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:960px}
    .card h3{margin:0 0 8px;font-size:14px;color:#0f766e;text-transform:uppercase;letter-spacing:.04em}
    .row{margin:6px 0}
    .label{font-weight:700;display:inline-block;min-width:170px;color:#1e293b}
    .value{color:#0f172a}
    .muted{color:var(--muted)}
    .summary{margin-top:10px;background:var(--soft)}
    .summary .row{font-size:14px}
    .summary .grand{font-size:16px;font-weight:800}
    .signatures{max-width:960px;margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:12px 12px;display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#fff}
    .sig-title{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:16px}
    .sig-line{border-top:1px solid #94a3b8;padding-top:5px;font-size:12px;color:#334155}
    @media print{body{margin:10px}.grid{grid-template-columns:1fr 1fr}}
    </style></head><body>
    <div class="watermark">Confidential / Staff Copy</div>
    <div class="wrap">
    <div class="top">
      <h1>Reservation Staff Copy</h1>
      <div class="meta">
        <span class="chip">Confidential</span>
        <span><strong>Reference:</strong> ${esc(folio.booking_reference ?? "—")}</span>
        <span><strong>Status:</strong> ${esc(folio.stay.reservationStatus)}</span>
        <span><strong>Generated:</strong> ${esc(new Date().toLocaleString())}</span>
      </div>
    </div>
    <div class="grid">
    <div class="card">
    <h3>Booking & Guest</h3>
    <div class="row"><span class="label">Booking reference:</span>${esc(folio.booking_reference ?? "—")}</div>
    <div class="row"><span class="label">Confirmation code:</span>${esc(folio.confirmationCode ?? "—")}</div>
    <div class="row"><span class="label">Booking source:</span>${esc(staffDetail?.booking_source?.replaceAll("_", " ") ?? "—")}</div>
    ${
      staffDetail?.group_booking
        ? `<div class="row"><span class="label">Group block:</span>${esc(staffDetail.group_booking.group_name)}${
            staffDetail.group_booking.group_code
              ? ` <span class="muted">(${esc(staffDetail.group_booking.group_code)})</span>`
              : ""
          }</div><div class="row"><span class="label">Group ID:</span><span class="value" style="font-family:ui-monospace,monospace;font-size:12px">${esc(
            staffDetail.group_booking.id,
          )}</span></div>`
        : ""
    }
    <div class="row"><span class="label">Guest:</span>${esc(folio.guest.name)}</div>
    <div class="row"><span class="label">Email:</span>${esc(folio.guest.email ?? "—")}</div>
    <div class="row"><span class="label">Phone:</span>${esc(staffDetail?.guest.phone ?? "—")}</div>
    <div class="row"><span class="label">National ID:</span>${esc(staffDetail?.guest.national_id ?? "—")}</div>
    <div class="row"><span class="label">DOB:</span>${esc(staffDetail?.guest.date_of_birth ?? "—")}</div>
    <div class="row"><span class="label">Nationality:</span>${esc(staffDetail?.guest.nationality ?? "—")}</div>
    <div class="row"><span class="label">Gender:</span>${esc(staffDetail?.guest.gender ?? "—")}</div>
    <div class="row"><span class="label">Room:</span>${esc(folio.roomNumber || "Unassigned")} (${esc(folio.roomTypeName || "—")})</div>
    <div class="row"><span class="label">Room status:</span>${esc(staffDetail?.room?.room_status ?? "—")}</div>
    <div class="row"><span class="label">Cleanliness:</span>${esc(staffDetail?.room?.cleanliness ?? "—")}</div>
    <div class="row"><span class="label">Check-in:</span>${esc(checkInWithTime)}</div>
    <div class="row"><span class="label">Check-out:</span>${esc(checkOutWithTime)}</div>
    <div class="row"><span class="label">Stay:</span>${esc(folio.stay.totalNights)} nights</div>
    <div class="row"><span class="label">Status:</span>${esc(folio.stay.reservationStatus)}</div>
    <div class="row"><span class="label">Deposit paid:</span>${esc((folio.summary.payments_total ?? 0) - (folio.summary.gross_total ?? 0) > 0 ? "Included" : "—")} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Total charges:</span>${esc(folio.summary.grand_total ?? "—")} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Total payments:</span>${esc(folio.summary.payments_total ?? "—")} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Balance due:</span>${esc(balance)} ${esc(
      folio.summary.currency,
    )}</div>
    </div>
    <div class="card">
    <h3>Address & Identity</h3>
    <div class="row"><span class="label">Address:</span>${esc(
      [
        staffDetail?.guest_address.street_number,
        staffDetail?.guest_address.village,
        staffDetail?.guest_address.cell,
        staffDetail?.guest_address.sector,
        staffDetail?.guest_address.district,
        staffDetail?.guest_address.province,
        staffDetail?.guest_address.country,
      ]
        .filter(Boolean)
        .join(", ") || "—",
    )}</div>
    <div class="row"><span class="label">Address notes:</span>${esc(staffDetail?.guest_address.address_notes ?? "—")}</div>
    <div class="row"><span class="label">ID type:</span>${esc(staffDetail?.guest.id_type ?? staffDetail?.guest.id_document_type ?? "—")}</div>
    <div class="row"><span class="label">ID number:</span>${esc(staffDetail?.guest.id_document_number ?? "—")}</div>
    <div class="row"><span class="label">ID expiry:</span>${esc(staffDetail?.guest.id_expiry_date ?? "—")}</div>
    <div class="row"><span class="label">VIP level:</span>${esc(staffDetail?.guest.vip_level ?? "—")}</div>
    <div class="row"><span class="label">Marketing consent:</span>${staffDetail?.guest.marketing_consent ? "Yes" : "No"}</div>
    <div class="row"><span class="label">Blacklisted:</span>${staffDetail?.guest.is_blacklisted ? "Yes" : "No"}</div>
    <div class="row"><span class="label">Blacklist reason:</span>${esc(staffDetail?.guest.blacklist_reason ?? "—")}</div>
    <div class="row"><span class="label">Guest notes:</span>${esc(staffDetail?.guest.notes ?? "—")}</div>
    </div>
    </div>
    <div class="card" style="margin-top:10px">
      <h3>Booking Timeline</h3>
      ${timelineRows}
    </div>
    <div class="card summary">
      <h3>Folio Snapshot</h3>
      <div class="row">Total charges: <strong>${esc(folio.summary.grand_total ?? "—")} ${esc(folio.summary.currency)}</strong></div>
      <div class="row">Total payments: <strong>${esc(folio.summary.payments_total ?? "—")} ${esc(folio.summary.currency)}</strong></div>
      <div class="row grand">Balance due: <strong>${esc(balance)} ${esc(folio.summary.currency)}</strong></div>
    </div>
    <div class="signatures">
      <div><div class="sig-title">Guest Signature</div><div class="sig-line">Name & Signature</div></div>
      <div><div class="sig-title">Receptionist Signature</div><div class="sig-line">Name, Signature & Date</div></div>
    </div>
    </div></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  const st = folio?.stay.reservationStatus;
  const checkedInDueToday = st === "CHECKED_IN" && folio?.stay.checkOut === new Date().toISOString().slice(0, 10);
  const balance =
    typeof folio?.summary.balanceDue === "number"
      ? folio.summary.balanceDue
      : typeof folio?.summary.balance_due === "number"
        ? folio.summary.balance_due
        : 0;
  const canOverride = canOverrideBalance(user?.role);
  const hasAssignedRoom = Boolean(folio?.roomId);
  const statusOkForCheckout = st === "CHECKED_IN";
  const projectedOverstayDue = overstayStatus?.amountToPost ?? 0;
  const checkoutBalance = Math.round((balance + projectedOverstayDue) * 100) / 100;
  const checkoutPayNum = Number(checkoutPayAmount);
  const checkoutPayParsed = Number.isFinite(checkoutPayNum) ? checkoutPayNum : 0;
  const balanceOk =
    checkoutBalance <= 0.01 ||
    (canOverride && overrideBal) ||
    checkoutAmountCoversDue(checkoutBalance, checkoutPayParsed);
  const blockedByBalance =
    checkoutBalance > 0.01 &&
    !(canOverride && overrideBal) &&
    !checkoutAmountCoversDue(checkoutBalance, checkoutPayParsed);
  const checkoutWaivedByOverride =
    overrideBal &&
    checkoutBalance > 0.01 &&
    !checkoutAmountCoversDue(checkoutBalance, checkoutPayParsed);
  const overrideReasonOk =
    !checkoutWaivedByOverride ||
    overrideBalReason.trim().length >= MIN_OVERRIDE_BALANCE_REASON_LEN;

  const statusChip = (status: string) => {
    const base = "text-xs font-semibold px-2 py-0.5 rounded-full";
    switch (status) {
      case "PENDING":
        return <span className={`${base} bg-gray-200 text-gray-800`}>PENDING</span>;
      case "CONFIRMED":
        return <span className={`${base} bg-blue-100 text-blue-800`}>CONFIRMED</span>;
      case "CHECKED_IN":
        return <span className={`${base} bg-green-100 text-green-800`}>CHECKED IN</span>;
      case "CHECKED_OUT":
        return <span className={`${base} bg-teal-100 text-teal-900`}>CHECKED OUT</span>;
      case "CANCELLED":
        return <span className={`${base} bg-red-100 text-red-800`}>CANCELLED</span>;
      case "NO_SHOW":
        return <span className={`${base} bg-orange-100 text-orange-900`}>NO SHOW</span>;
      default:
        return <span className={`${base} bg-muted`}>{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/90 via-background to-muted/30 pb-16">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-md ring-1 ring-slate-200/40">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 px-5 py-4 sm:px-6 sm:py-5">
            <p className="text-sm font-medium text-indigo-700">
              <Link href={staffAppPath("reservations")} className="hover:text-indigo-900 hover:underline">
                ← Reservations
              </Link>
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Reservation</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Front desk overview, folio, and actions for this stay.
                </p>
              </div>
              {folio ? (
                <div className="flex items-center gap-2">{statusChip(folio.stay.reservationStatus)}</div>
              ) : null}
            </div>
          </div>
        </div>
      {staffDetail && (
        <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Booking</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</p>
              <p className="m-0">
                <code
                  className="cursor-copy text-base font-bold text-slate-900"
                  title="Click to copy"
                  onClick={() => void navigator.clipboard.writeText(staffDetail.booking_reference)}
                >
                  {staffDetail.booking_reference}
                </code>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Confirmation <span className="font-mono">{staffDetail.confirmation_code}</span> · Source{" "}
                <strong>{staffDetail.booking_source.replace(/_/g, " ")}</strong>
              </p>
              {staffDetail.group_booking ? (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500">Group: </span>
                  <Link
                    href={staffAppPath("groups", staffDetail.group_booking.id)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {staffDetail.group_booking.group_name}
                    {staffDetail.group_booking.group_code ? ` (${staffDetail.group_booking.group_code})` : ""} →
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Guest</p>
              <p className="m-0 font-bold text-slate-900">{staffDetail.guest.full_name}</p>
              <p className="text-sm text-muted-foreground">
                National ID {staffDetail.guest.national_id} · DOB {staffDetail.guest.date_of_birth}
              </p>
              <p className="text-sm text-muted-foreground">
                {staffDetail.guest.email ?? "—"} · {staffDetail.guest.phone ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Guest address</p>
              <p className="m-0 text-sm text-slate-800">
                {[
                  staffDetail.guest_address.street_number,
                  staffDetail.guest_address.village,
                  staffDetail.guest_address.cell,
                  staffDetail.guest_address.sector,
                  staffDetail.guest_address.district,
                  staffDetail.guest_address.province,
                  staffDetail.guest_address.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {staffDetail.guest_address.address_notes && (
                <p className="text-xs text-muted-foreground mt-2">{staffDetail.guest_address.address_notes}</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Room status</p>
              {staffDetail.room ? (
                <p className="m-0 text-sm text-slate-800">
                  Room <strong>{staffDetail.room.roomNumber}</strong> · status{" "}
                  <strong>{staffDetail.room.room_status ?? "—"}</strong> · cleanliness{" "}
                  <strong>{staffDetail.room.cleanliness}</strong>
                </p>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">No room assigned.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Timeline</p>
            <ul className="m-0 list-none space-y-1.5 pl-0 text-sm text-slate-700">
              {staffDetail.timeline.map((t) => (
                <li key={t.phase + t.at} className="flex flex-wrap gap-x-2 border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                  <strong className="text-slate-900">{t.phase}</strong>
                  <span className="text-muted-foreground">{t.at ? t.at.slice(0, 19).replace("T", " ") : "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-sm">
          {error}
        </div>
      )}
      {banner && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {banner.text}
        </div>
      )}
      {folio && (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Guest &amp; stay</h2>
                {(folio.booking_reference || folio.confirmationCode) && (
                  <p className="text-sm text-muted-foreground">
                    Ref{" "}
                    <span className="font-mono font-semibold text-slate-800">
                      {folio.booking_reference ?? folio.confirmationCode}
                    </span>
                  </p>
                )}
                <p className="text-base font-semibold text-slate-900">
                  {folio.guest.name}
                  <span className="font-normal text-muted-foreground"> · </span>
                  <span className="break-all text-sm font-normal text-slate-600">{folio.guest.email}</span>
                </p>
                <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span>
                    {folio.stay.checkIn} → {folio.stay.checkOut}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span>{folio.stay.totalNights} nights</span>
                  <span className="text-slate-300">·</span>
                  {statusChip(folio.stay.reservationStatus)}
                </p>
                <p className="text-sm text-slate-700">
                  Room <strong className="text-slate-900">{folio.roomNumber || "—"}</strong>{" "}
                  <span className="text-muted-foreground">({folio.roomTypeName || "—"})</span>
                </p>
                {staffDetail?.group_booking ? (
                  <div className="pt-2">
                    <ReservationGroupCard group={staffDetail.group_booking} />
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-right shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Balance due</p>
                <p className="text-2xl font-black tabular-nums text-emerald-950">
                  {balance} <span className="text-base font-bold text-emerald-800">{folio.summary.currency}</span>
                </p>
              </div>
            </div>

            {st === "CHECKED_IN" &&
              overstayStatus?.enabled &&
              (checkedInDueToday || overstayStatus.overdue || overstayStatus.amountToPost > 0) && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Late checkout & overstay</p>
                    <h3 className="mt-1 text-lg font-black">
                      {overstayStatus.amountToPost > 0
                        ? `${overstayStatus.amountToPost} ${overstayStatus.currency} ready to post`
                        : overstayStatus.message}
                    </h3>
                    <p className="mt-1 text-sm text-amber-900">
                      Scheduled checkout: {new Date(overstayStatus.scheduledCheckoutAt).toLocaleString()} · Grace ends:{" "}
                      {new Date(overstayStatus.graceEndsAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-right text-sm shadow-sm">
                    <p className="font-bold">{overstayStatus.billableHours} billable hour{overstayStatus.billableHours === 1 ? "" : "s"}</p>
                    <p className="text-xs text-muted-foreground">
                      {overstayStatus.fullNight ? "Full night rule" : "Hourly policy"} · {overstayStatus.alreadyPosted} posted
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-5">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                onClick={() => document.getElementById("folio-block")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Folio
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                onClick={printReservationDoc}
                title="Print full staff copy"
              >
                Print Staff Copy
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                onClick={() => setChargeOpen(true)}
              >
                + Add Charge
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                onClick={() => {
                  setPaymentOpenedFromCheckout(false);
                  setFolioPaymentAmount("");
                  setFolioPaymentMethod("CASH");
                  setFolioPaymentRef("");
                  setFolioPaymentNotes("");
                  setPaymentOpen(true);
                }}
              >
                + Record Payment
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                onClick={() => void printInvoicePdf()}
              >
                Print Invoice
              </button>
              {st === "CONFIRMED" && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  onClick={() => void openCheckInModal()}
                >
                  Check in
                </button>
              )}
              {st === "CHECKED_IN" && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  onClick={() => void openCheckOutModal()}
                >
                  Check out &amp; invoice
                </button>
              )}
              {(st === "CONFIRMED" || st === "CHECKED_IN") && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                  onClick={openModifyModal}
                >
                  Modify / extend stay
                </button>
              )}
              {st === "CONFIRMED" && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50"
                  onClick={() => void doCancel()}
                >
                  Cancel reservation
                </button>
              )}
              {(st === "CONFIRMED" || st === "CHECKED_IN") && (
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                  disabled={prefsLoading}
                  onClick={() => void applyGuestPreferences()}
                >
                  {prefsLoading ? "Applying…" : "Apply Guest Preferences"}
                </button>
              )}
            </div>
          </div>
          <div
            className="rounded-2xl border border-slate-200/80 bg-card p-5 shadow-sm sm:p-6"
            id="folio-block"
          >
            <h2 className="border-b border-slate-100 pb-3 text-lg font-bold tracking-tight text-slate-900">
              Folio — {folio.booking_reference ?? folio.confirmationCode ?? folio.reservationId}
            </h2>
            {folio.billing_route_note ? (
              <div className="mb-4 mt-4 rounded-xl border border-slate-200 bg-muted/40 px-3 py-2.5 text-sm text-foreground">
                {folio.billing_route_note}
                {folio.billing_routed_from_reservation_id && folio.billing_routed_to_reservation_id ? (
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    Routed from {folio.billing_routed_from_reservation_id.slice(0, 8)}… → this folio (
                    {folio.billing_routed_to_reservation_id.slice(0, 8)}…)
                  </span>
                ) : null}
              </div>
            ) : null}
            <h3 className="mb-2 mt-2 text-sm font-bold uppercase tracking-wide text-teal-800">Charges</h3>
            {folio.charges.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">No incidental charges yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[320px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folio.charges.map((c) => (
                      <tr key={c.id} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">
                          {typeof c.date === "string"
                            ? c.date.slice(0, 16)
                            : c.date != null
                              ? JSON.stringify(c.date)
                              : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-slate-800">{c.description}</div>
                          {c.originating_reservation_id ? (
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              Incurred on stay {c.originating_reservation_id.slice(0, 8)}…
                            </div>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums text-slate-900">
                          {c.amount} {folio.summary.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6 space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-800">
              <p className="m-0 flex justify-between gap-2">
                <span className="text-muted-foreground">Room charges</span>
                <strong className="tabular-nums">
                  {folio.summary.room_charges_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
              <p className="m-0 flex justify-between gap-2">
                <span className="text-muted-foreground">Other charges</span>
                <strong className="tabular-nums">
                  {folio.summary.other_charges_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
              <p className="m-0 flex justify-between gap-2">
                <span className="text-muted-foreground">Subtotal (pre-tax)</span>
                <strong className="tabular-nums">
                  {folio.summary.gross_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
              <p className="m-0 flex justify-between gap-2">
                <span className="text-muted-foreground">{folioTaxLabel(folio.summary)}</span>
                <strong className="tabular-nums">
                  {folio.summary.tax_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
              {Number(folio.summary.discount_total ?? 0) > 0 ? (
                <p className="m-0 flex justify-between gap-2">
                  <span className="text-muted-foreground">Discount</span>
                  <strong className="tabular-nums">
                    {folio.summary.discount_total ?? 0} {folio.summary.currency}
                  </strong>
                </p>
              ) : null}
              <p className="m-0 flex justify-between gap-2 border-t border-slate-200/80 pt-2">
                <span className="font-semibold text-slate-900">Total (after tax)</span>
                <strong className="tabular-nums text-slate-900">
                  {folio.summary.grand_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
              {Number(folio.summary.deposit_credit ?? 0) > 0 ? (
                <p className="m-0 flex justify-between gap-2">
                  <span className="text-muted-foreground">Deposit credit</span>
                  <strong className="tabular-nums">
                    {folio.summary.deposit_credit ?? 0} {folio.summary.currency}
                  </strong>
                </p>
              ) : null}
              <p className="m-0 flex justify-between gap-2">
                <span className="text-muted-foreground">Payments total (incl. deposit)</span>
                <strong className="tabular-nums">
                  {folio.summary.payments_total ?? 0} {folio.summary.currency}
                </strong>
              </p>
            </div>
            <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-teal-800">Payments</h3>
            {folio.payments?.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[360px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folio.payments.map((p, i) => (
                      <tr key={p.id ?? `${p.postedAt}-${i}`} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                          {p.postedAt?.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="px-3 py-2">{p.method}</td>
                        <td className="px-3 py-2 font-mono text-xs">{p.reference ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">
                          {p.amount} {folio.summary.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            )}
            <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-lg font-bold text-emerald-950">
              Balance due:{" "}
              <span className="tabular-nums">
                {balance} {folio.summary.currency}
              </span>
            </p>
            {folio.ledger && folio.ledger.length > 0 ? (
              <>
                <h3 className="mb-2 mt-8 text-sm font-bold uppercase tracking-wide text-teal-800">Ledger</h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[480px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2">D/C</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {folio.ledger.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 last:border-0">
                          <td className="whitespace-nowrap px-3 py-2 align-top text-xs text-slate-600">
                            {row.createdAt ? String(row.createdAt).slice(0, 16).replace("T", " ") : "—"}
                          </td>
                          <td className="px-3 py-2 align-top text-xs">
                            {row.type}
                            {row.category ? (
                              <span className="text-muted-foreground"> · {row.category}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-800">{row.description ?? "—"}</td>
                          <td className="px-3 py-2 align-top text-xs">{row.debit_credit}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right align-top font-medium tabular-nums">
                            {row.amount} {folio.summary.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </>
      )}

      {modifyOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "1rem" }}>
          <div className="panel" style={{ maxWidth: 520, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>{st === "CHECKED_IN" ? "Extend stay" : "Modify / extend stay"}</h3>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "var(--muted)" }}>
              {st === "CHECKED_IN"
                ? "If the guest wants another night, extend the checkout date here. The system checks room availability, posts the extra room-night charge, and reverses any open overstay charge for the same situation."
                : "Updates dates, recalculates room price/taxes, and can add a rebooking fee."}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label>
                Check-in
                <input
                  type="date"
                  value={modifyCheckIn}
                  disabled={st === "CHECKED_IN"}
                  onChange={(e) => setModifyCheckIn(e.target.value)}
                />
              </label>
              <label>
                Check-out
                <input type="date" value={modifyCheckOut} onChange={(e) => setModifyCheckOut(e.target.value)} />
              </label>
            </div>
            <label>
              Rebooking fee
              <input
                type="number"
                min={0}
                step="1"
                value={modifyRebookingFee}
                onChange={(e) => setModifyRebookingFee(e.target.value)}
                placeholder="0"
              />
            </label>
            {st === "CHECKED_IN" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Extension is for a valid paid extra night. Overstay remains for late departure without a new night.
              </div>
            )}
            <label>
              Reason / notes
              <textarea
                rows={3}
                value={modifyReason}
                onChange={(e) => setModifyReason(e.target.value)}
                placeholder="Guest changed travel dates, extended stay, upgrade approved..."
              />
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="button" className="secondary" onClick={() => setModifyOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitModifyReservation()}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: "1rem" }}>
          <div className="panel" style={{ maxWidth: 420, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Record payment</h3>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "var(--muted)" }}>
              This reduces balance due.
            </p>
            <label>Amount</label>
            <input type="number" value={folioPaymentAmount} onChange={(e) => setFolioPaymentAmount(e.target.value)} />
            <label>Method</label>
            <select value={folioPaymentMethod} onChange={(e) => setFolioPaymentMethod(e.target.value)}>
              {["CASH", "CARD", "MOBILE_MONEY", "BANK_TRANSFER"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label>Reference</label>
            <input value={folioPaymentRef} onChange={(e) => setFolioPaymentRef(e.target.value)} />
            <label>Notes</label>
            <textarea value={folioPaymentNotes} onChange={(e) => setFolioPaymentNotes(e.target.value)} />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.8rem" }}>
              <button type="button" className="secondary" onClick={() => setPaymentOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitPayment()}>
                Submit Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {chargeOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div className="panel" style={{ maxWidth: 420, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Add charge</h3>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "#92400e" }}>
              This increases balance due. Do not use for guest payments.
            </p>
            <label>Description</label>
            <input
              value={chargeDesc}
              placeholder="e.g. minibar, laundry, damage fee"
              onChange={(e) => setChargeDesc(e.target.value)}
            />
            <label>Charge type</label>
            <select value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
              {["ROOM_SERVICE", "MINIBAR", "LAUNDRY", "PARKING", "DAMAGE", "OTHER"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label>Amount</label>
            <input type="number" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "0.8rem" }}>
              <button type="button" className="secondary" onClick={() => setChargeOpen(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitCharge()}>
                Post Charge
              </button>
            </div>
          </div>
        </div>
      )}

      {checkInOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm" style={{ maxWidth: 460, width: "100%" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Check in</h3>
            <p style={{ margin: "0 0 0.9rem", color: "var(--muted)", fontSize: "0.9rem" }}>
              Verify guest identity and confirm room assignment.
            </p>
            <label style={{ display: "block", marginBottom: "0.45rem", fontWeight: 600 }}>Room</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.55rem" }}
            >
              <option value="">Keep / assign later…</option>
              {roomChoices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} ({r.id === folio?.roomId ? "current" : "available"})
                </option>
              ))}
            </select>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                marginBottom: "0.65rem",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Guest ID verified</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>Required before check-in</p>
              </div>
              <button
                type="button"
                onClick={() => setGuestIdOk((v) => !v)}
                aria-pressed={guestIdOk}
                style={{
                  width: "56px",
                  height: "30px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: guestIdOk ? "#0f766e" : "#e5e7eb",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: guestIdOk ? "29px" : "3px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#fff",
                    transition: "left 120ms ease",
                  }}
                />
              </button>
            </div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                marginBottom: "0.55rem",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Early check-in</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Apply only if guest is arriving before standard time
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEarlyIn((v) => !v)}
                aria-pressed={earlyIn}
                style={{
                  width: "56px",
                  height: "30px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: earlyIn ? "#0f766e" : "#e5e7eb",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: earlyIn ? "29px" : "3px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#fff",
                    transition: "left 120ms ease",
                  }}
                />
              </button>
            </div>
            {earlyIn && fees && (
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "1rem" }}>
                Fee: {fees.earlyCheckinFee} {fees.currency}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setCheckInOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!guestIdOk || (!folio?.roomId && !selectedRoomId)}
                onClick={() => void submitCheckIn()}
              >
                Confirm check-in
              </button>
            </div>
          </div>
        </div>
      )}

      {checkOutOpen && folio && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: "1rem",
          }}
        >
          <div
            className="panel rounded-2xl border border-border/60 bg-card shadow-sm"
            style={{
              maxWidth: 480,
              width: "100%",
              maxHeight: "min(92vh, 900px)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: 0,
            }}
          >
            <div style={{ flexShrink: 0, padding: "1.15rem 1.25rem 0.75rem", borderBottom: "1px solid var(--border)" }}>
              <h3 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Check out</h3>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.9rem" }}>
                Complete departure checks and finalize folio.
              </p>
            </div>
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0, padding: "1rem 1.25rem 1rem" }}>
              <p style={{ margin: "0 0 0.75rem" }}>
                <strong>Folio balance due:</strong> {balance} {folio.summary.currency}
              </p>
              {projectedOverstayDue > 0 && (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-bold">Policy overstay fee preview: {projectedOverstayDue} {overstayStatus?.currency}</p>
                  <p className="mt-1 text-xs">
                    {overstayStatus?.billableHours} billable hour{overstayStatus?.billableHours === 1 ? "" : "s"} after grace. This fee posts to the folio before checkout validation and appears on the invoice.
                  </p>
                </div>
              )}
              {checkoutBalance > 0.01 && (
                <p style={{ color: "#b91c1c", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                  Outstanding balance: {checkoutBalance} {folio.summary.currency}. Collect payment before checkout (enter amount
                  below, use <strong>Record payment</strong>, or manager override).
                </p>
              )}
              {balance < -0.01 && (
                <p
                  className="text-muted-foreground"
                  style={{
                    fontSize: "0.7rem",
                    lineHeight: 1.35,
                    margin: "0 0 0.4rem",
                    fontWeight: 400,
                    opacity: 0.9,
                  }}
                >
                  Negative balance is a credit (payments exceed charges). Leave Amount collected at checkout at 0 for
                  checkout; that field is only for money still owed on the folio. Post extra takings with + Record payment so
                  they appear on the folio and update this balance.
                </p>
              )}
              <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
                Deposit paid:{" "}
                <strong>
                  {folio.payments
                    .filter((p) => p.status === "COMPLETED" && String(p.type).toUpperCase() === "DEPOSIT")
                    .reduce((s, p) => s + Number(p.amount), 0)}
                </strong>{" "}
                {folio.summary.currency}
              </p>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.65rem" }}>
                Remaining to collect now: <strong>{Math.max(0, checkoutBalance)}</strong> {folio.summary.currency}
              </p>
              <button
                type="button"
                className="secondary"
                style={{ width: "100%", marginBottom: "0.65rem", fontWeight: 600 }}
                onClick={() => {
                  setPaymentOpenedFromCheckout(true);
                  setFolioPaymentAmount(checkoutBalance > 0.01 ? String(Math.round(checkoutBalance * 100) / 100) : "");
                  setFolioPaymentMethod(checkoutPayMethod);
                  setFolioPaymentRef("");
                  setFolioPaymentNotes("");
                  setPaymentOpen(true);
                }}
              >
                + Record payment (folio)
              </button>
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: "0.7rem",
                  lineHeight: 1.35,
                  margin: "0 0 0.45rem",
                  fontWeight: 400,
                  opacity: 0.9,
                }}
              >
                Posts to the folio like the main toolbar — refreshes balance here. If the guest still owes, enter that amount
                under Amount collected at checkout (counts for this step only when there is an outstanding balance).
              </p>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Amount collected at checkout
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={checkoutPayAmount}
                  onChange={(e) => setCheckoutPayAmount(e.target.value)}
                  style={{
                    width: "100%",
                    marginTop: "0.35rem",
                    boxShadow:
                      checkoutBalance > 0.01 && balanceOk
                        ? "0 0 0 2px rgba(22, 101, 52, 0.35)"
                        : checkoutBalance > 0.01
                          ? "0 0 0 1px rgba(185, 28, 28, 0.25)"
                          : undefined,
                  }}
                />
              </label>
              {checkoutBalance > 0.01 && balanceOk && (
                <p style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", color: "#166534", fontWeight: 600 }}>
                  Covers balance due for checkout (or use manager override).
                </p>
              )}
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Payment method
                <select
                  value={checkoutPayMethod}
                  onChange={(e) => setCheckoutPayMethod(e.target.value)}
                  style={{ width: "100%", marginTop: "0.35rem" }}
                >
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="MOBILE_MONEY">MOBILE MONEY</option>
                  <option value="MIXED">MIXED</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Payment types used (optional)
                <input
                  value={checkoutPayTypesUsed}
                  onChange={(e) => setCheckoutPayTypesUsed(e.target.value)}
                  placeholder="e.g. CASH + CARD"
                  style={{ width: "100%", marginTop: "0.35rem" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.5rem" }}>
                Reference
                <input
                  value={checkoutPayRef}
                  onChange={(e) => setCheckoutPayRef(e.target.value)}
                  placeholder="Receipt / auth code"
                  style={{ width: "100%", marginTop: "0.35rem" }}
                />
              </label>
              <label style={{ display: "block", marginBottom: "0.75rem" }}>
                Notes
                <textarea
                  value={checkoutPayNotes}
                  onChange={(e) => setCheckoutPayNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional"
                  style={{ width: "100%", marginTop: "0.35rem", resize: "vertical" }}
                />
              </label>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "10px 12px",
                marginBottom: "0.65rem",
                background: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Minibar inspected</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Required by checkout policy before checkout
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMinibarOk((v) => !v)}
                aria-pressed={minibarOk}
                style={{
                  width: "56px",
                  height: "30px",
                  borderRadius: "999px",
                  border: "1px solid var(--border)",
                  background: minibarOk ? "#0f766e" : "#e5e7eb",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: minibarOk ? "29px" : "3px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: "#fff",
                    transition: "left 120ms ease",
                  }}
                />
              </button>
            </div>
            {fees?.overstayAutoPostEnabled ? (
              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-bold text-slate-900">Policy-based late checkout is enabled</p>
                <p className="mt-1">
                  Grace {fees.overstayGraceMinutes ?? 60} min · {(fees.overstayHourlyPercent ?? 1.5).toFixed(2)}% per
                  billable hour · full night after {fees.overstayFullNightAfterHours ?? 6} hours. Use{" "}
                  <strong>Modify / extend stay</strong> when the guest is approved for another night.
                </p>
              </div>
            ) : (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  marginBottom: "0.55rem",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>Manual late checkout fee</p>
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                    Legacy flat fee only; policy-based overstay can be enabled in Settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLateOut((v) => !v)}
                  aria-pressed={lateOut}
                  style={{
                    width: "56px",
                    height: "30px",
                    borderRadius: "999px",
                    border: "1px solid var(--border)",
                    background: lateOut ? "#0f766e" : "#e5e7eb",
                    position: "relative",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "3px",
                      left: lateOut ? "29px" : "3px",
                      width: "22px",
                      height: "22px",
                      borderRadius: "999px",
                      background: "#fff",
                      transition: "left 120ms ease",
                    }}
                  />
                </button>
              </div>
            )}
            {!fees?.overstayAutoPostEnabled && lateOut && fees && (
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Fee: {fees.lateCheckoutFee} {fees.currency}
              </p>
            )}
            {checkoutBalance > 0.01 && canOverride && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={overrideBal}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setOverrideBal(on);
                      if (!on) setOverrideBalReason("");
                    }}
                  />
                  Override — proceed anyway (manager / finance)
                </label>
                {checkoutWaivedByOverride && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <label
                      htmlFor="override-bal-reason"
                      style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.35rem" }}
                    >
                      Why is checkout allowed without collecting the full balance? (required)
                    </label>
                    <textarea
                      id="override-bal-reason"
                      rows={3}
                      value={overrideBalReason}
                      onChange={(e) => setOverrideBalReason(e.target.value)}
                      placeholder="e.g. Comp night approved by GM on 2026-04-28; corporate master account XYZ to be invoiced separately."
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        fontSize: "0.9rem",
                        resize: "vertical",
                      }}
                    />
                    <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--muted)" }}>
                      Minimum {MIN_OVERRIDE_BALANCE_REASON_LEN} characters. Stored for audit.
                    </p>
                  </div>
                )}
              </div>
            )}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                background: "#fff",
                padding: "10px 12px",
                marginBottom: "0.9rem",
              }}
            >
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "0.9rem" }}>Checkout requirements</p>
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.86rem", lineHeight: 1.45 }}>
                <li style={{ color: statusOkForCheckout ? "#166534" : "#991b1b" }}>
                  {statusOkForCheckout ? "OK" : "Missing"} — Reservation status must be <strong>CHECKED_IN</strong>.
                </li>
                <li style={{ color: minibarOk ? "#166534" : "#991b1b" }}>
                  {minibarOk ? "OK" : "Missing"} — <strong>Minibar inspected</strong> must be enabled.
                </li>
                <li style={{ color: hasAssignedRoom ? "#166534" : "#991b1b" }}>
                  {hasAssignedRoom ? "OK" : "Missing"} — Reservation must have an <strong>assigned room</strong>.
                </li>
                <li style={{ color: balanceOk && overrideReasonOk ? "#166534" : "#991b1b" }}>
                  {balanceOk && overrideReasonOk
                    ? "OK"
                    : "Missing"} — Folio balance must be settled, or authorized override with a written reason.
                </li>
              </ul>
            </div>
            </div>
            <div
              style={{
                flexShrink: 0,
                padding: "1rem 1.25rem",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "0.5rem",
                justifyContent: "flex-end",
                background: "var(--card)",
              }}
            >
              <button type="button" className="secondary" onClick={() => setCheckOutOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !minibarOk ||
                  blockedByBalance ||
                  !statusOkForCheckout ||
                  !hasAssignedRoom ||
                  !overrideReasonOk
                }
                onClick={() => void submitCheckOut()}
              >
                Confirm check-out
              </button>
            </div>
          </div>
        </div>
      )}

      {prefsOpen && prefsResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold">Guest preferences</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Summary of the last run. Automatic room moves require status <strong>CONFIRMED</strong>, an assigned
                room, and a numeric floor preference on the guest profile. When there is no floor preference, you still
                get ranked alternative rooms (same type, ready for sale). Use <strong>Move to …</strong> for a
                one-click reassignment (reservation must be <strong>CONFIRMED</strong>). Amenities and services remain
                mostly manual follow-ups for now.
              </p>
            </div>
            {prefsResult.alerts && prefsResult.alerts.length > 0 && (
              <div className="space-y-2">
                {prefsResult.alerts.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-3 py-2 text-sm ${String(a.severity) === "HIGH" ? "bg-red-50 border border-red-200 text-red-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}
                  >
                    <strong>{String(a.type ?? "Alert")}:</strong> {String(a.message ?? JSON.stringify(a))}
                  </div>
                ))}
              </div>
            )}
            {prefsResult.appliedPreferences && Object.keys(prefsResult.appliedPreferences).length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm space-y-3">
                <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Results</p>
                {Object.entries(prefsResult.appliedPreferences).map(([k, v]) => {
                  const isRoomWithAlts =
                    k === "roomAssigned" &&
                    typeof v === "object" &&
                    v !== null &&
                    !Array.isArray(v) &&
                    Array.isArray((v as Record<string, unknown>).suggestedAlternatives);
                  return (
                    <div key={k}>
                      <p className="font-medium text-foreground">{humanizePrefsSectionKey(k)}</p>
                      <div className="mt-1 text-muted-foreground">
                        {isRoomWithAlts
                          ? renderSuggestedAlternativesBlock(v as Record<string, unknown>, {
                              onMove: reassignToSuggestedRoom,
                              movingRoomId: prefsMoveRoomId,
                            })
                          : renderAppliedPreferenceValue(k, v)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {prefsResult.nextSteps && prefsResult.nextSteps.length > 0 && (
              <ul className="text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                {prefsResult.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
            <div className="flex justify-end">
              <button type="button" className="hms-btn-solid" onClick={() => setPrefsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
