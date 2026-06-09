/** Staff-facing labels and tooltip hints for group / banquet workflows. */

export const GROUP_CREATE_COPY = {
  bookingKind: "What does this group include?",
  roomBlock:
    "Room block — overnight stays (reservations, rooming list, check-in). Use Demand sketch to match inventory.",
  functionsOnly:
    "Functions only — banquet/catering and billing for the day (no room block or rooming list). Charges go to an event guest bill.",
  functionDates: "Function dates (optional)",
  functionDatesHint:
    "Used for scheduling and the event guest bill window — not a room inventory hold. Same start and end date is fine for a one-day wedding or meeting.",
  createRoomBlock: "Create group & book block",
  createFunctionsOnly: "Create functions-only group",
} as const;

export const GROUP_WORKFLOW_HINT =
  "Use Back and Next to move through the group setup in order. You can still click any step number above to jump.";

export const GROUP_TABS = {
  overview: { label: "Overview", hint: "Group name, contact, target room dates, and notes for the whole booking." },
  rooms: { label: "Rooms", hint: "Room reservations linked to this group (rooming list)." },
  events: { label: "Functions", hint: "Banquets, meetings, and other functions with their own date, venue, and guest count." },
  packages: { label: "Catering & quote", hint: "Build catering lines and send a price quote to the client for the selected function." },
  beo: { label: "Banquet order", hint: "Internal operations sheet for kitchen, housekeeping, and events team (not the client invoice)." },
  billing: { label: "Billing", hint: "Master guest bill, corporate account, and event charges posted to the folio." },
} as const;

export const EVENT_FIELDS = {
  eventName: { label: "Function name", hint: "What you call this function on the program (e.g. Gala dinner)." },
  eventType: { label: "Function type", hint: "Category for reporting: conference, wedding, gala, etc." },
  status: {
    label: "Function status",
    hint: "Tentative = not final. Confirmed = space held. Cancelled = function will not run.",
  },
  startDatetime: { label: "Starts", hint: "When the function begins (include setup time if the room is blocked early)." },
  endDatetime: { label: "Ends", hint: "When the function ends. Must be after the start time." },
  venue: {
    label: "Meeting space / ballroom",
    hint:
      "Hotel spaces you set up under Facilities (pool deck, main ballroom, restaurant). Pick one to block the calendar and check double-bookings. Leave as “not chosen yet” if the space is still TBD.",
  },
  venueTbdOption: "Not chosen yet (space TBD)",
  venueEmptyHint:
    "No facilities found for this hotel. Add ballrooms and meeting rooms under Facilities first, then refresh this page.",
  setupStyle: {
    label: "Room setup (layout)",
    hint:
      "How chairs and tables are arranged — not a room type. Examples: banquet rounds, classroom rows, theater, U-shape, cocktail (no tables). Housekeeping uses this on the banquet order.",
  },
  expectedPax: {
    label: "Expected guests",
    hint: "How many people you plan for (headcount for planning and quotes).",
  },
  guaranteedPax: {
    label: "Guaranteed guests",
    hint: "Minimum number the client pays for; often used for catering quantity.",
  },
  coordinatorNotes: { label: "Coordinator notes", hint: "Internal notes for your team (VIP, timing, on-site contact)." },
} as const;

export const CATERING_QUOTE_COPY = {
  stepsBanner:
    "Add catering lines here — the quote updates automatically. Then use Next to continue: mark sent → accepted → contract on Billing.",
  deliveryNote:
    "HMS does not email the client. After contract, download the billing PDF (proforma, delivery note, or invoice based on payments) and send it yourself. Buttons below only record your progress.",
  manageCatalog: "Manage catering packages",
  packagePerGuest: "Catering package (price per guest)",
  depotItem: "Stock / menu item (single product)",
  quantity: "Quantity (guests or units)",
  addLine: "Add catering line",
  discount: { label: "Discount amount", hint: "Fixed amount subtracted from the quote total (not a percentage)." },
  deposit: { label: "Deposit required", hint: "Advance payment you want before the event (full amount, not a percentage)." },
  createDraft: "Create draft quote",
  recalculate: "Recalculate & save",
  markSent: "I sent the quote (manual)",
  acceptQuote: "Client agreed (manual)",
  contract: "Contracted — post to guest bill",
  printableQuote: "Download billing PDF",
  noPackages:
    "No catering packages yet. Add them under Settings → Catering packages (linked above), then return here.",
  sentInfo: "Status updated. After contract, the billing document appears on Invoices and can be downloaded here.",
} as const;

