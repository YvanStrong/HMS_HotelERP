"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";

const SERVICE_CATEGORIES = [
  { id: "housekeeping", label: "Housekeeping", options: ["Extra Towels", "Room Cleaning", "Refill Toiletries", "Extra Water"] },
  { id: "maintenance", label: "Maintenance", options: ["AC/Heating Issue", "TV/Wi-Fi Issue", "Plumbing Issue", "Light Bulb"] },
  { id: "room_service", label: "Room Service", options: ["Laundry Pickup", "Turndown Service", "Wake-up Call", "Concierge"] },
];

export default function GuestServicesPage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = String(params.hotelId);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [bookingCode, setBookingCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function toggleOption(opt: string) {
    setSelectedOptions(prev => 
      prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedOptions.length === 0 && !description.trim()) {
      setError("Please select at least one item or describe what you need.");
      return;
    }
    if (!roomNumber || !bookingCode) {
      setError("Room number and Booking code are required for verification.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const combinedDesc = [
        ...selectedOptions,
        description.trim() ? `Note: ${description.trim()}` : ""
      ].filter(Boolean).join(", ");

      await apiFetch(`/api/v1/hotels/${hotelId}/service-requests`, {
        method: "POST",
        body: JSON.stringify({
          requestType: selectedOptions[0] || "OTHER",
          description: combinedDesc,
          roomNumber,
          bookingCode,
          status: "OPEN",
          priority: "NORMAL",
        }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-zinc-950 p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-6">
          <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Request Received!</h1>
          <p className="text-zinc-400">Our team has been notified and will attend to your request shortly.</p>
          <button 
            onClick={() => router.back()}
            className="w-full py-3 bg-white text-black font-bold rounded-xl"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-zinc-950 text-white p-4">
      <header className="max-w-2xl mx-auto py-6 flex items-center gap-4">
        <button onClick={() => router.back()} className="h-10 w-10 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-xl font-bold">Guest Services</h1>
      </header>

      <main className="max-w-2xl mx-auto space-y-8 pb-10">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold mb-2">How can we help?</h2>
          <p className="text-sm text-zinc-400">Select one or more items, or describe what you need below.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-lg">{error}</div>}

          <div className="grid gap-4">
            {SERVICE_CATEGORIES.map(cat => (
              <div key={cat.id} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">{cat.label}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {cat.options.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleOption(opt)}
                      className={`py-3 px-3 rounded-xl border text-sm font-medium text-left transition-all ${
                        selectedOptions.includes(opt) ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{opt}</span>
                        {selectedOptions.includes(opt) && (
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Room Verification</label>
              <div className="grid grid-cols-2 gap-3">
                <input 
                  required
                  placeholder="Room #"
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-emerald-500"
                />
                <input 
                  required
                  placeholder="Booking Code"
                  value={bookingCode}
                  onChange={e => setBookingCode(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-sm focus:ring-emerald-500"
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">Required to ensure service is delivered to the correct room.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">Additional Notes (Optional)</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Any specific details..."
                className="w-full bg-zinc-900 border-zinc-800 rounded-xl px-4 py-3 text-sm h-24 focus:ring-emerald-500"
              />
            </div>

            <button 
              disabled={submitting}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {submitting ? "Sending..." : "Submit Request"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
