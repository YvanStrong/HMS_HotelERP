/** Lightweight FAQ knowledge for the in-app help chatbot. */

export type HelpFaq = {
  id: string;
  /** Short chip / suggestion label */
  title: string;
  /** Keywords / phrases used for matching (lowercase). */
  keywords: string[];
  answer: string;
  /** Optional route segments that boost this FAQ when the user is on that page. */
  routes?: string[];
};

export const HELP_FAQS: HelpFaq[] = [
  {
    id: "check-in",
    title: "How do I check in a guest?",
    keywords: ["check in", "check-in", "checkin", "arrive", "arrival"],
    routes: ["reservations"],
    answer:
      "Open Reservations, find the booking, then use Check-in. The guest must have a room assigned and the reservation should be Confirmed. After check-in, folio charges and room status update automatically.",
  },
  {
    id: "check-out",
    title: "How do I check out?",
    keywords: ["check out", "check-out", "checkout", "depart", "departure", "settle"],
    routes: ["reservations"],
    answer:
      "Open the reservation while Checked-in, settle any folio balance (or use an authorized override), confirm minibar inspection if required, then Check out. A tax invoice can print after checkout when payment is recorded.",
  },
  {
    id: "pos-sale",
    title: "How do I sell on POS?",
    keywords: ["pos", "sell", "sale", "checkout", "cash", "momo", "cart", "restaurant"],
    routes: ["pos"],
    answer:
      "Go to POS, pick an outlet, add items to the cart, then complete payment (Cash, MoMo, card, bank, or charge to room). An invoice prints after payment. Proformas and delivery notes are available from the same screen.",
  },
  {
    id: "refund",
    title: "How do refunds work?",
    keywords: ["refund", "return", "credit note", "cancel invoice"],
    routes: ["invoices", "pos"],
    answer:
      "Managers and admins can refund from Invoices. Open the invoice (POS, reservation, or facility), choose Refund, and enter a reason. POS refunds restore stock. If EBM is active, a fiscal credit note is queued after the refund.",
  },
  {
    id: "invoice-print",
    title: "How do I print an invoice?",
    keywords: ["print", "invoice", "pdf", "receipt", "reprint"],
    routes: ["invoices", "reservations"],
    answer:
      "On Invoices, select a row and use Print. From a reservation, use Print invoice after checkout. If EBM returned SDC data, the printout includes SDC INFORMATION and a QR code; RRA logos appear only when EBM is activated.",
  },
  {
    id: "ebm",
    title: "What is EBM / RRA?",
    keywords: ["ebm", "rra", "vsdc", "osdc", "fiscal", "sdc", "tax", "tin"],
    routes: ["settings"],
    answer:
      "EBM (Electronic Billing Machine) sends sales to RRA via VSDC/OSDC. Configure it under Settings → EBM: register the device, set the endpoint, and initialize. When enabled, invoices and refunds get fiscal receipt data after acknowledgement.",
  },
  {
    id: "duty",
    title: "How do duty shifts work?",
    keywords: ["duty", "shift", "roster", "schedule", "on duty", "attendance"],
    routes: ["duty"],
    answer:
      "Admins and managers use Duty & shifts to schedule Morning / Afternoon / Night / Custom shifts, filter by date or status, and track check-in / check-out history for staff.",
  },
  {
    id: "subscription",
    title: "How do I renew or upgrade?",
    keywords: ["subscription", "renew", "upgrade", "plan", "billing", "starter", "professional", "enterprise"],
    routes: ["subscription"],
    answer:
      "Open Subscription to see your plan and dates. You can request a mid-cycle renew or upgrade; platform admin confirms payment. Public pricing is also listed on the /pricing page.",
  },
  {
    id: "rooms",
    title: "How do room statuses work?",
    keywords: ["room status", "dirty", "clean", "vacant", "occupied", "ooo", "housekeeping"],
    routes: ["rooms", "housekeeping"],
    answer:
      "Rooms show occupancy and cleanliness (e.g. vacant/clean, occupied, dirty). Housekeeping updates cleanliness; check-in/out updates occupancy. Room Blocks hold inventory for groups or maintenance.",
  },
  {
    id: "inventory",
    title: "Where is stock managed?",
    keywords: ["inventory", "stock", "warehouse", "depot", "purchase", "product"],
    routes: ["inventory"],
    answer:
      "Use Inventory for warehouses, items, purchases, and stock movements. POS outlets (depots) sell from depot products linked to inventory items; refunds restore depot stock.",
  },
  {
    id: "self-order",
    title: "How does guest self-order work?",
    keywords: ["self order", "self-order", "qr", "guest order", "kitchen"],
    routes: ["self-orders", "pos"],
    answer:
      "Guests order from the public self-order link (QR). Staff see orders under Self orders and POS toasts. Kitchen / pickup boards can hide guest names in settings if needed.",
  },
  {
    id: "staff-access",
    title: "Who can access which menus?",
    keywords: ["permission", "role", "access", "staff", "nav", "sidebar", "locked"],
    routes: ["staff", "settings"],
    answer:
      "Sidebar items depend on role and module entitlements. Admins manage staff under Staff. If a module is greyed out or shows “disabled”, check Subscription / platform entitlements for this hotel.",
  },
  {
    id: "theme",
    title: "How do I switch light/dark mode?",
    keywords: ["theme", "dark", "light", "mode", "appearance"],
    answer:
      "Use the theme toggle in the sidebar (or public header). It cycles Light → Dark → System and remembers your preference in the browser.",
  },
  {
    id: "bug",
    title: "How do I report a bug?",
    keywords: ["bug", "error", "broken", "issue", "report", "screenshot"],
    answer:
      "Use Report bug in the sidebar. Add a short title, description, severity, and optional screenshot. Platform admins review reports in the platform Bugs inbox.",
  },
  {
    id: "groups",
    title: "How do groups & events work?",
    keywords: ["group", "event", "block", "wedding", "conference"],
    routes: ["groups"],
    answer:
      "Groups & Events manages group blocks, linked reservations, and event billing documents. Create a group, attach rooms/reservations, then issue billing from the group workspace.",
  },
];

