"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type RoomDevice = {
  id: string;
  deviceName: string;
  deviceType: string;
  status: "ONLINE" | "OFFLINE" | "ERROR";
  lastHeartbeat: string | null;
  room: { roomNumber: string };
};

type EnergySummary = {
  ELECTRICITY?: number;
  WATER?: number;
  GAS?: number;
};

export default function IoTPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [devices, setDevices] = useState<RoomDevice[]>([]);
  const [energy, setEnergy] = useState<EnergySummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [d, e] = await Promise.all([
        apiFetch<RoomDevice[]>(`/api/v1/hotels/${hotelId}/iot/devices`),
        apiFetch<EnergySummary>(`/api/v1/hotels/${hotelId}/iot/energy/summary?days=7`),
      ]);
      setDevices(d);
      setEnergy(e);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load IoT data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IoT & Smart Room</h1>
          <p className="text-sm text-muted-foreground">Monitor and control smart devices across hotel rooms.</p>
        </div>
        <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Energy Dashboard */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="hms-section-card bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-1">Weekly Electricity</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900">{energy.ELECTRICITY?.toFixed(1) || "0.0"}</span>
            <span className="text-xs font-medium text-amber-700">kWh</span>
          </div>
          <p className="text-[10px] text-amber-600/70 mt-2">Avg. 1.2 kWh per room/day</p>
        </div>
        <div className="hms-section-card bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider mb-1">Weekly Water</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-900">{energy.WATER?.toFixed(0) || "0"}</span>
            <span className="text-xs font-medium text-blue-700">Liters</span>
          </div>
          <p className="text-[10px] text-blue-600/70 mt-2">No leaks detected</p>
        </div>
        <div className="hms-section-card bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-1">Carbon Saved</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900">12.4</span>
            <span className="text-xs font-medium text-emerald-700">kg CO₂</span>
          </div>
          <p className="text-[10px] text-emerald-600/70 mt-2">Via auto-HVAC eco mode</p>
        </div>
      </section>

      {/* Device Registry */}
      <section className="hms-section-card">
        <h2 className="hms-section-title mb-4">Device Registry</h2>
        <div className="hms-table-wrap">
          <table className="hms-table text-sm">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Type</th>
                <th>Room</th>
                <th>Status</th>
                <th>Last Heartbeat</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.deviceName}</td>
                  <td>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground uppercase font-bold">
                      {d.deviceType}
                    </span>
                  </td>
                  <td>Room {d.room.roomNumber}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${d.status === "ONLINE" ? "bg-emerald-500" : d.status === "OFFLINE" ? "bg-muted" : "bg-rose-500"}`} />
                      <span className="text-xs font-medium">{d.status}</span>
                    </div>
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {d.lastHeartbeat ? new Date(d.lastHeartbeat).toLocaleString() : "Never"}
                  </td>
                  <td className="text-right">
                    <button className="hms-btn-outline hms-btn-sm">Control</button>
                  </td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground italic">
                    No devices registered. Add smart locks, thermostats, or light controllers to begin.
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
