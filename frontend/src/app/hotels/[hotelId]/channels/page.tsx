"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type ChannelConnection = {
  id: string;
  channelCode: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  lastSyncAt: string | null;
  syncErrors: number;
  config?: string | null;
};

const BOOKING_DEFAULT_AVAILABILITY_ENDPOINT = "https://supply-xml.booking.com/ota/OTA_HotelAvailNotif";

export default function ChannelsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [ratePlans, setRatePlans] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showBookingSettings, setShowBookingSettings] = useState(false);
  const [savingBookingSettings, setSavingBookingSettings] = useState(false);
  const [bookingSettings, setBookingSettings] = useState({
    hotelCode: "",
    username: "",
    password: "",
    availabilityEndpoint: BOOKING_DEFAULT_AVAILABILITY_ENDPOINT,
  });

  // New mapping form state
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [newMap, setNewMap] = useState({
    connectionId: "",
    roomTypeId: "",
    channelRoomCode: "",
    rateMarkupPct: "0",
    minStay: "1"
  });

  async function loadData() {
    setLoading(true);
    try {
      const [conns, rts] = await Promise.all([
        apiFetch<ChannelConnection[]>(`/api/v1/hotels/${hotelId}/channels`),
        apiFetch<any[]>(`/api/v1/hotels/${hotelId}/room-types`)
      ]);
      setConnections(conns);
      setRoomTypes(rts);

      // Fetch rate plans for each connection
      const allPlans = await Promise.all(
        conns.map(c => apiFetch<any[]>(`/api/v1/hotels/${hotelId}/channels/${c.id}/rate-plans`))
      );
      setRatePlans(allPlans.flat());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channel data");
    } finally {
      setLoading(false);
    }
  }

  async function addMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!newMap.connectionId || !newMap.roomTypeId) return;
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/channels/${newMap.connectionId}/rate-plans`, {
        method: "POST",
        body: JSON.stringify(newMap)
      });
      setShowAddMapping(false);
      await loadData();
    } catch (e) {
      alert("Failed to add mapping");
    }
  }

  async function deleteMapping(connectionId: string, planId: string) {
    if (!confirm("Are you sure you want to remove this mapping? This will stop synchronization for this room type.")) return;
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/channels/${connectionId}/rate-plans/${planId}`, {
        method: "DELETE"
      });
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function connectChannel(channelCode: string) {
    setLoading(true);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/channels`, {
        method: "POST",
        body: JSON.stringify({ channelCode, status: "CONNECTED" }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  function parseConnectionConfig(connection?: ChannelConnection) {
    if (!connection?.config) return {};
    try {
      return JSON.parse(connection.config) as Record<string, string>;
    } catch {
      return {};
    }
  }

  function openBookingSettings() {
    const config = parseConnectionConfig(bookingConn);
    setBookingSettings({
      hotelCode: config.hotelCode || "",
      username: "",
      password: "",
      availabilityEndpoint: config.availabilityEndpoint || BOOKING_DEFAULT_AVAILABILITY_ENDPOINT,
    });
    setShowBookingSettings(true);
  }

  async function saveBookingSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingSettings.hotelCode.trim() || !bookingSettings.username.trim() || !bookingSettings.password.trim()) {
      setError("Booking.com hotel code, username, and password are required.");
      return;
    }
    setSavingBookingSettings(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/channels`, {
        method: "POST",
        body: JSON.stringify({
          channelCode: "BOOKING_COM",
          status: "CONNECTED",
          credentials: JSON.stringify({
            username: bookingSettings.username.trim(),
            password: bookingSettings.password,
          }),
          config: JSON.stringify({
            hotelCode: bookingSettings.hotelCode.trim(),
            availabilityEndpoint: bookingSettings.availabilityEndpoint.trim() || BOOKING_DEFAULT_AVAILABILITY_ENDPOINT,
          }),
        }),
      });
      setShowBookingSettings(false);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save Booking.com settings");
    } finally {
      setSavingBookingSettings(false);
    }
  }

  async function triggerSync(connId: string) {
    setSyncingId(connId);
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/channels/${connId}/sync`, { method: "POST" });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingId(null);
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId]);

  const bookingConn = connections.find(c => c.channelCode === "BOOKING_COM");
  const expediaConn = connections.find(c => c.channelCode === "EXPEDIA");
  const airbnbConn = connections.find(c => c.channelCode === "AIRBNB");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Channel Manager</h1>
          <p className="text-sm text-muted-foreground">Sync inventory and rates with OTAs (Booking.com, Expedia, etc.)</p>
        </div>
        <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Booking.com */}
        <div className="hms-section-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xs">B.</div>
              <div>
                <h3 className="font-bold">Booking.com</h3>
                <span className="text-[10px] text-muted-foreground">XML/API Integration</span>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${bookingConn?.status === "CONNECTED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-muted"}`} />
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{bookingConn?.status || "NOT CONFIGURED"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="font-medium">{bookingConn?.lastSyncAt ? new Date(bookingConn.lastSyncAt).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!bookingConn ? (
              <button 
                className="w-full hms-btn-solid hms-btn-sm" 
                onClick={openBookingSettings}
                disabled={loading}
              >
                Connect Booking.com
              </button>
            ) : bookingConn.status === "DISCONNECTED" ? (
              <button 
                className="w-full hms-btn-solid hms-btn-sm" 
                onClick={openBookingSettings}
                disabled={loading}
              >
                Activate Connection
              </button>
            ) : (
              <>
                <button 
                  className="flex-1 hms-btn-solid hms-btn-sm" 
                  disabled={syncingId !== null}
                  onClick={() => triggerSync(bookingConn.id)}
                >
                  {syncingId === bookingConn.id ? "Syncing..." : "Sync Now"}
                </button>
                <button 
                  className="hms-btn-outline hms-btn-sm px-2"
                  onClick={openBookingSettings}
                >
                  Settings
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expedia */}
        <div className="hms-section-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-yellow-500 flex items-center justify-center text-white font-bold text-xs">E.</div>
              <div>
                <h3 className="font-bold">Expedia</h3>
                <span className="text-[10px] text-muted-foreground">Expedia QuickConnect</span>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${expediaConn?.status === "CONNECTED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-muted"}`} />
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{expediaConn?.status || "NOT CONFIGURED"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="font-medium">{expediaConn?.lastSyncAt ? new Date(expediaConn.lastSyncAt).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {!expediaConn ? (
              <button 
                className="w-full hms-btn-solid hms-btn-sm" 
                onClick={() => connectChannel("EXPEDIA")}
                disabled={loading}
              >
                Connect Expedia
              </button>
            ) : expediaConn.status === "DISCONNECTED" ? (
              <button 
                className="w-full hms-btn-solid hms-btn-sm" 
                onClick={() => connectChannel("EXPEDIA")}
                disabled={loading}
              >
                Activate Connection
              </button>
            ) : (
              <>
                <button 
                  className="flex-1 hms-btn-solid hms-btn-sm" 
                  disabled={syncingId !== null}
                  onClick={() => triggerSync(expediaConn.id)}
                >
                  {syncingId === expediaConn.id ? "Syncing..." : "Sync Now"}
                </button>
                <button 
                  className="hms-btn-outline hms-btn-sm px-2"
                  onClick={() => alert("Expedia Settings: Using QuickConnect API v2.")}
                >
                  Settings
                </button>
              </>
            )}
          </div>
        </div>

        {/* Airbnb / iCal */}
        <div className="hms-section-card flex flex-col justify-between border-dashed">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-rose-500 flex items-center justify-center text-white font-bold text-xs">iCal</div>
              <div>
                <h3 className="font-bold">Airbnb / iCal</h3>
                <span className="text-[10px] text-muted-foreground">Calendar Feed Sync</span>
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${airbnbConn?.status === "CONNECTED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-muted"}`} />
          </div>
          <div className="p-3 bg-muted/30 rounded text-[10px] font-mono break-all mb-4 border border-border/50">
            https://hms-api-global.com/api/v1/public/hotels/{hotelId}/ical/feed
          </div>
          <div className="flex gap-2">
            {!airbnbConn ? (
              <button 
                className="w-full hms-btn-solid hms-btn-sm" 
                onClick={() => connectChannel("AIRBNB")}
                disabled={loading}
              >
                Enable iCal Feed
              </button>
            ) : (
              <button 
                className="w-full hms-btn-outline hms-btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://hms-api-global.com/api/v1/public/hotels/${hotelId}/ical/feed`);
                  alert("Feed URL copied to clipboard! Paste this into Airbnb/VRBO calendar export settings.");
                }}
              >
                Copy Feed URL
              </button>
            )}
          </div>
        </div>
      </div>

      {showBookingSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form onSubmit={saveBookingSettings} className="w-full max-w-lg rounded-2xl border border-border bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Booking.com API Settings</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add your Booking.com Connectivity credentials and property code before syncing.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted"
                onClick={() => setShowBookingSettings(false)}
                aria-label="Close Booking.com settings"
              >
                x
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-900">
              Booking.com requires active Connectivity Partner/API credentials. Availability sync uses HTTPS XML with
              Basic Auth and UTF-8 XML payloads.
            </div>

            <div className="grid gap-4">
              <div>
                <label htmlFor="booking-hotel-code" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Booking.com Hotel / Property Code
                </label>
                <input
                  id="booking-hotel-code"
                  value={bookingSettings.hotelCode}
                  onChange={(e) => setBookingSettings((prev) => ({ ...prev, hotelCode: e.target.value }))}
                  placeholder="e.g. 6314570"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="booking-username" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    API Username
                  </label>
                  <input
                    id="booking-username"
                    value={bookingSettings.username}
                    onChange={(e) => setBookingSettings((prev) => ({ ...prev, username: e.target.value }))}
                    placeholder="Booking.com API user"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="booking-password" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    API Password
                  </label>
                  <input
                    id="booking-password"
                    type="password"
                    value={bookingSettings.password}
                    onChange={(e) => setBookingSettings((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={bookingConn ? "Enter to update" : "Password"}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="booking-endpoint" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Availability Endpoint
                </label>
                <input
                  id="booking-endpoint"
                  value={bookingSettings.availabilityEndpoint}
                  onChange={(e) => setBookingSettings((prev) => ({ ...prev, availabilityEndpoint: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="hms-btn-outline hms-btn-sm" onClick={() => setShowBookingSettings(false)}>
                Cancel
              </button>
              <button type="submit" className="hms-btn-solid hms-btn-sm" disabled={savingBookingSettings}>
                {savingBookingSettings ? "Saving..." : "Save & Connect"}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="hms-section-card mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="hms-section-title mb-0">Mapped Rate Plans</h2>
          {connections.some(c => c.status === "CONNECTED") && (
            <button 
              onClick={() => setShowAddMapping(!showAddMapping)} 
              className="hms-btn-solid hms-btn-sm"
            >
              {showAddMapping ? "Cancel" : "Add Mapping"}
            </button>
          )}
        </div>

        {showAddMapping && (
          <form onSubmit={addMapping} className="flex flex-wrap gap-4 items-end bg-muted/30 p-4 rounded-lg mb-6 border border-border/50">
            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">OTA Channel</label>
              <select 
                className="hms-input text-xs w-full" 
                value={newMap.connectionId} 
                onChange={e => setNewMap({...newMap, connectionId: e.target.value})}
                required
              >
                <option value="">Select Channel</option>
                {connections.filter(c => c.status === "CONNECTED").map(c => (
                  <option key={c.id} value={c.id}>{c.channelCode}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">HMS Room Type</label>
              <select 
                className="hms-input text-xs w-full" 
                value={newMap.roomTypeId} 
                onChange={e => setNewMap({...newMap, roomTypeId: e.target.value})}
                required
              >
                <option value="">Select Room</option>
                {roomTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">OTA Code</label>
              <input 
                type="text" 
                placeholder="e.g. DXL-KING" 
                className="hms-input text-xs w-full"
                value={newMap.channelRoomCode}
                onChange={e => setNewMap({...newMap, channelRoomCode: e.target.value})}
                required
              />
            </div>
            <div className="w-[80px]">
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Markup %</label>
              <input 
                type="number" 
                className="hms-input text-xs w-full"
                value={newMap.rateMarkupPct}
                onChange={e => setNewMap({...newMap, rateMarkupPct: e.target.value})}
              />
            </div>
            <div className="w-[80px]">
              <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">Min Stay</label>
              <input 
                type="number" 
                className="hms-input text-xs w-full"
                value={newMap.minStay}
                onChange={e => setNewMap({...newMap, minStay: e.target.value})}
              />
            </div>
            <button type="submit" className="hms-btn-solid hms-btn-sm h-9 px-6 whitespace-nowrap">Save Mapping</button>
          </form>
        )}

        <div className="hms-table-wrap overflow-x-auto">
          <table className="hms-table text-sm min-w-[700px]">
            <thead>
              <tr>
                <th>Internal Room Type</th>
                <th>Channel Code</th>
                <th>OTA Code</th>
                <th>Markup</th>
                <th>Min Stay</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ratePlans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground italic">No active mappings. Connect a channel to begin.</td>
                </tr>
              ) : (
                ratePlans.map(rp => {
                  const conn = connections.find(c => c.id === rp.connectionId);
                  const rt = roomTypes.find(t => t.id === rp.roomTypeId);
                  return (
                    <tr key={rp.id}>
                      <td className="font-medium">{rt?.name || rp.roomTypeId}</td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">
                          {conn?.channelCode || "Unknown"}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{rp.channelRoomCode}</td>
                      <td>{rp.rateMarkupPct}%</td>
                      <td>{rp.minStay} nights</td>
                      <td className="text-right">
                        <button 
                          className="text-destructive hover:underline text-xs" 
                          onClick={() => deleteMapping(rp.connectionId, rp.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