const FALLBACK =
  "I can help with short how-to questions about this hotel system (reservations, POS, invoices, EBM, duty, subscription, inventory). Try a suggested question below, or rephrase in a few words. For product bugs, use Report bug in the sidebar.";

function normalize(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^\w\s%/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreFaq(faq: HelpFaq, q: string, routeHint: string | null): number {
  let score = 0;
  for (const kw of faq.keywords) {
    if (q.includes(kw)) score += kw.length >= 8 ? 4 : kw.split(" ").length > 1 ? 3 : 2;
  }
  if (faq.title.toLowerCase().includes(q) || q.includes(normalize(faq.title).slice(0, 24))) {
    score += 5;
  }
  if (routeHint && faq.routes?.some((r) => routeHint.includes(r))) {
    score += 1.5;
  }
  return score;
}

export function matchHelpAnswer(question: string, pathname?: string | null): {
  answer: string;
  matched: HelpFaq | null;
  suggestions: HelpFaq[];
} {
  const q = normalize(question);
  const routeHint = pathname ? pathname.toLowerCase() : null;

  if (!q || q.length < 2) {
    return {
      answer: "Ask a short question, or tap a suggestion.",
      matched: null,
      suggestions: suggestFaqs(pathname, 4),
    };
  }

  const ranked = HELP_FAQS.map((faq) => ({ faq, score: scoreFaq(faq, q, routeHint) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0 || ranked[0].score < 2) {
    return {
      answer: FALLBACK,
      matched: null,
      suggestions: suggestFaqs(pathname, 4),
    };
  }

  const best = ranked[0].faq;
  const suggestions = ranked
    .slice(1, 4)
    .map((x) => x.faq)
    .concat(suggestFaqs(pathname, 4).filter((f) => f.id !== best.id))
    .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i)
    .slice(0, 3);

  return { answer: best.answer, matched: best, suggestions };
}

export function suggestFaqs(pathname?: string | null, limit = 4): HelpFaq[] {
  const route = (pathname || "").toLowerCase();
  const contextual = HELP_FAQS.filter((f) => f.routes?.some((r) => route.includes(r)));
  const rest = HELP_FAQS.filter((f) => !contextual.includes(f));
  return [...contextual, ...rest].slice(0, limit);
}
