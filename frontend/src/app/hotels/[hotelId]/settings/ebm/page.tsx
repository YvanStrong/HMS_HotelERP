"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  disableEbmDevice,
  initializeEbmDevice,
  loadEbmOutbox,
  loadEbmSaleEvents,
  loadEbmStatus,
  registerEbmDevice,
  type EbmOutboxRow,
  type EbmSaleEventRow,
  type EbmStatus,
} from "@/lib/ebmApi";
import { staffAppPath } from "@/lib/staffAppRoutes";

export default function EbmSettingsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [status, setStatus] = useState<EbmStatus | null>(null);
  const [outbox, setOutbox] = useState<EbmOutboxRow[]>([]);
  const [events, setEvents] = useState<EbmSaleEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState("VSDC");
  const [tin, setTin] = useState("");
  const [branchId, setBranchId] = useState("00");
  const [serial, setSerial] = useState("");
  const [endpoint, setEndpoint] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, o, e] = await Promise.all([
        loadEbmStatus(hotelId),
        loadEbmOutbox(hotelId),
        loadEbmSaleEvents(hotelId),
      ]);
      setStatus(s);
      setOutbox(o);
      setEvents(e);
      setTin((prev) => (prev ? prev : s.hotelTin ?? ""));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load EBM status");
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDevice() {
    if (!serial.trim() || !endpoint.trim()) {
      setError("Device serial and VSDC/OSDC endpoint URL are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await registerEbmDevice(hotelId, {
        mode,
        tin: tin.trim() || undefined,
        branchId: branchId.trim() || undefined,
        deviceSerialNo: serial.trim(),
        vsdcEndpointUrl: endpoint.trim(),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register device");
    } finally {
      setBusy(false);
    }
  }

  async function initDevice(deviceId: string) {
    setBusy(true);
    setError(null);
    try {
      await initializeEbmDevice(hotelId, deviceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialization failed");
    } finally {
      setBusy(false);
    }
  }

  async function disableDevice(deviceId: string) {
    setBusy(true);
    try {
      await disableEbmDevice(hotelId, deviceId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disable failed");
    } finally {
      setBusy(false);
    }
  }

  const alertColor =
    status?.offlineAlertLevel === "CRITICAL"
      ? "border-red-200 bg-red-50 text-red-800"
      : status?.offlineAlertLevel === "WARN"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href={staffAppPath("settings")} className="text-sm font-semibold text-indigo-700 hover:underline">
        ← Settings
      </Link>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">RRA fiscalization</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900">EBM / VSDC settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register the hotel CIS device, run Initialization once, then monitor the ordered submission queue
          (Transaction → Invoice → Stock I/O → Stock master).
        </p>
      </div>

      {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}

      <section className="hms-section-card space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Runtime status</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="EBM enabled" value={status?.ebmEnabled ? "Yes" : "No — set HMS_EBM_ENABLED"} />
          <Stat label="Pending outbox" value={String(status?.pendingOutbox ?? "—")} />
          <Stat label="Failed sales" value={String(status?.failedSaleEvents ?? "—")} />
          <Stat label="Offline alert" value={status?.offlineAlertLevel ?? "—"} />
        </div>
        {status?.offlineAlertLevel && status.offlineAlertLevel !== "NONE" && (
          <p className={`rounded-xl border p-3 text-sm ${alertColor}`}>
            Last receipt signature: {status.lastSignatureAt ?? "never"}. Restore connectivity before 24 hours or
            VSDC stops issuing receipt numbers.
          </p>
        )}
        {!status?.ebmEnabled && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            Backend flag <code className="font-mono text-xs">hms.ebm.enabled</code> / env{" "}
            <code className="font-mono text-xs">HMS_EBM_ENABLED=true</code> and{" "}
            <code className="font-mono text-xs">EBM_KEY_ENCRYPTION_SECRET</code> must be set before Initialization.
          </p>
        )}
      </section>

      <section className="hms-section-card space-y-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Register device</p>
          <h2 className="mt-1 text-lg font-black">Initialization prerequisites</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="VSDC">VSDC (local WAR)</option>
              <option value="OSDC">OSDC (RRA cloud)</option>
            </select>
          </div>
          <div>
            <label>TIN</label>
            <input value={tin} onChange={(e) => setTin(e.target.value)} placeholder="Taxpayer TIN" />
          </div>
          <div>
            <label>Branch ID (bhfId)</label>
            <input value={branchId} onChange={(e) => setBranchId(e.target.value)} placeholder="00" />
          </div>
          <div>
            <label>Device serial no</label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Device serial" />
          </div>
          <div className="md:col-span-2">
            <label>VSDC / OSDC endpoint URL</label>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="http://192.168.1.10:8080/vsdc or https://osdc.rra.gov.rw/..."
            />
          </div>
        </div>
        <button type="button" className="hms-btn-solid hms-btn-sm" disabled={busy} onClick={() => void saveDevice()}>
          Save device
        </button>
      </section>

      <section className="hms-section-card space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Devices</p>
        <ul className="space-y-2">
          {(status?.devices ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border bg-white px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {d.deviceSerialNo} · {d.mode} ·{" "}
                    <span className="text-primary">{d.status}</span>
                  </p>
                  <p className="text-muted-foreground">
                    TIN {d.tin} · branch {d.branchId ?? "—"} · SDC {d.sdcId ?? "—"} · MRC {d.mrcNo ?? "—"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{d.vsdcEndpointUrl}</p>
                  {d.lastError && <p className="mt-1 text-amber-700">{d.lastError}</p>}
                </div>
                <div className="flex gap-2">
                  {d.status !== "ACTIVE" && (
                    <button
                      type="button"
                      className="hms-btn-solid hms-btn-sm"
                      disabled={busy}
                      onClick={() => void initDevice(d.id)}
                    >
                      Initialize
                    </button>
                  )}
                  {d.status === "ACTIVE" && (
                    <button
                      type="button"
                      className="hms-btn-outline hms-btn-sm"
                      disabled={busy}
                      onClick={() => void disableDevice(d.id)}
                    >
                      Disable
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
          {(status?.devices?.length ?? 0) === 0 && (
            <li className="text-sm text-muted-foreground">No EBM device registered yet.</li>
          )}
        </ul>
      </section>

      <section className="hms-section-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Outbox queue</p>
          <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
        <div className="hms-table-wrap overflow-x-auto">
          <table className="hms-table w-full text-left text-sm">
            <thead>
              <tr>
                <th>Phase</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold">{row.phase}</td>
                  <td>{row.status}</td>
                  <td>{row.attempts}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td className="max-w-xs truncate text-amber-700">{row.lastError ?? "—"}</td>
                </tr>
              ))}
              {outbox.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground">
                    No outbox entries yet. Complete a sale after the device is ACTIVE.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="hms-section-card space-y-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Taxable sale events</p>
        <div className="hms-table-wrap overflow-x-auto">
          <table className="hms-table w-full text-left text-sm">
            <thead>
              <tr>
                <th>Source</th>
                <th>Document</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {events.map((row) => (
                <tr key={row.id}>
                  <td>{row.sourceType}</td>
                  <td>{row.documentNumber ?? "—"}</td>
                  <td>{row.ebmStatus}</td>
                  <td>{row.ebmReceiptNo ?? "—"}</td>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-muted-foreground">
                    No fiscal sale events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
