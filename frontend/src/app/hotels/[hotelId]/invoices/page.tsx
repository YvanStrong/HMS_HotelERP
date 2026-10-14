"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch } from "@/lib/api";
import { loadAuthUser, type AuthUser } from "@/lib/auth";
import {
  type EventBillingDocumentRow,
  downloadEventBillingDocumentPdf,
  eventBillingDocumentLabel,
  loadEventBillingDocuments,
} from "@/lib/eventApi";
import { issuerFieldsFromHotel, printDepotSaleInvoice } from "@/lib/printDepotSaleInvoice";
import { useHotelContext } from "@/lib/useHotelContext";
import {
  buildTaxInvoiceHtml,
  guessPaymentMethodFromItems,
  openTaxInvoicePrintWindow,
  summarizeFromLineItems,
} from "@/lib/taxInvoiceHtml";

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  confirmationCode: string;
  bookingReference: string;
  guestName: string;
  roomNumber?: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
  pdfUrl?: string | null;
  status?: string | null;
};

type ProformaListItem = {
  reservationId: string;
  proformaNumber: string;
  confirmationCode: string;
  bookingReference: string;
  guestName: string;
  status: string;
  grandTotal: number;
  currency: string;
  generatedAt: string;
};

type SalesInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: string;
  customerName: string;
  invoiceDate: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentMethod?: string | null;
};

type SalesInvoiceLineItem = {
  id: string;
  itemName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
  subtotal: number;
  profit: number;
};

type SalesInvoiceDetail = SalesInvoiceSummary & {
  dueDate?: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  lines: SalesInvoiceLineItem[];
  totalProfit: number;
  createdAt: string;
};

type RecentSaleRow = {
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName: string;
  totalAmount: number;
  soldAt: string;
  paymentMethod?: string | null;
  status?: string | null;
  waiterName?: string | null;
};

type RecentSaleDetail = RecentSaleRow & {
  lines: {
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    taxable?: boolean;
  }[];
  ebmReceiptNo?: string | null;
  ebmSignature?: string | null;
  ebmInternalData?: string | null;
  ebmInvoiceNo?: string | null;
  ebmQrPayload?: string | null;
  ebmSdcId?: string | null;
  ebmMrcNo?: string | null;
  ebmStatus?: string | null;
};