export const BEO_COPY = {
  title: "Banquet orders (internal)",
  intro:
    "For kitchen, housekeeping, and events — not sent to the guest. After the quote is marked sent, generate an order here and download the PDF for departments.",
  deliveryNote: "This is an internal run sheet. HMS does not send it to the client or to departments automatically.",
  generate: "Generate banquet order",
  viewPrint: "Download banquet order PDF",
  editNotes: "Edit department notes",
  needQuote: "Mark the quote sent on Catering & quote first, then generate here.",
} as const;

export const BILLING_COPY = {
  eventCharges: "Function charges",
  eventChargesHint:
    "Totals from function quotes. Charges go onto one group room stay (master guest bill). Link a master room below, then mark the quote Contracted — posting usually happens automatically.",
  masterFolio: "Master guest bill",
  masterFolioHint:
    "Pick one in-house (or upcoming) reservation for this group. All group function charges post to that room's guest bill. Use Rooms tab to add reservations, then Set master here.",
  masterRequiredAlert:
    "Link a master room before function charges can post. Booking a room block sets the first room as master automatically; for older groups use Set master on the Rooms tab.",
  functionsOnlyBilling:
    "Functions-only group — billing is for catering, venue, and quote charges only (no room nights). Event guest bill is created automatically.",
  functionsOnlyNoMaster:
    "Event guest bill is not set up yet. Save the group again or contact support.",
  roomsCheckInAll: "Check in all",
  roomsSetMaster: "Set master guest bill",
  roomsCheckInOne: "Check in",
  postCharges: "Post to guest bill",
  postChargesRetry: "Retry post to guest bill",
  postRequiresMaster: "Link a master room on this page first (section below).",
  postRequiresContract: "Mark the quote Contracted on the Catering & quote tab (charges usually post automatically).",
  quoted: "Quoted",
  accepted: "Marked accepted",
  posted: "On guest bill",
  balance: "Balance due",
  needsMaster: "Needs master room",
  contractFirst: "Contract first",
  eventGuestBill: "Event guest bill",
  eventGuestBillHint:
    "Created automatically for this functions-only group. Contracted quote charges (catering, venue, etc.) post here — no room nights.",
  openEventGuestBill: "Open guest bill",
  functionsOnlyBalance: "Balance due on event guest bill",
  functionsOnlyCorporateHint:
    "Optional company profile for invoicing this event. Link an account below if the client pays on account.",
  functionsOnlyLinkCorporate: "Link corporate account",
} as const;

/** Format quote status for display (internal workflow — not automatic delivery). */
export function formatQuoteStatus(status: string | null | undefined): string {
  if (!status) return "";
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "SENT":
      return "Marked sent";
    case "ACCEPTED":
      return "Marked accepted";
    case "CONTRACTED":
      return "Contracted";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replaceAll("_", " ");
  }
}

export function quoteStatusHint(status: string | null | undefined): string {
  if (!status) return "";
  switch (status) {
    case "DRAFT":
      return "Not shared yet. Build lines, then print/send when ready.";
    case "SENT":
      return CATERING_QUOTE_COPY.deliveryNote;
    case "ACCEPTED":
      return "You recorded that the client agreed. Generate a banquet order if needed, then Contract to bill.";
    case "CONTRACTED":
      return "Agreement recorded; catering charges should appear on the master guest bill.";
    case "CANCELLED":
      return "Quote cancelled.";
    default:
      return "";
  }
}

export function formatBeoStatus(status: string | null | undefined): string {
  if (!status) return "";
  switch (status) {
    case "DRAFT":
      return "Draft (internal)";
    case "DISTRIBUTED":
      return "Shared internally";
    case "REVISED":
      return "Revised";
    case "LOCKED":
      return "Locked";
    case "COMPLETED":
      return "Completed";
    default:
      return status.replaceAll("_", " ");
  }
}

export function beoStatusHint(status: string | null | undefined): string {
  if (!status) return BEO_COPY.deliveryNote;
  switch (status) {
    case "DRAFT":
      return "Internal ops sheet — print and give to kitchen/housekeeping/events.";
    case "DISTRIBUTED":
      return "You marked it shared with departments (HMS does not send automatically).";
    default:
      return BEO_COPY.deliveryNote;
  }
}
