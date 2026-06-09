"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { loadVenues, type VenueOption } from "@/lib/eventApi";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { EVENT_FIELDS } from "@/lib/groupEventsCopy";

const SETUP_STYLE_EXAMPLES = "e.g. Banquet rounds, Classroom, Theater, U-shape, Cocktail";

type ConflictResponse = {
  conflict: boolean;
  message: string;
};

type EventForm = {
  eventName: string;
  eventType: string;
  status: string;
  startDatetime: string;
  endDatetime: string;
  setupStyle: string;
  expectedPax: string;
  guaranteedPax: string;
  venueOrFacilityId: string;
  coordinatorNotes: string;
};

const initialForm: EventForm = {
  eventName: "",
  eventType: "CONFERENCE",
  status: "TENTATIVE",
  startDatetime: "",
  endDatetime: "",
  setupStyle: "",
  expectedPax: "",
  guaranteedPax: "",
  venueOrFacilityId: "",
  coordinatorNotes: "",
};

function toPayload(form: EventForm): Record<string, unknown> {
  return {
    eventName: form.eventName.trim(),
    eventType: form.eventType,
    status: form.status,
    startDatetime: form.startDatetime,
    endDatetime: form.endDatetime,
    setupStyle: form.setupStyle.trim() || null,
    expectedPax: form.expectedPax ? Number(form.expectedPax) : null,
    guaranteedPax: form.guaranteedPax ? Number(form.guaranteedPax) : null,
    venueOrFacilityId: form.venueOrFacilityId || null,
    coordinatorNotes: form.coordinatorNotes.trim() || null,
  };
}

export default function NewGroupEventPage() {
  const params = useParams();
  const router = useRouter();
  const hotelId = String(params.hotelId);
  const groupId = String(params.groupId);

  const [form, setForm] = useState<EventForm>(initialForm);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [conflict, setConflict] = useState<ConflictResponse | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadVenues(hotelId)
      .then((rows) => setVenues(Array.isArray(rows) ? rows : []))
      .catch(() => setVenues([]));
  }, [hotelId]);

  const checkConflict = useCallback(async () => {
    if (!form.venueOrFacilityId || !form.startDatetime || !form.endDatetime) {
      setConflict(null);
      return;
    }
    setCheckingConflict(true);
    try {
      const query = new URLSearchParams({
        venueOrFacilityId: form.venueOrFacilityId,
        startDatetime: form.startDatetime,
        endDatetime: form.endDatetime,
      });
      const result = await apiFetch<ConflictResponse>(
        `/api/v1/hotels/${hotelId}/groups/${groupId}/events/conflicts?${query.toString()}`,
      );
      setConflict(result);
    } catch (e) {
      setConflict({ conflict: true, message: e instanceof Error ? e.message : "Could not check venue conflict." });
    } finally {
      setCheckingConflict(false);
    }
  }, [form.endDatetime, form.startDatetime, form.venueOrFacilityId, groupId, hotelId]);

  useEffect(() => {
    void checkConflict();
  }, [checkConflict]);

  async function saveEvent() {
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>(`/api/v1/hotels/${hotelId}/groups/${groupId}/events`, {
        method: "POST",
        body: JSON.stringify(toPayload(form)),
      });
      router.push(staffAppPath("groups", groupId, "events", created.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create event.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100/80 via-background to-muted/20 pb-16">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <Link href={staffAppPath("groups", groupId)} className="text-sm font-semibold text-indigo-700 hover:underline">
            ← Back to group
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">New banquet / event</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a group-attached event. Confirmed events check the selected facility for overlapping bookings.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
            {error}
          </div>
        ) : null}

        {conflict ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
              conflict.conflict ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {checkingConflict ? "Checking venue..." : conflict.message}
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 sm:col-span-2">
            Event name
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.eventName}
              onChange={(e) => setForm((v) => ({ ...v, eventName: e.target.value }))}
              placeholder="e.g. Gala dinner"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Event type
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.eventType}
              onChange={(e) => setForm((v) => ({ ...v, eventType: e.target.value }))}
            >
              <option value="CONFERENCE">Conference</option>
              <option value="WEDDING">Wedding</option>
              <option value="GALA">Gala</option>
              <option value="MEETING">Meeting</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Status
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.status}
              onChange={(e) => setForm((v) => ({ ...v, status: e.target.value }))}
            >
              <option value="TENTATIVE">Tentative</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            Start date/time
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.startDatetime}
              onChange={(e) => setForm((v) => ({ ...v, startDatetime: e.target.value }))}
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
            End date/time
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.endDatetime}
              onChange={(e) => setForm((v) => ({ ...v, endDatetime: e.target.value }))}
            />
          </label>
          <FieldLabel label={EVENT_FIELDS.venue.label} hint={EVENT_FIELDS.venue.hint}>
            <select
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.venueOrFacilityId}
              onChange={(e) => setForm((v) => ({ ...v, venueOrFacilityId: e.target.value }))}
            >
              <option value="">{EVENT_FIELDS.venueTbdOption}</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                  {venue.code ? ` (${venue.code})` : ""}
                </option>
              ))}
            </select>
            {venues.length === 0 ? (
              <p className="mt-2 text-xs text-amber-800">
                {EVENT_FIELDS.venueEmptyHint}{" "}
                <Link href={staffAppPath("facilities")} className="font-semibold underline">
                  Open Facilities
                </Link>
              </p>
            ) : null}
          </FieldLabel>
          <FieldLabel label={EVENT_FIELDS.setupStyle.label} hint={EVENT_FIELDS.setupStyle.hint}>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.setupStyle}
              onChange={(e) => setForm((v) => ({ ...v, setupStyle: e.target.value }))}
              placeholder={SETUP_STYLE_EXAMPLES}
            />
          </FieldLabel>
          <FieldLabel label={EVENT_FIELDS.expectedPax.label} hint={EVENT_FIELDS.expectedPax.hint}>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.expectedPax}
              onChange={(e) => setForm((v) => ({ ...v, expectedPax: e.target.value }))}
            />
          </FieldLabel>
          <FieldLabel label={EVENT_FIELDS.guaranteedPax.label} hint={EVENT_FIELDS.guaranteedPax.hint}>
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.guaranteedPax}
              onChange={(e) => setForm((v) => ({ ...v, guaranteedPax: e.target.value }))}
            />
          </FieldLabel>
          <FieldLabel label={EVENT_FIELDS.coordinatorNotes.label} hint={EVENT_FIELDS.coordinatorNotes.hint} className="sm:col-span-2">
            <textarea
              className="mt-1 min-h-28 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case shadow-inner"
              value={form.coordinatorNotes}
              onChange={(e) => setForm((v) => ({ ...v, coordinatorNotes: e.target.value }))}
              placeholder="VIP notes, room turn details, contact expectations..."
            />
          </FieldLabel>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="button" className="hms-btn-solid text-sm" disabled={saving} onClick={() => void saveEvent()}>
              {saving ? "Saving..." : "Create event"}
            </button>
            <button type="button" className="hms-btn-outline text-sm" onClick={() => void checkConflict()}>
              Check venue conflict
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
