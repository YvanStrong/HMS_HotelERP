"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiFetch, getToken } from "@/lib/api";
import { loadAuthUser } from "@/lib/auth";
import { staffAppPath } from "@/lib/staffAppRoutes";

type Folio = {
  reservationId: string;
  hotelId: string;
  confirmationCode?: string;
  booking_reference?: string;
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
  }[];
  summary: {
    reservation_id?: string;
    room_charges_total?: number;
    other_charges_total?: number;
    gross_total?: number;
    tax_total?: number;
    discount_total?: number;
    grand_total?: number;
    payments_total?: number;
    balanceDue?: number;
    balance_due?: number;
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
};

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
};

type FeePolicy = {
  earlyCheckinFee: number;
  lateCheckoutFee: number;
  noShowDefaultFee: number;
  currency: string;
};

type PagedRooms = {
  data: { id: string; roomNumber: string; status: string }[];
};

function canOverrideBalance(role: string | undefined) {
  return role === "MANAGER" || role === "FINANCE" || role === "SUPER_ADMIN" || role === "HOTEL_ADMIN";
}

export default function StaffReservationDetailPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const reservationId = String(params.reservationId);
  const [folio, setFolio] = useState<Folio | null>(null);
  const [staffDetail, setStaffDetail] = useState<StaffReservationDetail | null>(null);
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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeType, setChargeType] = useState("MINIBAR");
  const [chargeDesc, setChargeDesc] = useState("");

  const user = typeof window !== "undefined" ? loadAuthUser() : null;

  const load = useCallback(async () => {
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      return;
    }
    try {
      const f = await apiFetch<Folio>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/folio`);
      setFolio(f);
      try {
        const d = await apiFetch<StaffReservationDetail>(
          `/api/v1/hotels/${hotelId}/reservations/${reservationId}/staff-detail`,
        );
        setStaffDetail(d);
      } catch {
        setStaffDetail(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load folio");
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
    try {
      const policy = await apiFetch<FeePolicy>(`/api/v1/hotels/${hotelId}/fee-policy`);
      setFees(policy);
      setCheckOutOpen(true);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not load fee policy" });
    }
  }

  async function submitCheckOut() {
    if (!minibarOk) return;
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          minibar_inspected: minibarOk,
          is_late_checkout: lateOut,
          override_balance_warning: overrideBal,
        }),
      });
      setCheckOutOpen(false);
      setBanner({ kind: "ok", text: "Checked out successfully." });
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
      if (msg.includes("NO_ROOM_ASSIGNED")) {
        hints.push("Assign a room before checkout.");
      }
      setBanner({
        kind: "err",
        text: hints.length ? `${msg} • ${hints.join(" ")}` : msg,
      });
    }
  }

  async function doCancel() {
    if (!confirm("Cancel this reservation?")) return;
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Staff cancelled via HMS UI" }),
      });
      setBanner({ kind: "ok", text: "Cancelled." });
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Cancel failed" });
    }
  }

  async function submitPayment() {
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setBanner(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          payment_type: "PARTIAL",
          method: paymentMethod,
          amount: amt,
          currency: folio?.summary.currency ?? "RWF",
          reference: paymentRef || null,
          notes: paymentNotes || null,
        }),
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentRef("");
      setPaymentNotes("");
      setBanner({ kind: "ok", text: "Payment recorded." });
      await load();
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
      await apiFetch(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/charges`, {
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
    try {
      const resp = await fetch(`${API_BASE}/api/v1/hotels/${hotelId}/reservations/${reservationId}/invoice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken() ?? ""}`,
          "X-Hotel-ID": hotelId,
        },
      });
      if (!resp.ok) {
        throw new Error(await resp.text());
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Invoice generation failed" });
    }
  }

  function printReservationDoc() {
    if (!folio) return;
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
    <div class="row"><span class="label">Stay:</span>${esc(folio.stay.checkIn)} → ${esc(folio.stay.checkOut)} (${esc(
      folio.stay.totalNights,
    )} nights)</div>
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
  const balance =
    typeof folio?.summary.balanceDue === "number"
      ? folio.summary.balanceDue
      : typeof folio?.summary.balance_due === "number"
        ? folio.summary.balance_due
        : 0;
  const canOverride = canOverrideBalance(user?.role);
  const hasAssignedRoom = Boolean(folio?.roomId);
  const statusOkForCheckout = st === "CHECKED_IN";
  const balanceOk = balance <= 0.01 || (canOverride && overrideBal);
  const blockedByBalance =
    balance > 0.01 &&
    (!canOverride || (canOverride && !overrideBal));

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
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <p className="text-sm mb-2">
          <Link href={staffAppPath("reservations")} className="text-primary">
            ← Reservations
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Reservation</h1>
        <p className="text-sm text-muted-foreground mt-1">Front desk reservation overview, actions, and folio.</p>
      </div>
      {staffDetail && (
        <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold" style={{ marginTop: 0 }}>Booking</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Reference</p>
              <p style={{ margin: 0 }}>
                <code
                  style={{ fontSize: "1.05rem", fontWeight: 700, cursor: "copy" }}
                  title="Click to copy"
                  onClick={() => void navigator.clipboard.writeText(staffDetail.booking_reference)}
                >
                  {staffDetail.booking_reference}
                </code>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Confirmation <span className="font-mono">{staffDetail.confirmation_code}</span> · Source{" "}
                <strong>{staffDetail.booking_source.replace(/_/g, " ")}</strong>
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Guest</p>
              <p style={{ margin: 0, fontWeight: 700 }}>{staffDetail.guest.full_name}</p>
              <p className="text-sm text-muted-foreground">
                National ID {staffDetail.guest.national_id} · DOB {staffDetail.guest.date_of_birth}
              </p>
              <p className="text-sm text-muted-foreground">
                {staffDetail.guest.email ?? "—"} · {staffDetail.guest.phone ?? "—"}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Guest address</p>
              <p className="text-sm" style={{ margin: 0 }}>
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
            <div className="rounded-xl border border-border/60 bg-background p-3">
              <p className="text-xs text-muted-foreground mb-1">Room status</p>
              {staffDetail.room ? (
                <p className="text-sm" style={{ margin: 0 }}>
                  Room <strong>{staffDetail.room.roomNumber}</strong> · status{" "}
                  <strong>{staffDetail.room.room_status ?? "—"}</strong> · cleanliness{" "}
                  <strong>{staffDetail.room.cleanliness}</strong>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground" style={{ margin: 0 }}>No room assigned.</p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-background p-3">
            <p className="text-xs text-muted-foreground mb-2">Timeline</p>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
              {staffDetail.timeline.map((t) => (
                <li key={t.phase + t.at}>
                  <strong>{t.phase}</strong> — {t.at ? t.at.slice(0, 19).replace("T", " ") : "—"}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {error && <div className="error panel">{error}</div>}
      {banner && (
        <div
          className="panel"
          style={{
            marginTop: "0.5rem",
            borderColor: banner.kind === "ok" ? "var(--success, #16a34a)" : "var(--destructive, #b91c1c)",
            color: banner.kind === "ok" ? "var(--success, #166534)" : "var(--destructive, #991b1b)",
          }}
        >
          {banner.text}
        </div>
      )}
      {folio && (
        <>
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Guest &amp; stay</h2>
            {(folio.booking_reference || folio.confirmationCode) && (
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>
                Ref <span className="font-mono font-semibold">{folio.booking_reference ?? folio.confirmationCode}</span>
              </p>
            )}
            <p style={{ margin: "0.25rem 0" }}>
              <strong>{folio.guest.name}</strong> · {folio.guest.email}
            </p>
            <p style={{ margin: "0.25rem 0", color: "var(--muted)" }}>
              {folio.stay.checkIn} → {folio.stay.checkOut} · {folio.stay.totalNights} nights ·{" "}
              {statusChip(folio.stay.reservationStatus)}
            </p>
            <p style={{ margin: "0.25rem 0" }}>
              Room <strong>{folio.roomNumber || "—"}</strong> ({folio.roomTypeName || "—"})
            </p>
            <p style={{ margin: "0.75rem 0 0", fontSize: "1.1rem" }}>
              Balance due:{" "}
              <strong>
                {balance} {folio.summary.currency}
              </strong>
            </p>
            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => document.getElementById("folio-block")?.scrollIntoView({ behavior: "smooth" })}
              >
                View Folio
              </button>
              <button
                type="button"
                onClick={printReservationDoc}
                style={{
                  background: "#0f766e",
                  color: "#fff",
                  border: "1px solid #0f766e",
                  fontWeight: 700,
                  boxShadow: "0 1px 0 rgba(0,0,0,.05)",
                }}
                title="Print full staff copy"
              >
                Print Staff Copy
              </button>
              <button type="button" onClick={() => setChargeOpen(true)}>
                + Add Charge
              </button>
              <button type="button" onClick={() => setPaymentOpen(true)}>
                + Record Payment
              </button>
              <button type="button" className="secondary" onClick={() => void printInvoicePdf()}>
                Print Invoice
              </button>
              {st === "CONFIRMED" && (
                <button type="button" onClick={() => void openCheckInModal()}>
                  Check in
                </button>
              )}
              {st === "CHECKED_IN" && (
                <button type="button" onClick={() => void openCheckOutModal()}>
                  Check out &amp; invoice
                </button>
              )}
              {st === "CONFIRMED" && (
                <button type="button" className="secondary" onClick={() => void doCancel()}>
                  Cancel reservation
                </button>
              )}
            </div>
          </div>
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm" id="folio-block">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
              FOLIO — {folio.booking_reference ?? folio.confirmationCode ?? folio.reservationId}
            </h2>
            <h3 style={{ marginBottom: "0.4rem" }}>Charges</h3>
            {folio.charges.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: 0 }}>No incidental charges yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {folio.charges.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>
                        {typeof c.date === "string"
                          ? c.date.slice(0, 16)
                          : c.date != null
                            ? JSON.stringify(c.date)
                            : "—"}
                      </td>
                      <td>{c.description}</td>
                      <td>
                        {c.amount} {folio.summary.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ marginTop: "0.8rem", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
              <p style={{ margin: "0.15rem 0" }}>
                Subtotal: <strong>{folio.summary.gross_total ?? 0}</strong> {folio.summary.currency}
              </p>
              <p style={{ margin: "0.15rem 0" }}>
                VAT (18%): <strong>{folio.summary.tax_total ?? 0}</strong> {folio.summary.currency}
              </p>
              <p style={{ margin: "0.15rem 0" }}>
                Grand Total: <strong>{folio.summary.grand_total ?? 0}</strong> {folio.summary.currency}
              </p>
            </div>
            <h3 style={{ margin: "0.9rem 0 0.35rem" }}>Payments</h3>
            {folio.payments?.length ? (
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {folio.payments.map((p, i) => (
                    <tr key={p.id ?? `${p.postedAt}-${i}`}>
                      <td>{p.postedAt?.slice(0, 16).replace("T", " ")}</td>
                      <td>{p.method}</td>
                      <td>{p.reference ?? "—"}</td>
                      <td>
                        {p.amount} {folio.summary.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "var(--muted)" }}>No payments recorded yet.</p>
            )}
            <p style={{ marginTop: "0.7rem", fontSize: "1.05rem" }}>
              Balance Due:{" "}
              <strong>
                {balance} {folio.summary.currency}
              </strong>
            </p>
          </div>
        </>
      )}

      {paymentOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div className="panel" style={{ maxWidth: 420, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Record payment</h3>
            <p style={{ margin: "0 0 0.6rem", fontSize: "0.85rem", color: "var(--muted)" }}>
              This reduces balance due.
            </p>
            <label>Amount</label>
            <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
            <label>Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {["CASH", "CARD", "MOBILE_MONEY", "BANK_TRANSFER"].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <label>Reference</label>
            <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} />
            <label>Notes</label>
            <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
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
          <div className="panel rounded-2xl border border-border/60 bg-card p-5 shadow-sm" style={{ maxWidth: 460, width: "100%" }}>
            <h3 style={{ marginTop: 0, marginBottom: "0.25rem" }}>Check out</h3>
            <p style={{ margin: "0 0 0.9rem", color: "var(--muted)", fontSize: "0.9rem" }}>
              Complete departure checks and finalize folio.
            </p>
            <p style={{ margin: "0 0 0.75rem" }}>
              <strong>Folio balance due:</strong> {balance} {folio.summary.currency}
            </p>
            {balance > 0.01 && (
              <p style={{ color: "#b91c1c", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Outstanding balance: {balance} {folio.summary.currency}. Collect payment before checkout.
              </p>
            )}
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
                <p style={{ margin: 0, fontWeight: 600 }}>Late checkout</p>
                <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
                  Apply if guest departs after standard time
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
            {lateOut && fees && (
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Fee: {fees.lateCheckoutFee} {fees.currency}
              </p>
            )}
            {balance > 0.01 && canOverride && (
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                <input type="checkbox" checked={overrideBal} onChange={(e) => setOverrideBal(e.target.checked)} />
                Override — proceed anyway (manager / finance)
              </label>
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
                <li style={{ color: balanceOk ? "#166534" : "#991b1b" }}>
                  {balanceOk ? "OK" : "Missing"} — Folio balance must be settled, or authorized override enabled.
                </li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setCheckOutOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!minibarOk || blockedByBalance || !statusOkForCheckout || !hasAssignedRoom}
                onClick={() => void submitCheckOut()}
              >
                Confirm check-out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
