"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";
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
    roomCharges?: number;
    consumptionCharges?: number;
    subtotal?: number;
    taxes?: number;
    fees?: number;
    depositPaid?: number;
    totalPayments?: number;
    totalCharges?: number;
    balanceDue: number;
    currency: string;
  };
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
  };
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
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentTypesUsed, setPaymentTypesUsed] = useState("");

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
      if (selectedRoomId) body.room_id = selectedRoomId;
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
    setMinibarOk(false);
    setLateOut(false);
    setOverrideBal(false);
    setPaymentMethod("CASH");
    setPaymentTypesUsed("");
    setPaymentAmount(
      folio?.summary.balanceDue && folio.summary.balanceDue > 0 ? String(folio.summary.balanceDue) : "0",
    );
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
      const paid = Number(paymentAmount || "0");
      const result = await apiFetch<CheckOutResponse>(`/api/v1/hotels/${hotelId}/reservations/${reservationId}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          minibar_inspected: true,
          is_late_checkout: lateOut,
          override_balance_warning: overrideBal,
          finalPayment: {
            method: paymentTypesUsed.trim() || paymentMethod,
            amount: Number.isFinite(paid) ? paid : 0,
            transactionId: null,
          },
        }),
      });
      setCheckOutOpen(false);
      setBanner({ kind: "ok", text: "Checked out successfully." });
      printInvoiceDoc(result);
      await load();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Check-out failed" });
    }
  }

  function printInvoiceDoc(result: CheckOutResponse) {
    if (!folio) return;
    /** Printed doc is `about:blank` — relative `/images/...` won't load; use absolute URLs from this app origin. */
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const assetUrl = (path: string) =>
      `${origin}${path.startsWith("/") ? path : `/${path}`}`;
    const esc = (v: unknown) =>
      String(v ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    const depositPaid = folio.summary.depositPaid ?? 0;
    const totalCharges = folio.summary.totalCharges ?? 0;
    const remainingBeforePayment = Math.max(0, totalCharges - depositPaid);
    const paid = Number(paymentAmount || "0");
    const dueAfterPayment = Math.max(0, remainingBeforePayment - paid);
    const checkoutAt = new Date().toLocaleString();
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Invoice ${esc(result.invoice.invoiceNumber)}</title>
    <style>
    body{font-family:Arial,sans-serif;margin:20px;color:#111}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
    .brand{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .logo-img{height:52px;width:auto;object-fit:contain;display:block}
    .inv{border:1px solid #e2e8f0;border-radius:10px;padding:14px}
    .row{display:flex;justify-content:space-between;margin:6px 0}
    .muted{color:#64748b}
    .strong{font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border-bottom:1px solid #e2e8f0;padding:8px;text-align:left}
    tfoot td{font-weight:700}
    </style></head><body>
    <div class="top">
      <div class="brand">
        <img class="logo-img" src="${esc(assetUrl("/images/RRA_LOGO.png"))}" alt="RRA" />
        <img class="logo-img" src="${esc(assetUrl("/images/rraLogo2.png"))}" alt="RRA" />
      </div>
      <img class="logo-img" style="height:56px" src="${esc(assetUrl("/images/logoubumwe.png"))}" alt="Ubumwe Grand Hotel" />
    </div>
    <h2>Tax Invoice</h2>
    <div class="inv">
      <div class="row"><span class="muted">Invoice #</span><span class="strong">${esc(result.invoice.invoiceNumber)}</span></div>
      <div class="row"><span class="muted">Booking reference</span><span>${esc(staffDetail?.booking_reference ?? folio.booking_reference ?? "—")}</span></div>
      <div class="row"><span class="muted">Guest</span><span>${esc(folio.guest.name)}</span></div>
      <div class="row"><span class="muted">Room</span><span>${esc(folio.roomNumber || "—")} (${esc(folio.roomTypeName || "—")})</span></div>
      <div class="row"><span class="muted">Checkout time</span><span>${esc(checkoutAt)}</span></div>
      <table>
        <thead><tr><th>Description</th><th>Amount (${esc(folio.summary.currency)})</th></tr></thead>
        <tbody>
          ${result.invoice.items
            .map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.amount)}</td></tr>`)
            .join("")}
        </tbody>
      </table>
      <div class="row"><span class="muted">Total charges</span><span>${esc(totalCharges)} ${esc(folio.summary.currency)}</span></div>
      <div class="row"><span class="muted">Deposit paid</span><span>- ${esc(depositPaid)} ${esc(folio.summary.currency)}</span></div>
      <div class="row"><span class="muted">Remaining before checkout payment</span><span>${esc(remainingBeforePayment)} ${esc(folio.summary.currency)}</span></div>
      <div class="row"><span class="muted">Paid at checkout (${esc(paymentMethod)})</span><span>- ${esc(paid)} ${esc(folio.summary.currency)}</span></div>
      <div class="row"><span class="muted">Payment types used</span><span>${esc(paymentTypesUsed || paymentMethod)}</span></div>
      <div class="row strong"><span>Balance after payment</span><span>${esc(dueAfterPayment)} ${esc(folio.summary.currency)}</span></div>
    </div>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
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
    body{font-family:Arial,sans-serif;margin:20px;color:#111;position:relative}
    .watermark{position:fixed;top:45%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:56px;font-weight:800;letter-spacing:.16em;color:rgba(15,118,110,.09);text-transform:uppercase;white-space:nowrap;pointer-events:none;user-select:none;z-index:0}
    .wrap{position:relative;z-index:1}
    .card{border:1px solid #ddd;border-radius:8px;padding:14px;max-width:900px;background:#fff}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-width:900px}
    .row{margin:6px 0}.label{font-weight:700;display:inline-block;min-width:170px}
    h1{margin:0 0 8px}.muted{color:#555}
    .signatures{max-width:900px;margin-top:10px;border:1px solid #ddd;border-radius:8px;padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#fff}
    .sig-title{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px}
    .sig-line{border-top:1px solid #9ca3af;padding-top:4px;font-size:12px;color:#374151}
    @media print{.grid{grid-template-columns:1fr 1fr}}
    </style></head><body>
    <div class="watermark">Confidential / Staff Copy</div>
    <div class="wrap">
    <h1>Reservation Confirmation</h1>
    <p class="muted">Generated on ${esc(new Date().toLocaleString())}</p>
    <div class="grid">
    <div class="card">
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
    <div class="row"><span class="label">Check-in:</span>${esc(checkInWithTime)}</div>
    <div class="row"><span class="label">Check-out:</span>${esc(checkOutWithTime)}</div>
    <div class="row"><span class="label">Stay:</span>${esc(folio.stay.totalNights)} nights</div>
    <div class="row"><span class="label">Status:</span>${esc(folio.stay.reservationStatus)}</div>
    <div class="row"><span class="label">Deposit paid:</span>${esc(folio.summary.depositPaid ?? 0)} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Total charges:</span>${esc(folio.summary.totalCharges ?? "—")} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Total payments:</span>${esc(folio.summary.totalPayments ?? "—")} ${esc(
      folio.summary.currency,
    )}</div>
    <div class="row"><span class="label">Balance due:</span>${esc(folio.summary.balanceDue)} ${esc(
      folio.summary.currency,
    )}</div>
    </div>
    <div class="card">
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
      <div style="font-weight:700;margin-bottom:6px">Booking Timeline</div>
      ${timelineRows}
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
  const balance = folio?.summary.balanceDue ?? 0;
  const blockedByBalance =
    balance > 0.01 &&
    (!canOverrideBalance(user?.role) || (canOverrideBalance(user?.role) && !overrideBal));

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
    <>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link href={staffAppPath("reservations")}>← Reservations</Link>
      </p>
      <h1>Reservation</h1>
      {staffDetail && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Booking</h2>
          <p style={{ margin: "0.35rem 0" }}>
            <span style={{ color: "var(--muted)" }}>Reference </span>
            <code
              style={{ fontSize: "1.15rem", fontWeight: 700, cursor: "copy" }}
              title="Click to copy"
              onClick={() => void navigator.clipboard.writeText(staffDetail.booking_reference)}
            >
              {staffDetail.booking_reference}
            </code>
          </p>
          <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "var(--muted)" }}>
            Confirmation <span className="font-mono">{staffDetail.confirmation_code}</span> · Source{" "}
            <strong>{staffDetail.booking_source.replace(/_/g, " ")}</strong>
          </p>
          <h3 style={{ marginTop: "1rem", fontSize: "1rem" }}>Guest (full profile)</h3>
          <p style={{ margin: "0.2rem 0" }}>
            <strong>{staffDetail.guest.full_name}</strong> · National ID {staffDetail.guest.national_id} · DOB{" "}
            {staffDetail.guest.date_of_birth}
          </p>
          <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>
            {staffDetail.guest.email ?? "—"} · {staffDetail.guest.phone ?? "—"}
          </p>
          <h3 style={{ marginTop: "1rem", fontSize: "1rem" }}>Guest Address</h3>
          <p style={{ margin: "0.2rem 0", fontSize: "0.9rem" }}>
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
            <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "var(--muted)" }}>
              {staffDetail.guest_address.address_notes}
            </p>
          )}
          {staffDetail.room && (
            <p style={{ marginTop: "0.75rem" }}>
              Room <strong>{staffDetail.room.roomNumber}</strong> · status{" "}
              <strong>{staffDetail.room.room_status ?? "—"}</strong> · cleanliness{" "}
              <strong>{staffDetail.room.cleanliness}</strong>
            </p>
          )}
          <h3 style={{ marginTop: "1rem", fontSize: "1rem" }}>Timeline</h3>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.9rem" }}>
            {staffDetail.timeline.map((t) => (
              <li key={t.phase + t.at}>
                <strong>{t.phase}</strong> — {t.at ? t.at.slice(0, 19).replace("T", " ") : "—"}
              </li>
            ))}
          </ul>
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
          <div className="panel">
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
                {folio.summary.balanceDue} {folio.summary.currency}
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
          <div className="panel" id="folio-block">
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Posted charges (folio)</h2>
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
          </div>
        </>
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
          <div className="panel" style={{ maxWidth: 420, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Check in</h3>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>Room</label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              style={{ width: "100%", marginBottom: "1rem", padding: "0.5rem" }}
            >
              <option value="">Keep / assign later…</option>
              {roomChoices.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} ({r.id === folio?.roomId ? "current" : "available"})
                </option>
              ))}
            </select>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={guestIdOk} onChange={(e) => setGuestIdOk(e.target.checked)} />
              Guest ID verified (required)
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <input type="checkbox" checked={earlyIn} onChange={(e) => setEarlyIn(e.target.checked)} />
              Early check-in?
            </label>
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
          <div className="panel" style={{ maxWidth: 440, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>Check out</h3>
            <p style={{ margin: "0 0 0.75rem" }}>
              <strong>Folio balance due:</strong> {balance} {folio.summary.currency}
            </p>
            {balance > 0.01 && (
              <p style={{ color: "#b91c1c", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                Outstanding balance: {balance} {folio.summary.currency}. Collect payment before checkout.
              </p>
            )}
            <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>
              Deposit paid: <strong>{folio.summary.depositPaid ?? 0}</strong> {folio.summary.currency}
            </p>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.75rem" }}>
              Remaining to collect now: <strong>{Math.max(0, balance)}</strong> {folio.summary.currency}
            </p>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Amount paid at checkout
              <input
                type="number"
                min={0}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                style={{ width: "100%", marginTop: "0.35rem" }}
              />
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Payment method
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: "100%", marginTop: "0.35rem" }}
              >
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="BANK_TRANSFER">BANK TRANSFER</option>
                <option value="MOBILE_MONEY">MOBILE MONEY</option>
                <option value="MIXED">MIXED</option>
              </select>
            </label>
            <label style={{ display: "block", marginBottom: "0.75rem" }}>
              Payment types used (optional)
              <input
                value={paymentTypesUsed}
                onChange={(e) => setPaymentTypesUsed(e.target.value)}
                placeholder="e.g. CASH + CARD"
                style={{ width: "100%", marginTop: "0.35rem" }}
              />
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
              <input type="checkbox" checked={minibarOk} onChange={(e) => setMinibarOk(e.target.checked)} />
              Minibar inspected (required)
            </label>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              <input type="checkbox" checked={lateOut} onChange={(e) => setLateOut(e.target.checked)} />
              Late checkout?
            </label>
            {lateOut && fees && (
              <p style={{ fontSize: "0.9rem", color: "var(--muted)", marginBottom: "0.75rem" }}>
                Fee: {fees.lateCheckoutFee} {fees.currency}
              </p>
            )}
            {balance > 0.01 && canOverrideBalance(user?.role) && (
              <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
                <input type="checkbox" checked={overrideBal} onChange={(e) => setOverrideBal(e.target.checked)} />
                Override — proceed anyway (manager / finance)
              </label>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setCheckOutOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!minibarOk || blockedByBalance}
                onClick={() => void submitCheckOut()}
              >
                Confirm check-out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
