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
};

export default function ChannelsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await apiFetch<ChannelConnection[]>(`/api/v1/hotels/${hotelId}/channels`);
      setConnections(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channel data");
    } finally {
      setLoading(false);
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
            <div className={`w-2 h-2 rounded-full ${connections.find(c => c.channelCode === "BOOKING_COM")?.status === "CONNECTED" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-muted"}`} />
          </div>
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{connections.find(c => c.channelCode === "BOOKING_COM")?.status || "NOT CONFIGURED"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Last Sync</span>
              <span className="font-medium">{connections.find(c => c.channelCode === "BOOKING_COM")?.lastSyncAt ? new Date(connections.find(c => c.channelCode === "BOOKING_COM")!.lastSyncAt!).toLocaleTimeString() : "Never"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              className="flex-1 hms-btn-solid hms-btn-sm" 
              disabled={syncingId !== null}
              onClick={() => {
                const conn = connections.find(c => c.channelCode === "BOOKING_COM");
                if (conn) triggerSync(conn.id);
              }}
            >
              {syncingId && connections.find(c => c.id === syncingId)?.channelCode === "BOOKING_COM" ? "Syncing..." : "Sync Now"}
            </button>
            <button className="hms-btn-outline hms-btn-sm px-2">Settings</button>
          </div>
        </div>

        {/* Expedia */}
        <div className="hms-section-card flex flex-col justify-between opacity-75">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-yellow-500 flex items-center justify-center text-white font-bold text-xs">E.</div>
              <div>
                <h3 className="font-bold">Expedia</h3>
                <span className="text-[10px] text-muted-foreground">Expedia QuickConnect</span>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-muted" />
          </div>
          <p className="text-[10px] text-center italic text-muted-foreground my-4">Coming soon to Phase 2</p>
          <button className="w-full hms-btn-outline hms-btn-sm" disabled>Connect Expedia</button>
        </div>

        {/* iCal / Airbnb */}
        <div className="hms-section-card flex flex-col justify-between border-dashed">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-rose-500 flex items-center justify-center text-white font-bold text-xs">iCal</div>
              <div>
                <h3 className="font-bold">Airbnb / iCal</h3>
                <span className="text-[10px] text-muted-foreground">Calendar Feed Sync</span>
              </div>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded text-[10px] font-mono break-all mb-4 border border-border/50">
            https://hms-api.ishyiga.com/api/v1/public/hotels/{hotelId}/ical/feed
          </div>
          <button className="w-full hms-btn-outline hms-btn-sm">Copy Feed URL</button>
        </div>
      </div>

      <section className="hms-section-card mt-8">
        <h2 className="hms-section-title">Mapped Rate Plans</h2>
        <div className="hms-table-wrap">
          <table className="hms-table text-sm">
            <thead>
              <tr>
                <th>Internal Room Type</th>
                <th>Channel Code</th>
                <th>Markup</th>
                <th>Min Stay</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground italic">No active mappings. Connect a channel to begin.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
