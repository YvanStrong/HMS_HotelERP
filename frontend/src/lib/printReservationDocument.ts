/** Shared reservation confirmation print / save-as-HTML (front desk + guest portal). */

export type ReservationPrintGuest = {
  name: string;
  email?: string | null;
  phone?: string | null;
  phoneCc?: string | null;
  nationalId?: string | null;
  dob?: string | null;
  nationality?: string | null;
  gender?: string | null;
  country?: string | null;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  cell?: string | null;
  village?: string | null;
  streetNumber?: string | null;
  addressNotes?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  idExpiry?: string | null;
  vipLevel?: string | null;
  marketingConsent?: boolean;
  notes?: string | null;
};

export type ReservationPrintStay = {
  reservationId: string;
  confirmationCode: string;
  bookingReference: string;
  status: string;
  roomTypeName?: string | null;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children?: number;
  specialRequests?: string | null;
  message?: string | null;
  /** e.g. nightly, taxes, balance */
  pricingLines?: { label: string; value: string }[];
};

export type ReservationPrintStaffExtras = {
  earlyCheckIn?: boolean;
  preferredRoomLabel?: string | null;
  depositLabel?: string | null;
  paymentMethodLabel?: string | null;
};

export type ReservationPrintParams = {
  variant: "guest" | "staff";
  hotelName: string;
  sourceLabel: string;
  guest: ReservationPrintGuest;
  stay: ReservationPrintStay;
  staffExtras?: ReservationPrintStaffExtras | null;
};

function esc(v: unknown) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function row(label: string, value: string) {
  return `<div class="row"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div></div>`;
}

