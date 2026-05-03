"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SelfOrderQrBlock } from "@/components/SelfOrderQrBlock";
import { apiFetch } from "@/lib/api";
import {
  confirmSelfOrderPayment,
  fetchStaffSelfOrderSettings,
  putStaffSelfOrderSettings,
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await apiFetch<StaffOrderRow[]>(`/api/v1/hotels/${hotelId}/inventory/self-service-orders`, {
        quiet: true,
      });
      setRows(Array.isArray(list) ? list : []);
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
            Confirm pay-at-counter orders before kitchen steps. Configure a board secret so the live TV URL is not
            guessable from the hotel id alone.
          </p>
        </div>
        <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {settingsMsg && <p className="text-sm text-emerald-700 dark:text-emerald-300">{settingsMsg}</p>}

      <section className="hms-section-card space-y-4">
        <h2 className="hms-section-title">Kiosk &amp; TV QR codes</h2>
        <p className="text-sm text-muted-foreground">
          Guests open the kiosk from this link. The kitchen TV should use the screen URL including the secret query
          once you set it below.
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
        <p className="text-sm text-muted-foreground">
          When set, <code className="text-xs bg-muted px-1 rounded">GET …/self-order/board</code> requires matching{" "}
          <code className="text-xs bg-muted px-1 rounded">?key=…</code>. Leave empty and save to allow open access
          again.
        </p>
        <p className="text-xs text-muted-foreground">
          Status: {boardKeyConfigured ? "secret is configured on the server" : "no secret — board is open by URL"}
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
              {rows.map((r) => {
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
