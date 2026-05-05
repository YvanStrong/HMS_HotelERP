"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SelfOrderQrBlock } from "@/components/SelfOrderQrBlock";
import { apiFetch } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  adminStatusLabel,
  formatMoney,
  formatRevenueShort,
} from "@/components/self-order/selfOrderGuestUtils";
import {
  confirmSelfOrderPayment,
  fetchSelfOrderMenu,
  fetchSelfOrderPortalSummary,
  fetchStaffSelfOrderSettings,
  putStaffSelfOrderSettings,
  type PublicPortalSummary,
  type StaffOrderRow,
} from "@/lib/selfOrderApi";

const NEXT: Record<string, string | null> = {
  PLACED: "IN_PROGRESS",
  IN_PROGRESS: "READY",
  READY: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

function randomBoardKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const ORDERS_PAGE_SIZE = 12;
const ACTIVE_SNAPSHOT_PAGE_SIZE = 8;

export default function StaffSelfOrdersPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<StaffOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [boardSecretDraft, setBoardSecretDraft] = useState("");
  const [boardKeyConfigured, setBoardKeyConfigured] = useState(false);
  const [boardKeyEcho, setBoardKeyEcho] = useState<string | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [portal, setPortal] = useState<PublicPortalSummary | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [ordersPage, setOrdersPage] = useState(0);
  const [activeSnapPage, setActiveSnapPage] = useState(0);

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const kioskUrl = useMemo(() => (origin ? `${origin}/book/order/${hotelId}` : ""), [origin, hotelId]);
  const screenUrlForQr = useMemo(() => {
    const key = (boardKeyEcho ?? boardSecretDraft).trim();
    if (!origin || !key) return "";
    return `${origin}/book/order/${hotelId}/screen?key=${encodeURIComponent(key)}`;
  }, [origin, hotelId, boardKeyEcho, boardSecretDraft]);

  const loadSettings = useCallback(async () => {
    try {
      const s = await fetchStaffSelfOrderSettings(hotelId);
      setBoardKeyConfigured(s.orderBoardKeyConfigured);
      if (s.orderBoardSecretEcho) setBoardKeyEcho(s.orderBoardSecretEcho);
    } catch {
      /* ignore — may lack permission */
    }
  }, [hotelId]);

  const loadPortalSnapshot = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([fetchSelfOrderPortalSummary(hotelId), fetchSelfOrderMenu(hotelId)]);
      setPortal(p);
      setCurrency(m.currency || "USD");
      setPortalError(null);
      setActiveSnapPage(0);
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : "Could not load today’s snapshot");
    }
  }, [hotelId]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await apiFetch<StaffOrderRow[]>(`/api/v1/hotels/${hotelId}/inventory/self-service-orders`, {
        quiet: true,
      });
      setRows(Array.isArray(list) ? list : []);
      setOrdersPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load orders");
    }
  }, [hotelId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    void loadPortalSnapshot();
    const id = window.setInterval(() => void loadPortalSnapshot(), 15000);
    return () => window.clearInterval(id);
  }, [loadPortalSnapshot]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / ORDERS_PAGE_SIZE) - 1);
    setOrdersPage((p) => Math.min(p, maxPage));
  }, [rows.length]);

  async function advance(orderId: string, status: string) {
    setBusy(orderId);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/inventory/self-service-orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        quiet: true,
      });
      await load();
      await loadPortalSnapshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function saveBoardSecret(clear: boolean) {
    setSettingsMsg(null);
    setError(null);
    try {
      const body = clear ? { clearBoardSecret: true } : { orderBoardSecret: boardSecretDraft.trim() };
      const s = await putStaffSelfOrderSettings(hotelId, body);
      setBoardKeyConfigured(s.orderBoardKeyConfigured);
      setBoardKeyEcho(s.orderBoardSecretEcho ?? null);
      if (clear) {
        setBoardSecretDraft("");
        setBoardKeyEcho(null);
      }
      setSettingsMsg(clear ? "Board secret cleared." : "Board secret saved. Use the QR or URL on the TV browser.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save board secret");
    }
  }

  async function onConfirmPayment(orderId: string) {
    const method = window.prompt("Payment method label (e.g. CASH, MOMO):", "CASH")?.trim() || "CASH";
    setBusy(orderId);
    setError(null);
    try {
      await confirmSelfOrderPayment(hotelId, orderId, method);
      await load();
      await loadPortalSnapshot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Self-service orders</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Orders from the public kiosk. Sellable items are{" "}
            <Link href={staffAppPath("menu")} className="underline font-medium text-foreground">
              Menu
            </Link>{" "}
            /{" "}
            <Link href={staffAppPath("inventory")} className="underline font-medium text-foreground">
              Inventory
            </Link>{" "}
            depot products. Guests order via the kiosk URL below — not here.
          </p>
        </div>
        <button
          type="button"
          className="hms-btn-outline hms-btn-sm"
          onClick={() => {
            void load();
            void loadPortalSnapshot();
          }}
        >
          Refresh
        </button>
      </div>

      {portalError && <div className="error">{portalError}</div>}
      {portal && (
        <section className="hms-section-card space-y-4">
          <h2 className="hms-section-title">Today (self-order snapshot)</h2>
          <p className="text-xs text-muted-foreground">
            Same aggregates as the public guest hub — refreshed automatically. Revenue counts paid self-orders only.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Orders</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{portal.todayOrderCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Revenue (paid)</p>
              <p className="text-2xl font-bold tabular-nums mt-1">
                {Number(portal.todayRevenueTotal) >= 1000
                  ? `${formatRevenueShort(currency, Number(portal.todayRevenueTotal))} ${currency}`
                  : formatMoney(currency, Number(portal.todayRevenueTotal))}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg fulfilment</p>
              <p className="text-2xl font-bold mt-1">
                {portal.avgFulfillmentMinutes != null ? `${portal.avgFulfillmentMinutes} min` : "—"}
              </p>
            </div>
          </div>
          {portal.activeOrders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Active tickets (public board)</h3>
              <ul className="space-y-2">
                {portal.activeOrders
                  .slice(
                    activeSnapPage * ACTIVE_SNAPSHOT_PAGE_SIZE,
                    activeSnapPage * ACTIVE_SNAPSHOT_PAGE_SIZE + ACTIVE_SNAPSHOT_PAGE_SIZE,
                  )
                  .map((o, i) => (
                    <li
                      key={`${o.displayCode}-${o.status}-${activeSnapPage}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-mono text-muted-foreground">#{o.displayCode}</span> · {o.lineSummary || "—"}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          o.status === "READY"
                            ? "bg-emerald-600 text-white"
                            : o.status === "IN_PROGRESS"
                              ? "bg-amber-400 text-zinc-900"
                              : "bg-red-600/90 text-white"
                        }`}
                      >
                        {adminStatusLabel(o.status)}
                      </span>
                    </li>
                  ))}
              </ul>
              {portal.activeOrders.length > ACTIVE_SNAPSHOT_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm"
                    disabled={activeSnapPage <= 0}
                    onClick={() => setActiveSnapPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activeSnapPage + 1} / {Math.ceil(portal.activeOrders.length / ACTIVE_SNAPSHOT_PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    className="hms-btn-outline hms-btn-sm"
                    disabled={(activeSnapPage + 1) * ACTIVE_SNAPSHOT_PAGE_SIZE >= portal.activeOrders.length}
                    onClick={() => setActiveSnapPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {error && <div className="error">{error}</div>}
      {settingsMsg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{settingsMsg}</p>}

      <section className="hms-section-card space-y-4">
        <h2 className="hms-section-title">Kiosk &amp; TV QR codes</h2>
        <p className="text-xs text-muted-foreground">
          Kiosk = guest ordering. TV screen = kitchen board (optional secret below).
        </p>
        <div className="flex flex-wrap gap-8 justify-start">
          {kioskUrl ? <SelfOrderQrBlock value={kioskUrl} caption="Scan to open self-order (kiosk)" /> : null}
          {screenUrlForQr ? (
            <SelfOrderQrBlock value={screenUrlForQr} caption="Scan on the TV device (includes board key)" />
          ) : (
            <p className="text-sm text-muted-foreground self-center max-w-xs">
              Set or generate a board secret below to enable the TV QR code.
            </p>
          )}
        </div>
        <div className="grid gap-2 text-sm max-w-2xl">
          <label className="font-medium">Kiosk URL</label>
          <input readOnly value={kioskUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          <label className="font-medium mt-2">TV screen URL (with key)</label>
          <input readOnly value={screenUrlForQr || "(set board secret)"} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        </div>
      </section>

      <section className="hms-section-card space-y-3">
        <h2 className="hms-section-title">Kitchen board secret</h2>
        <p className="text-xs text-muted-foreground">
          Optional: TV board URL then needs <code className="bg-muted px-1 rounded">?key=…</code>.{" "}
          {boardKeyConfigured ? "Secret is set." : "No secret — board URL is open."}
        </p>
        <div className="flex flex-wrap gap-2 items-end max-w-xl">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm block mb-1">New secret (paste or generate)</label>
            <input
              value={boardSecretDraft}
              onChange={(e) => setBoardSecretDraft(e.target.value)}
              className="w-full font-mono text-sm"
              placeholder="e.g. random string"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setBoardSecretDraft(randomBoardKey())}>
            Generate
          </button>
          <button type="button" className="hms-btn-solid hms-btn-sm" onClick={() => void saveBoardSecret(false)}>
            Save secret
          </button>
          <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void saveBoardSecret(true)}>
            Clear secret
          </button>
        </div>
      </section>

      <section className="hms-section-card p-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-border flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {rows.length} order{rows.length === 1 ? "" : "s"}
            {rows.length > ORDERS_PAGE_SIZE
              ? ` · showing ${ordersPage * ORDERS_PAGE_SIZE + 1}–${Math.min((ordersPage + 1) * ORDERS_PAGE_SIZE, rows.length)}`
              : ""}
          </span>
          {rows.length > ORDERS_PAGE_SIZE && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hms-btn-outline hms-btn-sm"
                disabled={ordersPage <= 0}
                onClick={() => setOrdersPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </button>
              <span className="tabular-nums text-xs">
                Page {ordersPage + 1} / {Math.max(1, Math.ceil(rows.length / ORDERS_PAGE_SIZE))}
              </span>
              <button
                type="button"
                className="hms-btn-outline hms-btn-sm"
                disabled={(ordersPage + 1) * ORDERS_PAGE_SIZE >= rows.length}
                onClick={() => setOrdersPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
        <div className="hms-table-wrap bg-card">
          <table className="hms-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Order #</th>
                <th>Pay</th>
                <th>Type</th>
                <th>Status</th>
                <th>Depot</th>
                <th>Total</th>
                <th>Items</th>
                <th className="w-[1%] whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(ordersPage * ORDERS_PAGE_SIZE, ordersPage * ORDERS_PAGE_SIZE + ORDERS_PAGE_SIZE).map((r) => {
                const next = NEXT[r.status];
                const canCancel = r.status === "PLACED" || r.status === "IN_PROGRESS";
                const unpaid = r.paymentStatus === "UNPAID";
                return (
                  <tr key={r.orderId}>
                    <td className="font-mono font-bold">{r.displayCode}</td>
                    <td className="text-muted-foreground text-sm">{r.orderNumber}</td>
                    <td className="text-sm">
                      {unpaid ? (
                        <span className="text-amber-700 dark:text-amber-300 font-medium">Unpaid</span>
                      ) : (
                        <span className="text-muted-foreground">{r.paymentMethod ?? "—"}</span>
                      )}
                    </td>
                    <td>{r.serviceType === "DINE_IN" ? "Dine in" : "Take away"}</td>
                    <td>{r.status.replace("_", " ")}</td>
                    <td>{r.depotName}</td>
                    <td className="tabular-nums">{Number(r.totalAmount).toFixed(2)}</td>
                    <td className="max-w-[200px] text-sm text-muted-foreground">
                      {r.lines.map((l) => `${l.productName}×${Number(l.quantity)}`).join(", ")}
                    </td>
                    <td className="text-right space-x-1 whitespace-nowrap">
                      {unpaid && (
                        <button
                          type="button"
                          className="hms-btn-solid hms-btn-sm"
                          disabled={busy === r.orderId}
                          onClick={() => void onConfirmPayment(r.orderId)}
                        >
                          Confirm payment
                        </button>
                      )}
                      {next && (
                        <button
                          type="button"
                          className="hms-btn-outline hms-btn-sm"
                          disabled={busy === r.orderId}
                          onClick={() => void advance(r.orderId, next)}
                        >
                          → {next.replace("_", " ")}
                        </button>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          className="hms-btn-outline hms-btn-sm"
                          disabled={busy === r.orderId}
                          onClick={() => void advance(r.orderId, "CANCELLED")}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-8">
                    No self-service orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground px-4 pb-4">
          Open the live board:{" "}
          <Link href={`/book/order/${hotelId}/screen`} target="_blank" rel="noopener noreferrer" className="underline">
            without key
          </Link>
          {boardKeyEcho || boardSecretDraft.trim() ? (
            <>
              {" "}
              or{" "}
              <Link
                href={`/book/order/${hotelId}/screen?key=${encodeURIComponent((boardKeyEcho ?? boardSecretDraft).trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                with current key
              </Link>
            </>
          ) : null}
        </p>
      </section>
    </div>
  );
}
