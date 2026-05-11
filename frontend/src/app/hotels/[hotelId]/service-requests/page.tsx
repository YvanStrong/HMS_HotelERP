"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type ServiceRequest = {
  id: string;
  requestType: string;
  description: string;
  status: "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  roomNumber?: string;
  bookingCode?: string;
  createdAt: string;
};

export default function ServiceRequestsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const data = await apiFetch<ServiceRequest[]>(`/api/v1/hotels/${hotelId}/service-requests/pending`);
      setRequests(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load service requests");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/service-requests/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Active Service Requests</h1>
          <p className="text-sm text-muted-foreground">Manage in-stay guest requests for towels, room service, etc.</p>
        </div>
        <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid gap-4">
        {requests.map((req) => (
          <div key={req.id} className="hms-section-card flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {req.roomNumber || "?"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm">{req.requestType.replace("_", " ")}</h3>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    req.priority === "URGENT" ? "bg-rose-100 text-rose-700" :
                    req.priority === "HIGH" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {req.priority}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{req.description || "No additional notes"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Requested {new Date(req.createdAt).toLocaleTimeString()} · Code: {req.bookingCode || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right mr-4">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                  req.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                  req.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                  "bg-emerald-100 text-emerald-700"
                }`}>
                  {req.status}
                </span>
              </div>
              {req.status === "PENDING" && (
                <button onClick={() => updateStatus(req.id, "IN_PROGRESS")} className="hms-btn-solid hms-btn-sm">Accept</button>
              )}
              {req.status === "IN_PROGRESS" && (
                <button onClick={() => updateStatus(req.id, "COMPLETED")} className="hms-btn-solid hms-btn-sm bg-emerald-600 hover:bg-emerald-700">Complete</button>
              )}
              <button onClick={() => updateStatus(req.id, "CANCELLED")} className="hms-btn-outline hms-btn-sm text-rose-600 hover:bg-rose-50">Cancel</button>
            </div>
          </div>
        ))}
        
        {requests.length === 0 && !loading && (
          <div className="hms-section-card py-20 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-bold text-lg">All caught up!</h3>
            <p className="text-muted-foreground text-sm">No pending service requests at this time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