type PosRefundResponse = {
  refundId: string;
  refundNumber: string;
  saleId: string;
  saleNumber: string;
  depotName: string;
  customerName: string | null;
  refundAmount: number;
  refundMethod: string | null;
  reason: string | null;
  refundedAt: string;
  lines: {
    productName: string;
    productCode: string;
    quantityRefunded: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  message?: string;
};

type ConvertProformaResponse = {
  saleId: string;
  saleNumber: string;
  depotId: string;
  totalAmount: number;
  soldAt: string;
  paymentMethod?: string | null;
  message?: string | null;
  lines?: {
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    taxable?: boolean;
  }[];
  subtotalAmount?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
};

type PosProformaRow = {
  proformaId: string;
  proformaNumber: string;
  depotName: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
};

type PosProformaDetail = PosProformaRow & {
  lines: {
    productName: string;
    productCode: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    taxable?: boolean;
  }[];
};

type DeliveryOrderRow = {
  deliveryOrderId: string;
  deliveryNumber: string;
  depotName: string;
  customerName: string;
  locationLabel?: string | null;
  totalAmount: number;
  status: string;
  createdAt: string;
  saleId?: string | null;
  saleNumber?: string | null;
  waiterName?: string | null;
};

type DeliveryOrderDetail = DeliveryOrderRow & {
  lines: RecentSaleDetail["lines"];
};

type FacilityInvoiceRow = {
  bookingId: string;
  invoiceNumber: string;
  facilityName: string;
  guestName: string;
  amount: number;
  invoicedAt: string;
  paymentStatus?: string | null;
};

type UnifiedInvoiceRow = {
  id: string;
  source: "Reservation" | "Inventory Sales" | "POS" | "Facility" | "Event";
  invoiceNumber: string;
  customer: string;
  reference: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  paymentMethod?: string | null;
  refundStatus?: string | null;
  waiterName?: string | null;
  action?: "reservation" | "sales" | "pos" | "facility" | "event";
};

type InvoiceProductLine = {
  name: string;
  code?: string;
  quantity?: number | null;
  unitPrice?: number | null;
  lineTotal: number;
};

type ViewListModalState = {
  invoiceNumber: string;
  source: string;
  customer: string;
  reference: string;
  totalAmount: number;
  currency: string;
      paymentMethod?: string | null;
      waiterName?: string | null;
      lines: InvoiceProductLine[];
  loading: boolean;
  error: string | null;
};

type InvoiceListPageResponse = {
  data: InvoiceListItem[];
  pagination: {
    page: number;
    size: number;
    total: number;
    totalPages: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
  totalInvoicedSumAll: number;
};

type InvoiceLine = { description: string; amount: number };

type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  pdfUrl?: string | null;
  items: InvoiceLine[];
  bookingReference?: string;
  confirmationCode?: string;
  guestName?: string;
  roomNumber?: string | null;
  roomTypeName?: string | null;
  currency?: string;
  createdAt?: string;
};

const INVOICE_PAGE_SIZE = 20;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REFUND_MANAGER_ROLES = ["SUPER_ADMIN", "HOTEL_ADMIN", "MANAGER"] as const;

function canRefundInvoices(role?: string | null) {
  return REFUND_MANAGER_ROLES.includes(role as (typeof REFUND_MANAGER_ROLES)[number]);
}

function isRefundedStatus(status?: string | null) {
  const s = (status ?? "").toUpperCase();
  return s === "REFUNDED" || s === "RETURNED";
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function normalizeRecentSaleRow(raw: RecentSaleRow & { id?: string }): RecentSaleRow {
  const saleId = String(raw.saleId ?? raw.id ?? "").trim();
  return {
    saleId,
    saleNumber: raw.saleNumber,
    depotName: raw.depotName,
    customerName: raw.customerName,
    totalAmount: Number(raw.totalAmount ?? 0),
    soldAt: raw.soldAt,
    paymentMethod: raw.paymentMethod ?? "CASH",
    status: raw.status ?? "COMPLETED",
    waiterName: raw.waiterName?.trim() || null,
  };
}

type RefundRow = {
  refundId: string;
  refundNumber: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  customerName?: string | null;
  reference?: string | null;
  refundAmount: number;
  refundMethod?: string | null;
  reason?: string | null;
  refundedAt: string;
  createdBy?: string | null;
};

type ProformaDetail = {
  reservationId: string;
  proformaNumber: string;
  confirmationCode: string;
  bookingReference: string;
  status: string;
  guestName: string;
  roomNumber?: string | null;
  checkInDate: string;
  checkOutDate: string;
  subtotalBeforeTax: number;
  taxes: number;
  depositCredit: number;
  grandTotal: number;
  currency: string;
  generatedAt: string;
  items: InvoiceLine[];
};

export default function InvoicesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hotelId = String(params.hotelId);
  const { hotel } = useHotelContext(hotelId);
  const issuer = issuerFieldsFromHotel(hotel);

  const [user, setUser] = useState<AuthUser | null>(null);
  const canRefund = canRefundInvoices(user?.role);

  const [tab, setTab] = useState<"reservation" | "sales" | "recentSales" | "proforma" | "deliveries" | "refunds" | "credit">("reservation");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "deliveries" || t === "sales" || t === "recentSales" || t === "proforma" || t === "reservation" || t === "refunds" || t === "credit") {
      setTab(t);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [salesLoading, setSalesLoading] = useState(false);
  const [recentSalesLoading, setRecentSalesLoading] = useState(false);
  const [posProformasLoading, setPosProformasLoading] = useState(false);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [refundsLoading, setRefundsLoading] = useState(false);
  const [refundingSaleId, setRefundingSaleId] = useState<string | null>(null);
  const [payingCreditId, setPayingCreditId] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<UnifiedInvoiceRow | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundModalError, setRefundModalError] = useState<string | null>(null);
  const [viewListModal, setViewListModal] = useState<ViewListModalState | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceSummary[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSaleRow[]>([]);
  const [facilityInvoices, setFacilityInvoices] = useState<FacilityInvoiceRow[]>([]);
  const [eventBillingDocs, setEventBillingDocs] = useState<EventBillingDocumentRow[]>([]);
  const [eventDocsLoading, setEventDocsLoading] = useState(false);
  const [posProformas, setPosProformas] = useState<PosProformaRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryOrderRow[]>([]);
  const [viewingDelivery, setViewingDelivery] = useState<DeliveryOrderDetail | null>(null);
  const [selectedDeliveryIds, setSelectedDeliveryIds] = useState<string[]>([]);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePagination, setInvoicePagination] = useState<InvoiceListPageResponse["pagination"] | null>(null);
  const [totalInvoicedSumAll, setTotalInvoicedSumAll] = useState<number | null>(null);
  const [proformas, setProformas] = useState<ProformaListItem[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [waiterFilter, setWaiterFilter] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<InvoiceDetail | null>(null);
  const [selectedSalesInvoiceId, setSelectedSalesInvoiceId] = useState<string | null>(null);
  const [salesInvoiceDetail, setSalesInvoiceDetail] = useState<SalesInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [salesDetailLoading, setSalesDetailLoading] = useState(false);

  useEffect(() => {
    setUser(loadAuthUser());
  }, []);

  async function loadRefunds() {
    if (!canRefundInvoices(loadAuthUser()?.role)) {
      setRefunds([]);
      return;
    }
    setRefundsLoading(true);
    try {
      const rows = await apiFetch<RefundRow[]>(`/api/v1/hotels/${hotelId}/invoices/refunds/all`);
      setRefunds(rows ?? []);
    } catch (e) {
      setRefunds([]);
      if (canRefundInvoices(loadAuthUser()?.role)) {
        setError(e instanceof Error ? e.message : "Failed to load refunds");
      }
    } finally {
      setRefundsLoading(false);
    }
  }

  useEffect(() => {
    if (!canRefund) return;
    void loadRefunds();
  }, [hotelId, canRefund]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await apiFetch<FacilityInvoiceRow[]>(`/api/v1/hotels/${hotelId}/facilities/invoices`);
        if (!cancelled) setFacilityInvoices(rows ?? []);
      } catch {
        if (!cancelled) setFacilityInvoices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPosProformasLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<PosProformaRow[]>(`/api/v1/hotels/${hotelId}/inventory/proformas`);
        if (!cancelled) setPosProformas(rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load POS proformas");
          setPosProformas([]);
        }
      } finally {
        if (!cancelled) setPosProformasLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecentSalesLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<RecentSaleRow[]>(`/api/v1/hotels/${hotelId}/inventory/sales`);
        if (!cancelled) setRecentSales((rows ?? []).map((r) => normalizeRecentSaleRow(r)));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load recent sales");
          setRecentSales([]);
        }
      } finally {
        if (!cancelled) setRecentSalesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDeliveriesLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<DeliveryOrderRow[]>(`/api/v1/hotels/${hotelId}/inventory/deliveries?status=PENDING`);
        if (!cancelled) setDeliveries(rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load delivery orders");
          setDeliveries([]);
        }
      } finally {
        if (!cancelled) setDeliveriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    setInvoicePage(1);
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInvoicesLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams();
        sp.set("page", "1");
        sp.set("size", "1000");
        const inv = await apiFetch<InvoiceListPageResponse>(
          `/api/v1/hotels/${hotelId}/invoices?${sp.toString()}`,
        );
        if (!cancelled) {
          setInvoices(inv.data);
          setInvoicePagination(inv.pagination);
          setTotalInvoicedSumAll(Number(inv.totalInvoicedSumAll ?? 0));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load invoices");
          setInvoices([]);
          setInvoicePagination(null);
        }
      } finally {
        if (!cancelled) setInvoicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSalesLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<SalesInvoiceSummary[]>(
          `/api/v1/hotels/${hotelId}/inventory/sales-invoices`,
        );
        if (!cancelled) setSalesInvoices(rows ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load sales invoices");
          setSalesInvoices([]);
        }
      } finally {
        if (!cancelled) setSalesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEventDocsLoading(true);
      try {
        const rows = await loadEventBillingDocuments(hotelId);
        if (!cancelled) setEventBillingDocs(rows ?? []);
      } catch {
        if (!cancelled) setEventBillingDocs([]);
      } finally {
        if (!cancelled) setEventDocsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  useEffect(() => {
    if (tab !== "reservation") {
      setSelectedInvoiceId(null);
      setInvoiceDetail(null);
    }
    if (tab !== "sales") {
      setSelectedSalesInvoiceId(null);
      setSalesInvoiceDetail(null);
    }
  }, [tab]);

  useEffect(() => {
    setSelectedInvoiceId(null);
    setInvoiceDetail(null);
  }, [invoicePage]);

  const eventProformas = useMemo(
    () => eventBillingDocs.filter((d) => d.documentType === "PROFORMA"),
    [eventBillingDocs],
  );
  const eventDeliveries = useMemo(
    () => eventBillingDocs.filter((d) => d.documentType === "DELIVERY"),
    [eventBillingDocs],
  );
  const eventInvoices = useMemo(
    () => eventBillingDocs.filter((d) => d.documentType === "INVOICE"),
    [eventBillingDocs],
  );

  const unifiedInvoices = useMemo<UnifiedInvoiceRow[]>(() => {
    const rows: UnifiedInvoiceRow[] = [
      ...invoices.map((row) => ({
        id: row.id,
        source: "Reservation" as const,
        invoiceNumber: row.invoiceNumber,
        customer: row.guestName,
        reference: row.bookingReference || row.confirmationCode || "-",
        totalAmount: Number(row.totalAmount ?? 0),
        currency: row.currency || "USD",
        createdAt: row.createdAt,
        action: "reservation" as const,
        refundStatus: row.status ?? "ISSUED",
      })),
      ...salesInvoices.map((row) => ({
        id: row.id,
        source: "Inventory Sales" as const,
        invoiceNumber: row.invoiceNumber,
        customer: row.customerName,
        reference: row.status,
        totalAmount: Number(row.totalAmount ?? 0),
        currency: "FRW",
        createdAt: row.invoiceDate,
        paymentMethod: row.paymentMethod ?? null,
        action: "sales" as const,
        refundStatus: row.status === "RETURNED" ? "REFUNDED" : row.status,
      })),
      ...recentSales.map((row) => ({
        id: row.saleId,
        source: "POS" as const,
        invoiceNumber: row.saleNumber,
        customer: row.customerName || "Walk-in",
        reference: row.depotName,
        totalAmount: Number(row.totalAmount ?? 0),
        currency: "FRW",
        createdAt: row.soldAt,
        paymentMethod: row.paymentMethod ?? "CASH",
        refundStatus: row.status ?? "COMPLETED",
        waiterName: row.waiterName || null,
        action: "pos" as const,
      })),
      ...facilityInvoices.map((row) => ({
        id: row.bookingId,
        source: "Facility" as const,
        invoiceNumber: row.invoiceNumber,
        customer: row.guestName,
        reference: row.facilityName,
        totalAmount: Number(row.amount ?? 0),
        currency: "FRW",
        createdAt: row.invoicedAt,
        action: "facility" as const,
        refundStatus: row.paymentStatus === "REFUNDED" ? "REFUNDED" : "PAID",
      })),
      ...eventInvoices.map((row) => ({
        id: row.id,
        source: "Event" as const,
        invoiceNumber: row.documentNumber,
        customer: row.contactPerson || row.groupName,
        reference: `${row.eventName} (${eventBillingDocumentLabel(row.documentType)})`,
        totalAmount: Number(row.totalAmount ?? 0),
        currency: row.currency || "USD",
        createdAt: row.updatedAt || row.createdAt,
        action: "event" as const,
      })),
    ];
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [eventInvoices, facilityInvoices, invoices, recentSales, salesInvoices]);

  const waiterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of unifiedInvoices) {
      const name = row.waiterName?.trim();
      if (name) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [unifiedInvoices]);

  const filteredUnifiedInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const waiter = waiterFilter.trim().toLowerCase();
    return unifiedInvoices.filter((row) => {
      if (waiter && (row.waiterName ?? "").trim().toLowerCase() !== waiter) return false;
      if (!q) return true;
      return [row.source, row.invoiceNumber, row.reference, row.customer, row.currency, row.paymentMethod ?? "", row.waiterName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [invoiceSearch, unifiedInvoices, waiterFilter]);

  const headerSummary = useMemo(() => {
    if (tab === "proforma") {
      return {
        label: "Proforma total",
        amount: posProformas.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0),
        suffix: " FRW",
      };
    }
    if (tab === "deliveries") {
      return {
        label: "Deliveries total",
        amount: deliveries.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0),
        suffix: " FRW",
      };
    }
    if (tab === "credit") {
      const open = unifiedInvoices.filter(
        (row) => (row.paymentMethod || "").toUpperCase() === "CREDIT" && !isRefundedStatus(row.refundStatus),
      );
      return {
        label: "Open credit",
        amount: open.reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0),
        suffix: "",
      };
    }
    if (tab === "refunds") {
      return {
        label: "Refunds total",
        amount: refunds.reduce((sum, row) => sum + Number(row.refundAmount ?? 0), 0),
        suffix: " FRW",
      };
    }
    return {
      label: waiterFilter ? `Sold by ${waiterFilter}` : "Final invoiced total",
      amount: filteredUnifiedInvoices
        .filter((row) => !isRefundedStatus(row.refundStatus))
        .reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0),
      suffix: "",
    };
  }, [tab, posProformas, deliveries, refunds, filteredUnifiedInvoices, waiterFilter, unifiedInvoices]);

  const unifiedInvoiceTotalPages = Math.max(1, Math.ceil(filteredUnifiedInvoices.length / INVOICE_PAGE_SIZE));
  const pagedUnifiedInvoices = filteredUnifiedInvoices.slice(
    (invoicePage - 1) * INVOICE_PAGE_SIZE,
    invoicePage * INVOICE_PAGE_SIZE,
  );

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearch, waiterFilter, unifiedInvoices.length]);

  async function printEventBillingDocument(documentId: string) {
    setError(null);
    try {
      await downloadEventBillingDocumentPdf(hotelId, documentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not download event billing PDF");
    }
  }

  async function printSelectedTaxInvoice() {
    if (!invoiceDetail) return;
    setError(null);
    try {
      const d = invoiceDetail;
      const items = (d.items ?? []).map((it) => ({
        description: it.description,
        amount: Number(it.amount),
      }));
      const balanceAfter = Number(d.totalAmount ?? 0);
      const sums = summarizeFromLineItems(items, balanceAfter);
      const pm = guessPaymentMethodFromItems(items);
      const bookingRef =
        d.bookingReference && d.bookingReference !== "-"
          ? d.bookingReference
          : d.confirmationCode && d.confirmationCode !== "-"
            ? d.confirmationCode
            : "—";
      const guestNm = d.guestName ?? "Guest";
      const roomLabel = `${d.roomNumber ?? "—"} (${d.roomTypeName ?? "—"})`;
      const currency = d.currency ?? "USD";
      const whenLabel = d.createdAt ? new Date(d.createdAt).toLocaleString() : new Date().toLocaleString();
      const { resolveEbmPrintFields } = await import("@/lib/ebmPrint");
      const ebm = await resolveEbmPrintFields(hotelId, "INVOICE", d.id);
      const html = buildTaxInvoiceHtml({
        invoiceNumber: d.invoiceNumber,
        items,
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
        ebmActivated: ebm.ebmActivated,
        ebm,
      });
      if (!openTaxInvoicePrintWindow(html)) {
        setError("Could not open the print dialog. Try again or check browser print permissions.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open invoice");
    }
  }

  async function selectInvoice(row: InvoiceListItem) {
    if (selectedInvoiceId === row.id) {
      setSelectedInvoiceId(null);
      setInvoiceDetail(null);
      return;
    }
    setSelectedInvoiceId(row.id);
    setInvoiceDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiFetch<InvoiceDetail>(`/api/v1/hotels/${hotelId}/invoices/${row.id}`);
      setInvoiceDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoice");
      setSelectedInvoiceId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function selectSalesInvoice(row: SalesInvoiceSummary) {
    if (selectedSalesInvoiceId === row.id) {
      setSelectedSalesInvoiceId(null);
      setSalesInvoiceDetail(null);
      return;
    }
    setSelectedSalesInvoiceId(row.id);
    setSalesInvoiceDetail(null);
    setSalesDetailLoading(true);
    try {
      const d = await apiFetch<SalesInvoiceDetail>(
        `/api/v1/hotels/${hotelId}/inventory/sales-invoices/${row.id}`,
      );
      setSalesInvoiceDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load sales invoice");
      setSelectedSalesInvoiceId(null);
    } finally {
      setSalesDetailLoading(false);
    }
  }

  async function printSelectedSalesInvoice() {
    if (!salesInvoiceDetail) return;
    const d = salesInvoiceDetail;
    const { resolveEbmPrintFields } = await import("@/lib/ebmPrint");
    const ebm = await resolveEbmPrintFields(hotelId, "INV_SALES_INVOICE", d.id);
    printDepotSaleInvoice(
      {
        ...issuer,
        saleId: d.id,
        saleNumber: d.invoiceNumber,
        documentTitle: "COPY",
        isCopy: true,
        depotName: "Sales invoice",
        customerName: d.customerName,
        totalAmount: Number(d.totalAmount ?? 0),
        soldAt: d.createdAt ?? d.invoiceDate,
        lines: (d.lines ?? []).map((ln) => ({
          productName: ln.itemName,
          productCode: ln.sku,
          quantity: Number(ln.quantity),
          unitPrice: Number(ln.unitPrice),
          lineTotal: Number(ln.subtotal),
          taxable: Number(ln.taxRate ?? 0) > 0,
        })),
        vatPercent: 18,
        paymentMethod: d.paymentMethod ?? null,
        ebmActivated: ebm.ebmActivated,
        ebmReceiptNo: ebm.ebmReceiptNo,
        ebmSignature: ebm.ebmSignature,
        ebmInternalData: ebm.ebmInternalData,
        ebmInvoiceNo: ebm.ebmInvoiceNo,
        ebmQrPayload: ebm.ebmQrPayload,
        ebmSdcId: ebm.ebmSdcId,
        ebmMrcNo: ebm.ebmMrcNo,
        ebmStatus: ebm.ebmStatus,
        ebmDate: ebm.ebmDate,
      },
      "FRW",
    );
  }

  async function reprintRecentSale(row: RecentSaleRow) {
    try {
      const data = await apiFetch<RecentSaleDetail>(`/api/v1/hotels/${hotelId}/inventory/sales/${row.saleId}`);
      const { resolveEbmPrintFields } = await import("@/lib/ebmPrint");
      const ebm = await resolveEbmPrintFields(hotelId, "DEPOT_SALE", String(data.saleId));
      printDepotSaleInvoice(
        {
          ...issuer,
          saleId: data.saleId,
          saleNumber: data.saleNumber,
          documentTitle: "COPY",
          isCopy: true,
          depotName: data.depotName,
          customerName: data.customerName,
          totalAmount: Number(data.totalAmount ?? 0),
          soldAt: data.soldAt,
          lines: (data.lines ?? []).map((ln) => ({
            productName: ln.productName,
            productCode: ln.productCode,
            quantity: Number(ln.quantity),
            unitPrice: Number(ln.unitPrice),
            lineTotal: Number(ln.lineTotal),
            taxable: ln.taxable !== false,
          })),
          vatPercent: 18,
          paymentMethod: data.paymentMethod ?? row.paymentMethod ?? "CASH",
          ebmActivated: ebm.ebmActivated,
          ebmReceiptNo: data.ebmReceiptNo ?? ebm.ebmReceiptNo,
          ebmSignature: data.ebmSignature ?? ebm.ebmSignature,
          ebmInternalData: data.ebmInternalData ?? ebm.ebmInternalData,
          ebmInvoiceNo: data.ebmInvoiceNo ?? ebm.ebmInvoiceNo,
          ebmQrPayload: data.ebmQrPayload ?? ebm.ebmQrPayload,
          ebmSdcId: data.ebmSdcId ?? ebm.ebmSdcId,
          ebmMrcNo: data.ebmMrcNo ?? ebm.ebmMrcNo,
          ebmStatus: data.ebmStatus ?? ebm.ebmStatus,
          ebmDate: ebm.ebmDate ?? data.soldAt,
        },
        "FRW",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reprint sale");
    }
  }

  function closeViewListModal() {
    setViewListModal(null);
  }

  async function openViewListModal(row: UnifiedInvoiceRow) {
    setViewListModal({
      invoiceNumber: row.invoiceNumber,
      source: row.source,
      customer: row.customer,
      reference: row.reference,
      totalAmount: row.totalAmount,
      currency: row.currency,
      paymentMethod: row.paymentMethod ?? null,
      waiterName: row.waiterName ?? null,
      lines: [],
      loading: true,
      error: null,
    });
    try {
      let lines: InvoiceProductLine[] = [];
      if (row.action === "pos") {
        const data = await apiFetch<RecentSaleDetail>(
          `/api/v1/hotels/${hotelId}/inventory/sales/${row.id}`,
          { quiet: true },
        );
        lines = (data.lines ?? []).map((ln) => ({
          name: ln.productName,
          code: ln.productCode,
          quantity: Number(ln.quantity),
          unitPrice: Number(ln.unitPrice),
          lineTotal: Number(ln.lineTotal),
        }));
      } else if (row.action === "sales") {
        const d = await apiFetch<SalesInvoiceDetail>(
          `/api/v1/hotels/${hotelId}/inventory/sales-invoices/${row.id}`,
          { quiet: true },
        );
        lines = (d.lines ?? []).map((ln) => ({
          name: ln.itemName,
          code: ln.sku,
          quantity: Number(ln.quantity),
          unitPrice: Number(ln.unitPrice),
          lineTotal: Number(ln.subtotal),
        }));
      } else if (row.action === "reservation") {
        const d = await apiFetch<InvoiceDetail>(`/api/v1/hotels/${hotelId}/invoices/${row.id}`, {
          quiet: true,
        });
        lines = (d.items ?? []).map((it) => ({
          name: it.description,
          lineTotal: Number(it.amount),
        }));
      } else if (row.action === "facility") {
        lines = [
          {
            name: row.reference,
            code: "FACILITY",
            quantity: 1,
            unitPrice: row.totalAmount,
            lineTotal: row.totalAmount,
          },
        ];
      }
      setViewListModal((prev) =>
        prev
          ? {
              ...prev,
              lines,
              loading: false,
              error: lines.length === 0 ? "No line items on this invoice." : null,
            }
          : null,
      );
    } catch (e) {
      setViewListModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: e instanceof Error ? e.message : "Could not load invoice items",
            }
          : null,
      );
    }
  }

  function toUnifiedRefundRow(row: UnifiedInvoiceRow | RecentSaleRow): UnifiedInvoiceRow {
    if ("action" in row && row.action) return row;
    const pos = row as RecentSaleRow;
    return {
      id: pos.saleId,
      source: "POS",
      invoiceNumber: pos.saleNumber,
      customer: pos.customerName || "Walk-in",
      reference: pos.depotName,
      totalAmount: Number(pos.totalAmount ?? 0),
      currency: "FRW",
      createdAt: pos.soldAt,
      paymentMethod: pos.paymentMethod ?? "CASH",
      refundStatus: pos.status ?? "COMPLETED",
      action: "pos",
    };
  }

  function openRefundModal(row: UnifiedInvoiceRow | RecentSaleRow) {
    if (!canRefund) return;
    const unified = toUnifiedRefundRow(row);
    if (isRefundedStatus(unified.refundStatus)) {
      setError("This invoice is already refunded.");
      return;
    }
    if (!["reservation", "pos", "facility"].includes(unified.action ?? "")) {
      setError("Refunds are only available for Reservation, POS, and Facility invoices.");
      return;
    }
    if (!UUID_RE.test(unified.id)) {
      setError("Could not resolve this invoice ID. Refresh the page and try again.");
      return;
    }
    setRefundModal(unified);
    setRefundReason("");
    setRefundModalError(null);
    setError(null);
    setSuccess(null);
  }

  function closeRefundModal() {
    if (refundingSaleId) return;
    setRefundModal(null);
    setRefundReason("");
    setRefundModalError(null);
  }

  async function submitRefundFromModal() {
    if (!refundModal || !canRefund) return;
    if (!UUID_RE.test(refundModal.id)) {
      setRefundModalError("Invalid invoice ID. Refresh the page and try again.");
      return;
    }
    setRefundingSaleId(refundModal.id);
    setRefundModalError(null);
    setError(null);
    setSuccess(null);
    try {
      const reasonBody = { reason: refundReason.trim() || null };
      if (refundModal.action === "pos") {
        const q = new URLSearchParams({ saleId: refundModal.id });
        const refund = await apiFetch<PosRefundResponse>(
          `/api/v1/hotels/${hotelId}/inventory/sales/refund-full?${q.toString()}`,
          {
            method: "POST",
            body: JSON.stringify(reasonBody),
            quiet: true,
          },
        );
        setRecentSales((prev) =>
          prev.map((s) => (s.saleId === refundModal.id ? { ...s, status: "REFUNDED" } : s)),
        );
        setSuccess(
          `Refund completed for ${refundModal.invoiceNumber}. Stock restored to ${refundModal.reference}.`,
        );
        try {
          const { resolveEbmPrintFields } = await import("@/lib/ebmPrint");
          const ebm = await resolveEbmPrintFields(hotelId, "DEPOT_REFUND", refund.refundId, {
            waitMs: 800,
          });
          printDepotSaleInvoice(
            {
              ...issuer,
              saleId: refund.refundId,
              saleNumber: refund.refundNumber,
              documentTitle: "REFUND",
              depotName: refund.depotName,
              customerName: refund.customerName,
              totalAmount: Number(refund.refundAmount ?? 0),
              soldAt: refund.refundedAt,
              paymentMethod: refund.refundMethod,
              lines: (refund.lines ?? []).map((ln) => ({
                productName: ln.productName,
                productCode: ln.productCode,
                quantity: Number(ln.quantityRefunded),
                unitPrice: Number(ln.unitPrice),
                lineTotal: Number(ln.lineTotal),
                taxable: true,
              })),
              vatPercent: 18,
              ebmActivated: ebm.ebmActivated,
              ebmReceiptNo: ebm.ebmReceiptNo,
              ebmSignature: ebm.ebmSignature,
              ebmInternalData: ebm.ebmInternalData,
              ebmInvoiceNo: ebm.ebmInvoiceNo,
              ebmQrPayload: ebm.ebmQrPayload,
              ebmSdcId: ebm.ebmSdcId,
              ebmMrcNo: ebm.ebmMrcNo,
              ebmStatus: ebm.ebmStatus,
              ebmDate: ebm.ebmDate,
            },
            "FRW",
          );
        } catch {
          // Print is best-effort after successful refund
        }
      } else if (refundModal.action === "reservation") {
        await apiFetch(`/api/v1/hotels/${hotelId}/invoices/${refundModal.id}/refund-full`, {
          method: "POST",
          body: JSON.stringify(reasonBody),
          quiet: true,
        });
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === refundModal.id ? { ...inv, status: "REFUNDED" } : inv)),
        );
        setSuccess(`Refund completed for reservation invoice ${refundModal.invoiceNumber}.`);
      } else if (refundModal.action === "facility") {
        await apiFetch(`/api/v1/hotels/${hotelId}/facilities/bookings/${refundModal.id}/refund-invoice`, {
          method: "POST",
          body: JSON.stringify(reasonBody),
          quiet: true,
        });
        setFacilityInvoices((prev) =>
          prev.map((inv) =>
            inv.bookingId === refundModal.id ? { ...inv, paymentStatus: "REFUNDED" } : inv,
          ),
        );
        setSuccess(`Refund completed for facility invoice ${refundModal.invoiceNumber}.`);
      }
      await loadRefunds();
      setRefundModal(null);
      setRefundReason("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Refund failed";
      if (/not found|404/i.test(msg)) {
        setRefundModalError(
          "Refund could not be completed. Restart the backend (mvn spring-boot:run) so the latest update is loaded, then try again.",
        );
      } else {
        setRefundModalError(msg);
      }
    } finally {
      setRefundingSaleId(null);
    }
  }

  async function printSalesInvoiceRow(id: string) {
    try {
      const d = await apiFetch<SalesInvoiceDetail>(`/api/v1/hotels/${hotelId}/inventory/sales-invoices/${id}`);
      const { resolveEbmPrintFields } = await import("@/lib/ebmPrint");
      const ebm = await resolveEbmPrintFields(hotelId, "INV_SALES_INVOICE", d.id);
      printDepotSaleInvoice(
        {
          ...issuer,
          saleId: d.id,
          saleNumber: d.invoiceNumber,
          documentTitle: "COPY",
          isCopy: true,
          depotName: "Sales invoice",
          customerName: d.customerName,
          totalAmount: Number(d.totalAmount ?? 0),
          soldAt: d.createdAt ?? d.invoiceDate,
          lines: (d.lines ?? []).map((ln) => ({
            productName: ln.itemName,
            productCode: ln.sku,
            quantity: Number(ln.quantity),
            unitPrice: Number(ln.unitPrice),
            lineTotal: Number(ln.subtotal),
            taxable: Number(ln.taxRate ?? 0) > 0,
          })),
          vatPercent: 18,
          paymentMethod: d.paymentMethod ?? null,
          ebmActivated: ebm.ebmActivated,
          ebmReceiptNo: ebm.ebmReceiptNo,
          ebmSignature: ebm.ebmSignature,
          ebmInternalData: ebm.ebmInternalData,
          ebmInvoiceNo: ebm.ebmInvoiceNo,
          ebmQrPayload: ebm.ebmQrPayload,
          ebmSdcId: ebm.ebmSdcId,
          ebmMrcNo: ebm.ebmMrcNo,
          ebmStatus: ebm.ebmStatus,
          ebmDate: ebm.ebmDate,
        },
        "FRW",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not print sales invoice");
    }
  }

  function printFacilityInvoice(row: UnifiedInvoiceRow) {
    printDepotSaleInvoice(
      {
        ...issuer,
        saleId: row.id,
        saleNumber: row.invoiceNumber,
        documentTitle: "COPY",
        isCopy: true,
        depotName: "Facility",
        customerName: row.customer,
        totalAmount: row.totalAmount,
        soldAt: row.createdAt,
        lines: [
          {
            productName: row.reference,
            productCode: "FACILITY",
            quantity: 1,
            unitPrice: row.totalAmount,
            lineTotal: row.totalAmount,
            taxable: false,
          },
        ],
        vatPercent: 18,
      },
      row.currency,
    );
  }

  async function convertPosProforma(row: PosProformaRow) {
    try {
      const sale = await apiFetch<ConvertProformaResponse>(
        `/api/v1/hotels/${hotelId}/inventory/proformas/${row.proformaId}/convert-to-invoice`,
        { method: "POST" },
      );
      setPosProformas((prev) => prev.filter((p) => p.proformaId !== row.proformaId));
      const saleRow: RecentSaleRow = {
        saleId: String(sale.saleId),
        saleNumber: sale.saleNumber,
        depotName: row.depotName,
        customerName: row.customerName,
        totalAmount: Number(sale.totalAmount ?? row.totalAmount),
        soldAt: sale.soldAt ?? new Date().toISOString(),
        paymentMethod: sale.paymentMethod ?? "CASH",
        status: "COMPLETED",
      };
      setRecentSales((prev) => [saleRow, ...prev]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert proforma to invoice");
    }
  }

  async function markCreditPaid(row: UnifiedInvoiceRow) {
    setPayingCreditId(row.id);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/sales/${row.id}/mark-paid`, { method: "POST" });
      setRecentSales((prev) =>
        prev.map((sale) => (sale.saleId === row.id ? { ...sale, paymentMethod: "CASH" } : sale)),
      );
      setSuccess(`${row.invoiceNumber} is paid and left the credit list.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark the invoice paid");
    } finally {
      setPayingCreditId(null);
    }
  }

  function toggleDeliverySelected(id: string) {
    setSelectedDeliveryIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function convertDeliveryToInvoice(rows: DeliveryOrderRow[]) {
    if (rows.length === 0) {
      setError("Select the deliveries to put on one invoice.");
      return;
    }
    const ids = rows.map((r) => r.deliveryOrderId);
    const row = rows[0];
    try {
      const sale = await apiFetch<ConvertProformaResponse>(
        `/api/v1/hotels/${hotelId}/inventory/deliveries/convert-to-invoice`,
        { method: "POST", body: JSON.stringify({ deliveryOrderIds: ids }) },
      );
      setDeliveries((prev) => prev.filter((d) => !ids.includes(d.deliveryOrderId)));
      setSelectedDeliveryIds((prev) => prev.filter((id) => !ids.includes(id)));
      const saleRow: RecentSaleRow = {
        saleId: String(sale.saleId),
        saleNumber: sale.saleNumber,
        depotName: row.depotName,
        customerName: row.customerName,
        totalAmount: Number(sale.totalAmount ?? row.totalAmount),
        soldAt: sale.soldAt ?? new Date().toISOString(),
        paymentMethod: sale.paymentMethod ?? "CASH",
        status: "COMPLETED",
        waiterName: rows.find((r) => r.waiterName?.trim())?.waiterName ?? null,
      };
      setRecentSales((prev) => [saleRow, ...prev]);
      if (sale.lines && sale.lines.length > 0) {
        printDepotSaleInvoice(
          {
            ...issuer,
            saleId: String(sale.saleId),
            saleNumber: sale.saleNumber,
            documentTitle: "INVOICE",
            depotName: row.depotName,
            customerName: row.customerName,
            totalAmount: Number(sale.totalAmount ?? 0),
            subtotalAmount: sale.subtotalAmount != null ? Number(sale.subtotalAmount) : undefined,
            discountAmount: sale.discountAmount != null ? Number(sale.discountAmount) : undefined,
            promoCode: sale.promoCode ?? null,
            soldAt: sale.soldAt,
            paymentMethod: sale.paymentMethod ?? "CASH",
            lines: sale.lines.map((ln) => ({
              productName: ln.productName,
              productCode: ln.productCode,
              quantity: Number(ln.quantity),
              unitPrice: Number(ln.unitPrice),
              lineTotal: Number(ln.lineTotal),
              taxable: ln.taxable !== false,
            })),
            vatPercent: 18,
          },
          "FRW",
        );
      }
      setError(null);
      setSuccess(sale.message || `Invoice ${sale.saleNumber} printed`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not convert delivery to invoice");
    }
  }

  async function viewDelivery(row: DeliveryOrderRow) {
    try {
      const data = await apiFetch<DeliveryOrderDetail>(
        `/api/v1/hotels/${hotelId}/inventory/deliveries/${row.deliveryOrderId}`,
      );
      setViewingDelivery(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open this delivery");
    }
  }

  async function reprintDelivery(row: DeliveryOrderRow) {
    try {
      const data = await apiFetch<DeliveryOrderDetail>(
        `/api/v1/hotels/${hotelId}/inventory/deliveries/${row.deliveryOrderId}`,
      );
      printDepotSaleInvoice(
        {
          ...issuer,
          saleId: data.deliveryOrderId,
          saleNumber: data.deliveryNumber,
          documentTitle: "DELIVERY",
          depotName: data.depotName,
          customerName: data.customerName,
          totalAmount: Number(data.totalAmount ?? 0),
          soldAt: data.createdAt,
          lines: (data.lines ?? []).map((ln) => ({
            productName: ln.productName,
            productCode: ln.productCode,
            quantity: Number(ln.quantity),
            unitPrice: Number(ln.unitPrice),
            lineTotal: Number(ln.lineTotal),
            taxable: ln.taxable !== false,
          })),
          vatPercent: 18,
        },
        "FRW",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not print delivery");
    }
  }

  async function reprintPosProforma(row: PosProformaRow) {
    try {
      const data = await apiFetch<PosProformaDetail>(
        `/api/v1/hotels/${hotelId}/inventory/proformas/${row.proformaId}`,
      );
      printDepotSaleInvoice(
        {
          ...issuer,
          saleId: data.proformaId,
          saleNumber: data.proformaNumber,
          documentTitle: "PROFORMA",
          depotName: data.depotName,
          customerName: data.customerName,
          totalAmount: Number(data.totalAmount ?? 0),
          soldAt: data.createdAt,
          lines: (data.lines ?? []).map((ln) => ({
            productName: ln.productName,
            productCode: ln.productCode,
            quantity: Number(ln.quantity),
            unitPrice: Number(ln.unitPrice),
            lineTotal: Number(ln.lineTotal),
            taxable: ln.taxable !== false,
          })),
          vatPercent: 18,
        },
        "FRW",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reprint proforma");
    }
  }

  async function printProforma(reservationId: string) {
    try {
      const data = await apiFetch<ProformaDetail>(`/api/v1/hotels/${hotelId}/invoices/proformas/${reservationId}`);
      const esc = (v: unknown) =>
        String(v ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Proforma ${esc(data.proformaNumber)}</title>
      <style>
      body{font-family:Arial,sans-serif;margin:18px;color:#111}
      .head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      .muted{color:#666}
      .card{border:1px solid #ddd;border-radius:10px;padding:12px;margin-top:10px}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
      .strong{font-weight:700}
      </style></head><body>
      <div class="head"><div><h2>Proforma Invoice</h2><p class="muted">Estimate only - not a final tax invoice.</p></div><div><div><strong>${esc(data.proformaNumber)}</strong></div><div class="muted">${esc(data.generatedAt)}</div></div></div>
      <div class="card">
      <div class="row"><span class="muted">Booking ref</span><span>${esc(data.bookingReference || data.confirmationCode)}</span></div>
      <div class="row"><span class="muted">Guest</span><span>${esc(data.guestName)}</span></div>
      <div class="row"><span class="muted">Room</span><span>${esc(data.roomNumber || "-")}</span></div>
      <div class="row"><span class="muted">Stay</span><span>${esc(data.checkInDate)} to ${esc(data.checkOutDate)}</span></div>
      <table><thead><tr><th>Description</th><th>Amount (${esc(data.currency)})</th></tr></thead><tbody>
      ${data.items.map((it) => `<tr><td>${esc(it.description)}</td><td>${esc(it.amount)}</td></tr>`).join("")}
      </tbody></table>
      <div class="row"><span class="muted">Subtotal</span><span>${esc(data.subtotalBeforeTax)}</span></div>
      <div class="row"><span class="muted">Tourism Tax (TT)</span><span>${esc(data.taxes)}</span></div>
      <div class="row"><span class="muted">Deposit credit</span><span>- ${esc(data.depositCredit)}</span></div>
      <div class="row strong"><span>Estimated total</span><span>${esc(data.grandTotal)} ${esc(data.currency)}</span></div>
      </div></body></html>`;
      const w = window.open("", "_blank");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load proforma invoice");
    }
  }

  return (
    <div className="space-y-6">
      <section className="hms-section-card">
        <div className="hms-section-head">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Invoices</h1>
            <p className="hms-section-sub">One invoice table for reservation, sales, POS, and facility invoices.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{headerSummary.label}</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(headerSummary.amount)}
              {headerSummary.suffix}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={tab === "reservation" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("reservation")}
          >
            All Invoices ({filteredUnifiedInvoices.length})
          </button>
          <button
            type="button"
            className={tab === "proforma" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("proforma")}
          >
            POS Proformas ({posProformas.length + eventProformas.length})
          </button>
          <button
            type="button"
            className={tab === "deliveries" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("deliveries")}
          >
            Deliveries ({deliveries.length + eventDeliveries.length})
          </button>
          <button
            type="button"
            className={tab === "refunds" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("refunds")}
          >
            Refunds ({refunds.length})
          </button>
          <button
            type="button"
            className={tab === "credit" ? "hms-btn-solid hms-btn-sm" : "hms-btn-outline hms-btn-sm"}
            onClick={() => setTab("credit")}
          >
            Credit ({unifiedInvoices.filter((row) => (row.paymentMethod || "").toUpperCase() === "CREDIT" && !isRefundedStatus(row.refundStatus)).length})
          </button>
        </div>
      </section>

      {success && <p className="text-sm text-green-700 font-medium">{success}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <div className="hms-section-card">Loading…</div>}

      {!loading && tab === "credit" && (
        <section className="hms-section-card space-y-4">
          <p className="text-sm text-muted-foreground">
            Invoices given on credit. They stay here until you press Paid. Paid invoices move to All Invoices as cash, and the open credit on Credit &amp; debt is cleared.
          </p>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Waiter</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unifiedInvoices
                  .filter((row) => (row.paymentMethod || "").toUpperCase() === "CREDIT" && !isRefundedStatus(row.refundStatus))
                  .map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.invoiceNumber}</td>
                      <td>{row.customer}</td>
                      <td>{row.waiterName || "—"}</td>
                      <td>
                        {formatMoney(Number(row.totalAmount))} {row.currency}
                      </td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="hms-btn-solid hms-btn-sm"
                          disabled={payingCreditId === row.id}
                          onClick={() => void markCreditPaid(row)}
                        >
                          {payingCreditId === row.id ? "…" : "Paid"}
                        </button>
                      </td>
                    </tr>
                  ))}
                {unifiedInvoices.filter((row) => (row.paymentMethod || "").toUpperCase() === "CREDIT" && !isRefundedStatus(row.refundStatus)).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted-foreground">
                      No invoices are waiting on credit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && tab === "reservation" && (
        <section className="hms-section-card space-y-4">
          {invoicesLoading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading invoices…
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Final invoices and fully paid event billing documents. Proformas and delivery notes are on their tabs.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm font-medium text-foreground sm:max-w-xs w-full" htmlFor="invoice-waiter">
              Waiter
              <select
                id="invoice-waiter"
                className="hms-input mt-1 w-full"
                value={waiterFilter}
                onChange={(e) => setWaiterFilter(e.target.value)}
              >
                <option value="">All waiters</option>
                {waiterOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-foreground w-full sm:max-w-sm" htmlFor="invoice-search">
              Search invoices
              <input
                id="invoice-search"
                className="hms-input mt-1 w-full"
                placeholder="Search invoice #, type, customer, waiter..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Invoice #</th>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Waiter</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedUnifiedInvoices.map((row) => (
                  <tr key={`${row.source}-${row.id}`}>
                    <td>{row.source}</td>
                    <td className="font-medium">{row.invoiceNumber}</td>
                    <td>{row.reference}</td>
                    <td>{row.customer}</td>
                    <td>{row.waiterName || "—"}</td>
                    <td>{row.paymentMethod ?? (row.action === "pos" ? "CASH" : "—")}</td>
                    <td>
                      {formatMoney(Number(row.totalAmount))} {row.currency}
                      {isRefundedStatus(row.refundStatus) && (
                        <span className="ml-2 text-xs font-semibold text-red-600">Refunded</span>
                      )}
                    </td>
                    <td>{new Date(row.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="hms-btn-outline hms-btn-sm"
                          onClick={() => void openViewListModal(row)}
                        >
                          View list
                        </button>
                        {row.action === "pos" ? (
                          <>
                            <button
                              type="button"
                              className="hms-btn-outline hms-btn-sm"
                              onClick={() => void reprintRecentSale({
                                saleId: row.id,
                                saleNumber: row.invoiceNumber,
                                depotName: row.reference,
                                customerName: row.customer,
                                totalAmount: row.totalAmount,
                                soldAt: row.createdAt,
                                paymentMethod: row.paymentMethod ?? "CASH",
                                status: row.refundStatus ?? "COMPLETED",
                              })}
                            >
                              Reprint
                            </button>
                            {canRefund && !isRefundedStatus(row.refundStatus) && (
                              <button
                                type="button"
                                className="hms-btn-outline hms-btn-sm text-red-700 border-red-300 hover:bg-red-50"
                                disabled={refundingSaleId === row.id}
                                onClick={() => openRefundModal(row)}
                              >
                                {refundingSaleId === row.id ? "…" : "Refund"}
                              </button>
                            )}
                          </>
                        ) : row.action === "sales" ? (
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm"
                            onClick={() => void printSalesInvoiceRow(row.id)}
                          >
                            Print
                          </button>
                        ) : row.action === "facility" ? (
                          <>
                            <button
                              type="button"
                              className="hms-btn-outline hms-btn-sm"
                              onClick={() => printFacilityInvoice(row)}
                            >
                              Print
                            </button>
                            {canRefund && !isRefundedStatus(row.refundStatus) && (
                              <button
                                type="button"
                                className="hms-btn-outline hms-btn-sm text-red-700 border-red-300 hover:bg-red-50"
                                disabled={refundingSaleId === row.id}
                                onClick={() => openRefundModal(row)}
                              >
                                {refundingSaleId === row.id ? "…" : "Refund"}
                              </button>
                            )}
                          </>
                        ) : row.action === "event" ? (
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm"
                            onClick={() => void printEventBillingDocument(row.id)}
                          >
                            Download PDF
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="hms-btn-outline hms-btn-sm"
                              onClick={() => {
                                const original = invoices.find((inv) => inv.id === row.id);
                                if (original) void selectInvoice(original);
                              }}
                            >
                              Details
                            </button>
                            {canRefund && !isRefundedStatus(row.refundStatus) && (
                              <button
                                type="button"
                                className="hms-btn-outline hms-btn-sm text-red-700 border-red-300 hover:bg-red-50"
                                disabled={refundingSaleId === row.id}
                                onClick={() => openRefundModal(row)}
                              >
                                {refundingSaleId === row.id ? "…" : "Refund"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUnifiedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted-foreground">
                      {waiterFilter ? `No invoices for ${waiterFilter}.` : "No invoices found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredUnifiedInvoices.length > INVOICE_PAGE_SIZE && (
            <PaginationBar
              page={invoicePage}
              totalPages={unifiedInvoiceTotalPages}
              totalItems={filteredUnifiedInvoices.length}
              pageSize={INVOICE_PAGE_SIZE}
              noun="invoices"
              onPageChange={(next) => setInvoicePage(next)}
            />
          )}

          {selectedInvoiceId && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold text-foreground">Selected invoice</h2>
                {invoiceDetail && (
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm w-fit"
                    onClick={() => printSelectedTaxInvoice()}
                  >
                    Print invoice
                  </button>
                )}
              </div>
              {detailLoading && <p className="text-sm text-muted-foreground">Loading line items...</p>}
              {!detailLoading && invoiceDetail && (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">{invoiceDetail.invoiceNumber}</span>
                    {" \u00b7 "}
                    Total {Number(invoiceDetail.totalAmount).toFixed(2)}
                  </p>
                  <div className="hms-table-wrap bg-card">
                    <table className="hms-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th className="text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(invoiceDetail.items ?? []).map((it, idx) => {
                          const raw = it.amount as unknown;
                          const n =
                            typeof raw === "number"
                              ? raw
                              : typeof raw === "string"
                                ? Number(raw)
                                : Number(raw);
                          const amt = Number.isFinite(n) ? n.toFixed(2) : "—";
                          return (
                            <tr key={`${it.description}-${idx}`}>
                              <td>{it.description}</td>
                              <td className="text-right font-medium tabular-nums min-w-[7rem]">{amt}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {!loading && tab === "sales" && (
        <section className="hms-section-card space-y-4">
          {salesLoading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading sales invoices…
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Sales invoices created from Inventory / Sales are listed here.
          </p>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th className="w-10" aria-hidden />
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {salesInvoices.map((row) => {
                  const selected = selectedSalesInvoiceId === row.id;
                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      aria-pressed={selected}
                      onClick={() => void selectSalesInvoice(row)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void selectSalesInvoice(row);
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        selected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <td className="w-10 text-center">
                        <span
                          className={`inline-block h-3.5 w-3.5 rounded-full border-2 ${
                            selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                          }`}
                          aria-hidden
                        />
                      </td>
                      <td className="font-medium">{row.invoiceNumber}</td>
                      <td>{row.customerName}</td>
                      <td>{row.status}</td>
                      <td>{row.paymentMethod ?? "—"}</td>
                      <td>{Number(row.totalAmount).toFixed(2)}</td>
                      <td>{Number(row.amountPaid).toFixed(2)}</td>
                      <td>{Number(row.balanceDue).toFixed(2)}</td>
                      <td>{row.invoiceDate}</td>
                    </tr>
                  );
                })}
                {salesInvoices.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted-foreground">
                      No sales invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedSalesInvoiceId && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className="text-lg font-semibold text-foreground">Selected sales invoice</h2>
                {salesInvoiceDetail && (
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm w-fit"
                    onClick={() => printSelectedSalesInvoice()}
                  >
                    Print invoice
                  </button>
                )}
              </div>
              {salesDetailLoading && <p className="text-sm text-muted-foreground">Loading line items...</p>}
              {!salesDetailLoading && salesInvoiceDetail && (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    <span className="font-semibold text-foreground">{salesInvoiceDetail.invoiceNumber}</span>
                    {" \u00b7 "}
                    Total {Number(salesInvoiceDetail.totalAmount).toFixed(2)}
                    {" \u00b7 "}
                    Status {salesInvoiceDetail.status}
                  </p>
                  <div className="hms-table-wrap bg-card">
                    <table className="hms-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>SKU</th>
                          <th className="text-right">Qty</th>
                          <th className="text-right">Unit</th>
                          <th className="text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(salesInvoiceDetail.lines ?? []).map((it) => (
                          <tr key={it.id}>
                            <td>{it.itemName}</td>
                            <td>{it.sku}</td>
                            <td className="text-right tabular-nums">{Number(it.quantity).toFixed(3)}</td>
                            <td className="text-right tabular-nums">{Number(it.unitPrice).toFixed(2)}</td>
                            <td className="text-right font-medium tabular-nums">
                              {Number(it.subtotal).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {!loading && tab === "recentSales" && (
        <section className="hms-section-card space-y-4">
          {recentSalesLoading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading recent sales…
            </p>
          )}
          <h2 className="text-lg font-semibold">Recent Sales</h2>
          <div className="hms-table-wrap">
            <table className="hms-table">
              <thead>
                <tr>
                  <th>Sale #</th>
                  <th>Depot</th>
                  <th>Client</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Sold at</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((row) => (
                  <tr key={row.saleId}>
                    <td className="font-medium">{row.saleNumber}</td>
                    <td>{row.depotName}</td>
                    <td>{row.customerName || "Walk-in"}</td>
                    <td>{row.paymentMethod ?? "CASH"}</td>
                    <td>
                      {Number(row.totalAmount).toFixed(2)}
                      {(row.status ?? "COMPLETED") === "REFUNDED" && (
                        <span className="ml-2 text-xs font-semibold text-red-600">Refunded</span>
                      )}
                    </td>
                    <td>{new Date(row.soldAt).toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-primary font-semibold hover:underline"
                          onClick={() => void reprintRecentSale(row)}
                        >
                          Reprint
                        </button>
                        {canRefund && !isRefundedStatus(row.status) && (
                          <button
                            type="button"
                            className="text-red-700 font-semibold hover:underline"
                            disabled={refundingSaleId === row.saleId}
                            onClick={() => openRefundModal(row)}
                          >
                            {refundingSaleId === row.saleId ? "…" : "Refund"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted-foreground">
                      No recent sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && tab === "proforma" && (
        <section className="hms-section-card space-y-6">
          <div>
            <h2 className="mb-1 text-lg font-semibold">Proformas</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              POS estimates and event quotes with partial payment (balance still due on the group guest bill).
            </p>
            {(posProformasLoading || eventDocsLoading) && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Loading proformas…
              </p>
            )}
            <div className="hms-table-wrap">
              <table className="hms-table">
                <thead>
                  <tr>
                    <th>Proforma #</th>
                    <th>Source</th>
                    <th>Reference</th>
                    <th>Client</th>
                    <th>Total</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {posProformas.map((row) => (
                    <tr key={`pos-${row.proformaId}`}>
                      <td className="font-medium">{row.proformaNumber}</td>
                      <td>POS</td>
                      <td>{row.depotName}</td>
                      <td>{row.customerName || "Walk-in"}</td>
                      <td>{Number(row.totalAmount).toFixed(2)}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm"
                            onClick={() => void reprintPosProforma(row)}
                          >
                            Reprint
                          </button>
                          <button
                            type="button"
                            className="hms-btn-solid hms-btn-sm"
                            onClick={() => void convertPosProforma(row)}
                          >
                            Turn into invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {eventProformas.map((row) => (
                    <tr key={`event-${row.id}`}>
                      <td className="font-medium">{row.documentNumber}</td>
                      <td>Event</td>
                      <td>{row.eventName}</td>
                      <td>{row.contactPerson || row.groupName}</td>
                      <td>
                        {Number(row.totalAmount).toFixed(2)} {row.currency}
                        {Number(row.amountPaid) > 0 ? (
                          <span className="block text-xs text-muted-foreground">
                            Paid {Number(row.amountPaid).toFixed(2)} · Due {Number(row.balanceDue).toFixed(2)}
                          </span>
                        ) : null}
                      </td>
                      <td>{new Date(row.updatedAt || row.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="hms-btn-outline hms-btn-sm"
                          onClick={() => void printEventBillingDocument(row.id)}
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {posProformas.length + eventProformas.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted-foreground">
                        No proformas yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </section>
      )}

      {!loading && tab === "deliveries" && (
        <section className="hms-section-card space-y-6">
          <div>
            <h2 className="mb-1 text-lg font-semibold">Deliveries</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Waiter and mobile POS orders land here first. Use <strong>Make invoice</strong> for one delivery.
              Tick the deliveries you want together, then use <strong>Make one invoice</strong>.
            </p>
            {selectedDeliveryIds.length > 0 ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedDeliveryIds.length} selected
                </span>
                <button
                  type="button"
                  className="hms-btn-solid hms-btn-sm"
                  onClick={() =>
                    void convertDeliveryToInvoice(
                      deliveries.filter((d) => selectedDeliveryIds.includes(d.deliveryOrderId)),
                    )
                  }
                >
                  {selectedDeliveryIds.length > 1 ? "Make one invoice" : "Make invoice"}
                </button>
                <button
                  type="button"
                  className="hms-btn-outline hms-btn-sm"
                  onClick={() => setSelectedDeliveryIds([])}
                >
                  Clear
                </button>
              </div>
            ) : null}
            {(deliveriesLoading || eventDocsLoading) && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Loading deliveries...
              </p>
            )}
            <div className="hms-table-wrap">
              <table className="hms-table">
                <thead>
                  <tr>
                    <th className="w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th>Delivery #</th>
                    <th>Source</th>
                    <th>Reference</th>
                    <th>Client</th>
                    <th>Location</th>
                    <th>Waiter</th>
                    <th>Total</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((row) => {
                    const checked = selectedDeliveryIds.includes(row.deliveryOrderId);
                    return (
                    <tr key={`pos-${row.deliveryOrderId}`}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.deliveryNumber}`}
                          checked={checked}
                          onChange={() => toggleDeliverySelected(row.deliveryOrderId)}
                        />
                      </td>
                      <td className="font-medium">{row.deliveryNumber}</td>
                      <td>POS</td>
                      <td>{row.depotName}</td>
                      <td>{row.customerName || "Walk-in"}</td>
                      <td>{row.locationLabel || "-"}</td>
                      <td>{row.waiterName || "—"}</td>
                      <td>{Number(row.totalAmount).toFixed(2)}</td>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm"
                            onClick={() => void viewDelivery(row)}
                          >
                            View delivery
                          </button>
                          <button
                            type="button"
                            className="hms-btn-outline hms-btn-sm"
                            onClick={() => void reprintDelivery(row)}
                          >
                            Print delivery
                          </button>
                          <button
                            type="button"
                            className="hms-btn-solid hms-btn-sm"
                            onClick={() => void convertDeliveryToInvoice([row])}
                          >
                            Make invoice
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                  {eventDeliveries.map((row) => (
                    <tr key={`event-${row.id}`}>
                      <td />
                      <td className="font-medium">{row.documentNumber}</td>
                      <td>Event</td>
                      <td>{row.eventName}</td>
                      <td>{row.contactPerson || row.groupName}</td>
                      <td>{row.groupName}</td>
                      <td>—</td>
                      <td>
                        {Number(row.totalAmount).toFixed(2)} {row.currency}
                      </td>
                      <td>{new Date(row.updatedAt || row.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="hms-btn-outline hms-btn-sm"
                          onClick={() => void printEventBillingDocument(row.id)}
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {deliveries.length + eventDeliveries.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-muted-foreground">
                        No delivery notes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {!loading && tab === "refunds" && (
        <section className="hms-section-card space-y-4">
          <h2 className="text-lg font-semibold">Refunds</h2>
          <p className="text-sm text-muted-foreground">
            Refunds for Reservation, POS, and Facility invoices. POS refunds restore product quantities to the original outlet.
            Only Hotel Admin and Manager roles can process refunds.
          </p>
          {!canRefund && (
            <p className="text-sm text-amber-700">
              You do not have permission to view or process refunds. Manager or Admin role required.
            </p>
          )}
          {canRefund && refundsLoading && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading refunds…
            </p>
          )}
          {canRefund && (
            <div className="hms-table-wrap">
              <table className="hms-table">
                <thead>
                  <tr>
                    <th>Refund #</th>
                    <th>Type</th>
                    <th>Invoice #</th>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reason</th>
                    <th>Refunded at</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((row) => (
                    <tr key={row.refundId}>
                      <td className="font-medium">{row.refundNumber}</td>
                      <td>{row.sourceType}</td>
                      <td>{row.sourceNumber}</td>
                      <td>{row.reference ?? "—"}</td>
                      <td>{row.customerName || "Walk-in"}</td>
                      <td className="tabular-nums">{formatMoney(Number(row.refundAmount))}</td>
                      <td>{row.refundMethod ?? "—"}</td>
                      <td className="max-w-[12rem] truncate" title={row.reason ?? ""}>
                        {row.reason || "—"}
                      </td>
                      <td>{new Date(row.refundedAt).toLocaleString()}</td>
                      <td>{row.createdBy ?? "—"}</td>
                    </tr>
                  ))}
                  {refunds.length === 0 && !refundsLoading && (
                    <tr>
                      <td colSpan={10} className="text-center text-muted-foreground">
                        No refunds recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {viewListModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-list-modal-title"
          onClick={() => closeViewListModal()}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {viewListModal.source}
                  </p>
                  <h3 id="view-list-modal-title" className="text-xl font-bold text-foreground">
                    Invoice items — {viewListModal.invoiceNumber}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {viewListModal.customer}
                    {" · "}
                    {viewListModal.reference}
                    {viewListModal.paymentMethod ? ` · ${viewListModal.paymentMethod}` : ""}
                    {viewListModal.waiterName ? ` · Waiter ${viewListModal.waiterName}` : ""}
                  </p>
                </div>
                <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => closeViewListModal()}>
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {viewListModal.loading && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Loading products…
                </p>
              )}
              {!viewListModal.loading && viewListModal.error && (
                <p className="text-sm text-red-600 font-medium">{viewListModal.error}</p>
              )}
              {!viewListModal.loading && !viewListModal.error && viewListModal.lines.length > 0 && (
                <div className="hms-table-wrap">
                  <table className="hms-table">
                    <thead>
                      <tr>
                        <th>Product / description</th>
                        <th>Code</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit</th>
                        <th className="text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewListModal.lines.map((ln, idx) => (
                        <tr key={`${ln.code ?? ln.name}-${idx}`}>
                          <td className="font-medium">{ln.name}</td>
                          <td>{ln.code ?? "—"}</td>
                          <td className="text-right tabular-nums">
                            {ln.quantity != null ? Number(ln.quantity).toFixed(3).replace(/\.?0+$/, "") : "—"}
                          </td>
                          <td className="text-right tabular-nums">
                            {ln.unitPrice != null ? Number(ln.unitPrice).toFixed(2) : "—"}
                          </td>
                          <td className="text-right font-medium tabular-nums">
                            {Number(ln.lineTotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} className="text-right font-semibold">
                          Invoice total
                        </td>
                        <td className="text-right font-bold tabular-nums">
                          {Number(viewListModal.totalAmount).toFixed(2)} {viewListModal.currency}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {refundModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          onClick={() => closeRefundModal()}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                  {refundModal.source} refund
                </p>
                <h3 id="refund-modal-title" className="text-xl font-bold text-foreground">
                  Refund invoice
                </h3>
              </div>
              <button
                type="button"
                className="hms-btn-outline hms-btn-sm"
                disabled={!!refundingSaleId}
                onClick={() => closeRefundModal()}
              >
                Close
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm space-y-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Invoice #</span>
                <span className="font-semibold">{refundModal.invoiceNumber}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {refundModal.action === "pos" ? "Outlet" : "Reference"}
                </span>
                <span className="font-medium">{refundModal.reference}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Customer</span>
                <span>{refundModal.customer || "Walk-in"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(refundModal.totalAmount)} {refundModal.currency}
                </span>
              </div>
              {refundModal.paymentMethod && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Payment</span>
                  <span>{refundModal.paymentMethod}</span>
                </div>
              )}
            </div>

            {refundModal.action === "pos" && (
              <p className="mb-3 text-sm text-muted-foreground">
                Stock for all sold items will be restored to <strong>{refundModal.reference}</strong> (Principal, Bar, etc.).
                This action cannot be undone.
              </p>
            )}
            {refundModal.action !== "pos" && (
              <p className="mb-3 text-sm text-muted-foreground">
                This will mark the invoice as refunded and record the refund amount. This action cannot be undone.
              </p>
            )}

            <label className="block text-sm font-medium text-foreground" htmlFor="refund-reason">
              Reason for refund
            </label>
            <textarea
              id="refund-reason"
              className="hms-input mt-1 min-h-[96px] w-full resize-y"
              placeholder="e.g. Wrong order, customer returned items, billing mistake…"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              disabled={!!refundingSaleId}
            />

            {refundModalError && (
              <p className="mt-3 text-sm text-red-600 font-medium">{refundModalError}</p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="hms-btn-outline"
                disabled={!!refundingSaleId}
                onClick={() => closeRefundModal()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="hms-btn-solid bg-red-600 hover:bg-red-700 border-red-600"
                disabled={!!refundingSaleId}
                onClick={() => void submitRefundFromModal()}
              >
                {refundingSaleId ? "Processing refund…" : "Confirm refund"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-semibold">{viewingDelivery.deliveryNumber}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewingDelivery.depotName} · {viewingDelivery.customerName || "Walk-in"} · {viewingDelivery.locationLabel || "No table"}
            </p>
            <p className="text-sm">Waiter: {viewingDelivery.waiterName || "—"}</p>
            <div className="mt-3 overflow-x-auto">
              <table className="hms-table w-full text-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewingDelivery.lines ?? []).map((ln, i) => (
                    <tr key={`${ln.productCode}-${i}`}>
                      <td>{ln.productName}</td>
                      <td>{Number(ln.quantity)}</td>
                      <td>{Number(ln.lineTotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-right font-semibold">Total {Number(viewingDelivery.totalAmount).toFixed(2)}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="hms-btn-outline" onClick={() => setViewingDelivery(null)}>
                Close
              </button>
              <button
                type="button"
                className="hms-btn-solid"
                onClick={() => {
                  const row = viewingDelivery;
                  setViewingDelivery(null);
                  void reprintDelivery(row);
                }}
              >
                Print delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