export function buildReservationPrintHtml(p: ReservationPrintParams): string {
  const { variant, hotelName, sourceLabel, guest, stay, staffExtras } = p;
  const standardCheckInTime = "15:00:00";
  const standardCheckOutTime = "11:00:00";
  const checkInWithTime = `${stay.checkIn} ${standardCheckInTime}`;
  const checkOutWithTime = `${stay.checkOut} ${standardCheckOutTime}`;
  const watermark =
    variant === "staff" ? "Confidential / Staff Copy" : "Guest reservation copy";
  const docTitle = `Reservation-${stay.bookingReference || stay.confirmationCode}`;

  const pricingRows =
    stay.pricingLines?.map((line) => row(line.label, line.value)).join("") ?? "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(docTitle)}</title>
  <style>
    :root { --ink: #0f172a; --muted: #475569; --line: #dbe1ea; --soft: #f8fafc; }
    * { box-sizing: border-box; }
    body { font-family: "Inter", "Segoe UI", Arial, sans-serif; margin: 0; color: var(--ink); background: white; padding: 28px; }
    .sheet { max-width: 860px; margin: 0 auto; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
    .header {
      background: linear-gradient(130deg, #0f766e 0%, #115e59 60%, #134e4a 100%);
      color: #fff; padding: 24px; display: flex; justify-content: space-between; gap: 20px;
    }
    .brand { font-size: 12px; letter-spacing: .16em; text-transform: uppercase; opacity: .92; margin-bottom: 8px; }
    .hotel { font-size: 24px; font-weight: 700; line-height: 1.2; }
    .title { font-size: 14px; opacity: .95; margin-top: 8px; }
    .ref-wrap { text-align: right; min-width: 220px; }
    .ref-label { font-size: 12px; opacity: .9; text-transform: uppercase; letter-spacing: .08em; }
    .ref { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 22px; font-weight: 700; }
    .body { padding: 22px; background: var(--soft); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .card { background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 14px 15px; }
    .card h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .row { display: grid; grid-template-columns: 130px 1fr; gap: 8px; margin: 6px 0; font-size: 14px; }
    .label { color: var(--muted); } .value { font-weight: 600; }
    .message { margin-top: 14px; background: #ecfeff; border: 1px solid #99f6e4; color: #115e59; padding: 12px 14px; border-radius: 10px; font-size: 13px; line-height: 1.4; }
    .footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; border-top: 1px solid var(--line); padding: 12px 22px; background: #fff; color: var(--muted); font-size: 12px; }
    .watermark {
      position: fixed; top: 44%; left: 50%; transform: translate(-50%, -50%) rotate(-28deg);
      font-size: 48px; font-weight: 800; letter-spacing: .14em; color: rgba(15, 118, 110, 0.08); text-transform: uppercase;
      pointer-events: none; user-select: none; white-space: nowrap; z-index: 0;
    }
    .sheet, .header, .body, .footer { position: relative; z-index: 1; }
    .signatures { margin-top: 14px; background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sig-title { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; }
    .sig-line { border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 12px; color: #334155; }
    @media print { body { padding: 0; } .sheet { border: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="watermark">${esc(watermark)}</div>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="brand">HMS • Reservation</div>
        <div class="hotel">${esc(hotelName)}</div>
        <div class="title">Reservation confirmation</div>
      </div>
      <div class="ref-wrap">
        <div class="ref-label">Booking reference</div>
        <div class="ref">${esc(stay.bookingReference || "—")}</div>
      </div>
    </div>
    <div class="body">
      <div class="grid">
        <div class="card">
          <h3>Guest</h3>
          ${row("Name", guest.name)}
          ${row("Email", guest.email || "—")}
          ${row("Phone", guest.phone || "—")}
          ${row("Phone code", guest.phoneCc || "—")}
          ${row("National ID", guest.nationalId || "—")}
          ${row("Date of birth", guest.dob || "—")}
          ${row("Nationality", guest.nationality || "—")}
          ${row("Gender", guest.gender ? guest.gender.replaceAll("_", " ") : "—")}
          ${row("Reservation ID", stay.reservationId)}
          ${row("Confirmation", stay.confirmationCode)}
          ${row("Status", stay.status)}
        </div>
        <div class="card">
          <h3>Stay</h3>
          ${row("Source", sourceLabel)}
          ${row("Room type", stay.roomTypeName || "—")}
          ${row("Room", stay.roomNumber)}
          ${row("Check-in", checkInWithTime)}
          ${row("Check-out", checkOutWithTime)}
          ${row("Nights", String(stay.nights))}
          ${row("Adults", String(stay.adults))}
          ${row("Children", String(stay.children ?? 0))}
          ${staffExtras?.earlyCheckIn != null ? row("Early check-in", staffExtras.earlyCheckIn ? "Yes" : "No") : ""}
          ${staffExtras?.preferredRoomLabel != null ? row("Preferred room", staffExtras.preferredRoomLabel) : ""}
          ${row("Special requests", stay.specialRequests || "—")}
          ${staffExtras?.depositLabel != null ? row("Deposit", staffExtras.depositLabel) : ""}
          ${staffExtras?.paymentMethodLabel != null ? row("Payment method", staffExtras.paymentMethodLabel) : ""}
        </div>
      </div>
      <div class="grid" style="margin-top: 14px;">
        <div class="card">
          <h3>Address</h3>
          ${row("Country", guest.country || "—")}
          ${row("Province", guest.province || "—")}
          ${row("District", guest.district || "—")}
          ${row("Sector", guest.sector || "—")}
          ${row("Cell", guest.cell || "—")}
          ${row("Village", guest.village || "—")}
          ${row("Street no.", guest.streetNumber || "—")}
          ${row("Address notes", guest.addressNotes || "—")}
        </div>
        <div class="card">
          <h3>ID &amp; profile</h3>
          ${row("ID type", guest.idType || "—")}
          ${row("ID number", guest.idNumber || "—")}
          ${row("ID expiry", guest.idExpiry || "—")}
          ${row("VIP level", guest.vipLevel || "NONE")}
          ${row("Marketing consent", guest.marketingConsent ? "Yes" : "No")}
          ${row("Notes", guest.notes || "—")}
          ${pricingRows}
        </div>
      </div>
      ${stay.message ? `<div class="message">${esc(stay.message)}</div>` : ""}
      <div class="signatures">
        <div>
          <div class="sig-title">Guest signature</div>
          <div class="sig-line">Name &amp; signature</div>
        </div>
        <div>
          <div class="sig-title">${variant === "staff" ? "Receptionist signature" : "Hotel use"}</div>
          <div class="sig-line">${variant === "staff" ? "Name, signature & date" : "Present this document at check-in"}</div>
        </div>
      </div>
    </div>
    <div class="footer">
      <span>Generated ${esc(new Date().toLocaleString())}</span>
      <span>${esc(hotelName)} • HMS</span>
    </div>
  </div>
</body>
</html>`;
}

export function openReservationPrintWindow(html: string, docTitle: string) {
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
  a.download = `${docTitle.replace(/[^\w.-]+/g, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printReservationDocument(params: ReservationPrintParams) {
  const html = buildReservationPrintHtml(params);
  const title = `Reservation-${params.stay.bookingReference || params.stay.confirmationCode}`;
  openReservationPrintWindow(html, title);
}
