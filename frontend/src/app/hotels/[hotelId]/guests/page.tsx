"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { KeyValueTable, recordToRows } from "@/components/KeyValueTable";
import { PaginationBar } from "@/components/PaginationBar";
import { apiFetch, getToken } from "@/lib/api";
import { paginateSlice } from "@/lib/pagination";
import { staffAppPath } from "@/lib/staffAppRoutes";
import { COUNTRY_OPTIONS, GENDER_OPTIONS, PHONE_CODE_OPTIONS } from "@/lib/guestFormConstants";

type ReservationGuestRow = {
  guestId: string;
  guestName: string;
  guestEmail: string;
  guest_national_id_masked?: string;
  confirmationCode: string;
  booking_reference?: string;
  status: string;
  roomNumber: string;
  checkInDate: string;
  checkOutDate: string;
};

type GuestProfile = {
  id: string;
  name: string;
  email: string;
  loyalty?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  stayHistory?: Record<string, unknown>;
  communication?: Record<string, unknown>;
  flags?: Record<string, unknown>;
};

type SavedGuestRow = {
  guestId: string;
  guestName: string;
  guestEmail: string;
};

/** No stay window — server uses a wide default range so future bookings still appear in the directory. */
function reservationsListUrl(hotelId: string): string {
  return `/api/v1/hotels/${hotelId}/reservations`;
}

export default function GuestsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<ReservationGuestRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [guestId, setGuestId] = useState("");
  const [manualGuestId, setManualGuestId] = useState("");
  const [guestFilter, setGuestFilter] = useState("");
  const [savedGuests, setSavedGuests] = useState<SavedGuestRow[]>([]);
  const [savedGuestsErr, setSavedGuestsErr] = useState<string | null>(null);
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);
  const [newGuest, setNewGuest] = useState({
    fullName: "",
    nationalId: "",
    dob: "",
    email: "",
    phone: "",
    phoneCc: "",
    nationality: "",
    gender: "",
    country: "",
    province: "",
    district: "",
    sector: "",
    cell: "",
    village: "",
    streetNumber: "",
    addressNotes: "",
    idType: "NATIONAL_ID",
    idDocNumber: "",
    idExpiry: "",
    vipLevel: "NONE",
    marketingConsent: false,
    notes: "",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (!getToken()) {
      setError("Not signed in.");
      setIsLoading(false);
      return;
    }
    try {
      const data = await apiFetch<ReservationGuestRow[]>(reservationsListUrl(hotelId));
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Could not load guests");
    } finally {
      setIsLoading(false);
    }
  }, [hotelId]);

  const loadSavedGuests = useCallback(async () => {
    setSavedGuestsErr(null);
    if (!getToken()) {
      setSavedGuestsErr("Not signed in.");
      return;
    }
    try {
      const list = await apiFetch<{ guest: { id: string; full_name: string; email: string | null } }[]>(
        `/api/v1/hotels/${hotelId}/guests`,
      );
      setSavedGuests(
        list.map((row) => ({
          guestId: row.guest.id,
          guestName: row.guest.full_name || "Unnamed guest",
          guestEmail: row.guest.email ?? "—",
        })),
      );
    } catch (e) {
      setSavedGuests([]);
      setSavedGuestsErr(e instanceof Error ? e.message : "Could not load saved guests");
    }
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSavedGuests();
  }, [loadSavedGuests]);

  const directoryGuests = useMemo(() => {
    const map = new Map<string, ReservationGuestRow>();
    for (const r of rows) {
      if (!r.guestId) continue;
      if (!map.has(r.guestId)) map.set(r.guestId, r);
    }
    return Array.from(map.values()).sort((a, b) => a.guestName.localeCompare(b.guestName));
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return directoryGuests.filter((g) => {
      const statusOk = statusFilter === "ALL" || g.status === statusFilter;
      if (!statusOk) return false;
      if (!needle) return true;
      return (
        g.guestName.toLowerCase().includes(needle) ||
        (g.guestEmail || "").toLowerCase().includes(needle) ||
        (g.booking_reference || "").toLowerCase().includes(needle) ||
        g.confirmationCode.toLowerCase().includes(needle) ||
        (g.guest_national_id_masked || "").toLowerCase().includes(needle)
      );
    });
  }, [directoryGuests, q, statusFilter]);

  const stats = useMemo(() => {
    const by = (s: string) => directoryGuests.filter((g) => g.status === s).length;
    return {
      totalGuests: directoryGuests.length,
      inHouseGuests: by("CHECKED_IN"),
      arrivals: by("CONFIRMED"),
      departed: by("CHECKED_OUT"),
    };
  }, [directoryGuests]);

  const { slice, total, totalPages } = useMemo(
    () => paginateSlice(filtered, page, PAGE_SIZE),
    [filtered, page],
  );

  const guestChoices = useMemo(
    () => [...savedGuests].sort((a, b) => a.guestName.localeCompare(b.guestName)),
    [savedGuests],
  );

  const filteredSaved = useMemo(() => {
    const needle = guestFilter.trim().toLowerCase();
    if (!needle) return guestChoices;
    return guestChoices.filter(
      (g) =>
        g.guestName.toLowerCase().includes(needle) || g.guestEmail.toLowerCase().includes(needle),
    );
  }, [guestChoices, guestFilter]);

  const selectGuestOptions = useMemo(() => {
    if (!guestId || filteredSaved.some((g) => g.guestId === guestId)) {
      return filteredSaved;
    }
    const cur = guestChoices.find((g) => g.guestId === guestId);
    return cur ? [cur, ...filteredSaved] : filteredSaved;
  }, [guestChoices, guestId, filteredSaved]);

  async function loadProfile() {
    setProfileError(null);
    setProfile(null);
    if (!getToken()) {
      setProfileError("Not signed in.");
      return;
    }
    const id = manualGuestId.trim() || guestId.trim();
    if (!id) {
      setProfileError("Choose a guest from the list, or paste an id in “Guest not on the list”.");
      return;
    }
    try {
      const json = await apiFetch<GuestProfile>(`/api/v1/hotels/${hotelId}/guests/${id}/profile`);
      setProfile(json);
    } catch (e) {
      setProfileError(e instanceof Error ? e.message : "Failed to load profile");
    }
  }

  async function handleCreateGuest() {
    setCreateError(null);
    if (!newGuest.fullName || !newGuest.nationalId || !newGuest.dob) {
      setCreateError("Full name, national ID, and date of birth are required.");
      return;
    }
    setCreateLoading(true);

    const parts = newGuest.fullName.trim().split(/\s+/, 2);
    const payload = {
      firstName: parts[0] || "Guest",
      lastName: parts[1] || "Guest",
      fullName: newGuest.fullName.trim(),
      national_id: newGuest.nationalId.trim(),
      date_of_birth: newGuest.dob,
      nationality: newGuest.nationality.trim() || null,
      gender: newGuest.gender.trim() || null,
      email: newGuest.email.trim() || null,
      phone: newGuest.phone.trim() || null,
      phone_country_code: newGuest.phoneCc.trim() || null,
      country: newGuest.country.trim() || null,
      province: newGuest.province.trim() || null,
      district: newGuest.district.trim() || null,
      sector: newGuest.sector.trim() || null,
      cell: newGuest.cell.trim() || null,
      village: newGuest.village.trim() || null,
      street_number: newGuest.streetNumber.trim() || null,
      address_notes: newGuest.addressNotes.trim() || null,
      id_type: newGuest.idType,
      id_expiry_date: newGuest.idExpiry || null,
      idDocument: {
        type: newGuest.idType,
        number: (newGuest.idDocNumber.trim() || newGuest.nationalId.trim()) || null,
      },
      vip_level: newGuest.vipLevel,
      marketing_consent: newGuest.marketingConsent,
      notes: newGuest.notes.trim() || null,
      is_blacklisted: false,
      blacklist_reason: null,
    };

    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/guests`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setIsCreating(false);
      setNewGuest({
        fullName: "",
        nationalId: "",
        dob: "",
        email: "",
        phone: "",
        phoneCc: "",
        nationality: "",
        gender: "",
        country: "",
        province: "",
        district: "",
        sector: "",
        cell: "",
        village: "",
        streetNumber: "",
        addressNotes: "",
        idType: "NATIONAL_ID",
        idDocNumber: "",
        idExpiry: "",
        vipLevel: "NONE",
        marketingConsent: false,
        notes: "",
      });
      void loadSavedGuests();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create guest");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Central directory for guest profiles, stay history, and loyalty.
          </p>
        </div>
        <button type="button" className="hms-btn-solid hms-btn-icon" onClick={() => setIsCreating(true)}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add manual guest
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Directory</p>
          <p className="mt-1 text-2xl font-bold">{stats.totalGuests}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">In house</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.inHouseGuests}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrivals</p>
          <p className="mt-1 text-2xl font-bold text-primary">{stats.arrivals}</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-soft">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Departed</p>
          <p className="mt-1 text-2xl font-bold">{stats.departed}</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label>
            Filter directory
            <input
              type="search"
              placeholder="Name, email, booking..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label>
            Stay Status
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_IN">Checked in</option>
              <option value="CHECKED_OUT">Checked out</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No show</option>
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="hms-btn-outline w-full" onClick={() => void load()}>
              Sync records
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Stay History Records ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-3">Guest</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Reference</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Room</th>
                <th className="pb-3">Stay Dates</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`g-skeleton-${idx}`} className="border-t border-border/50 animate-pulse">
                    <td className="py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
                    <td><div className="h-4 w-36 rounded bg-muted" /></td>
                    <td><div className="h-4 w-28 rounded bg-muted" /></td>
                    <td><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                    <td><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td><div className="h-4 w-16 rounded bg-muted" /></td>
                  </tr>
                ))}
              {!isLoading &&
                slice.map((g) => (
                  <tr key={g.guestId} className="border-t border-border/50 hover:bg-slate-50 transition-colors">
                    <td className="py-3">
                      <p className="font-semibold text-slate-900">{g.guestName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono uppercase">{g.guest_national_id_masked || "No ID"}</p>
                    </td>
                    <td><span className="text-slate-600">{g.guestEmail || "—"}</span></td>
                    <td>
                      <div className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded w-fit">{g.booking_reference || g.confirmationCode}</div>
                    </td>
                    <td>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        g.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-700' :
                        g.status === 'CONFIRMED' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {g.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td><span className="font-medium">{g.roomNumber || "—"}</span></td>
                    <td className="whitespace-nowrap text-slate-600">
                      {g.checkInDate} <span className="text-slate-300 mx-1">→</span> {g.checkOutDate}
                    </td>
                    <td>
                      <Link
                        href={staffAppPath("guests", g.guestId)}
                        className="text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                      >
                        Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              {!isLoading && slice.length === 0 && (
                <tr className="border-t border-border/50">
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <p className="text-base">No guest records found.</p>
                    <p className="text-xs mt-1">Try adjusting your search or sync filters.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={PAGE_SIZE}
          noun="guests"
          onPageChange={setPage}
        />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-soft">
        <h2 className="text-lg font-semibold text-slate-800">Quick CRM Lookup</h2>
        <p className="mt-1 text-sm text-muted-foreground mb-4">
          Search all saved profiles to preview loyalty status and preferences.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-4 max-w-md">
            {savedGuestsErr && <div className="error">{savedGuestsErr}</div>}
            <label>
              Search saved profiles
              <input
                type="search"
                placeholder="Name or email…"
                value={guestFilter}
                onChange={(e) => setGuestFilter(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Select Guest
              <select
                value={guestId}
                onChange={(e) => {
                  setGuestId(e.target.value);
                  setManualGuestId("");
                }}
                className="w-full"
              >
                <option value="">Choose a guest…</option>
                {selectGuestOptions.map((g) => (
                  <option key={g.guestId} value={g.guestId}>
                    {g.guestName} · {g.guestEmail}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="hms-btn-solid" onClick={() => void loadProfile()}>
              Preview Profile
            </button>
          </div>

          <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-6 min-h-[200px]">
            {profile == null && !profileError && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <p className="text-sm italic text-center">Select a guest to view profile summary.</p>
              </div>
            )}
            {profileError && <div className="text-rose-600 text-sm italic">{profileError}</div>}
            {profile != null && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{profile.name}</h3>
                    <p className="text-sm text-slate-500">{profile.email}</p>
                  </div>
                  <Link href={staffAppPath("guests", profile.id)} className="hms-btn-outline text-xs px-3 py-1.5 font-bold">
                    FULL PROFILE
                  </Link>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Loyalty Tier</p>
                    <p className="text-lg font-black text-primary">{(profile.loyalty as any)?.tier || "GUEST"}</p>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Points</p>
                    <p className="text-lg font-black text-slate-800">{(profile.loyalty as any)?.points || 0}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Key Preferences</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(profile.preferences || {}).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                          {k}: {String(v)}
                        </span>
                      ))}
                      {Object.keys(profile.preferences || {}).length === 0 && <span className="text-xs italic text-slate-400">None set</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE GUEST MODAL - PREMIUM REDESIGN */}
      {isCreating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] w-full max-w-3xl my-8 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col border border-white/20">
            {/* Header */}
            <div className="px-8 py-7 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">New Guest Profile</h2>
                <p className="text-sm font-medium text-slate-500">Register identity and CRM details for the directory.</p>
              </div>
              <button 
                onClick={() => setIsCreating(false)} 
                className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-slate-900"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-8 space-y-10 overflow-y-auto max-h-[70vh] bg-white">
              {createError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold shadow-sm animate-in shake duration-500">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    {createError}
                  </div>
                </div>
              )}
              
              {/* Identity Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-primary rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Identity & Core</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2 group">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Full Name *</label>
                    <input 
                      value={newGuest.fullName} 
                      onChange={e => setNewGuest({...newGuest, fullName: e.target.value})} 
                      placeholder="e.g. Johnathan Doe" 
                      required 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">National ID *</label>
                    <input 
                      value={newGuest.nationalId} 
                      onChange={e => setNewGuest({...newGuest, nationalId: e.target.value})} 
                      placeholder="Identification Number" 
                      required 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Date of Birth *</label>
                    <input 
                      type="date" 
                      value={newGuest.dob} 
                      onChange={e => setNewGuest({...newGuest, dob: e.target.value})} 
                      required 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Gender</label>
                    <select 
                      value={newGuest.gender} 
                      onChange={e => setNewGuest({...newGuest, gender: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      <option value="">Select gender</option>
                      {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g.replaceAll("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Nationality</label>
                    <select 
                      value={newGuest.nationality} 
                      onChange={e => setNewGuest({...newGuest, nationality: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      <option value="">Select nationality</option>
                      {COUNTRY_OPTIONS.map(c => <option key={c.iso2} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {/* Contact Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Communication</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Email Address</label>
                    <input 
                      type="email" 
                      value={newGuest.email} 
                      onChange={e => setNewGuest({...newGuest, email: e.target.value})} 
                      placeholder="guest@example.com" 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div className="grid grid-cols-[100px_1fr] gap-3 items-end">
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Code</label>
                      <select 
                        value={newGuest.phoneCc} 
                        onChange={e => setNewGuest({...newGuest, phoneCc: e.target.value})}
                        className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white rounded-2xl h-12 transition-all font-medium px-3"
                      >
                        {PHONE_CODE_OPTIONS.map(o => <option key={o.iso2} value={o.code}>{o.code}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Phone Number</label>
                      <input 
                        value={newGuest.phone} 
                        onChange={e => setNewGuest({...newGuest, phone: e.target.value})} 
                        placeholder="788 000 000" 
                        className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Address Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-amber-500 rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Geography</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Country *</label>
                    <select 
                      value={newGuest.country} 
                      onChange={e => setNewGuest({...newGuest, country: e.target.value, nationality: e.target.value})} 
                      required
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      {COUNTRY_OPTIONS.map(c => <option key={c.iso2} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Province/State</label>
                    <input 
                      value={newGuest.province} 
                      onChange={e => setNewGuest({...newGuest, province: e.target.value})} 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">District/City</label>
                    <input 
                      value={newGuest.district} 
                      onChange={e => setNewGuest({...newGuest, district: e.target.value})} 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Address Details</label>
                    <textarea 
                      rows={2} 
                      value={newGuest.addressNotes} 
                      onChange={e => setNewGuest({...newGuest, addressNotes: e.target.value})} 
                      placeholder="Nearby landmarks, street name, apartment number..." 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl p-4 transition-all font-medium resize-none"
                    />
                  </div>
                </div>
              </section>

              {/* CRM Section */}
              <section className="space-y-6 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-slate-900 rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">CRM & Experience</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Identification Type</label>
                    <select 
                      value={newGuest.idType} 
                      onChange={e => setNewGuest({...newGuest, idType: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      <option value="NATIONAL_ID">National ID</option>
                      <option value="PASSPORT">Passport</option>
                      <option value="REFUGEE_ID">Refugee ID</option>
                      <option value="DRIVERS_LICENSE">{"Driver's License"}</option>
                    </select>
                  </div>
                  {newGuest.idType !== 'NATIONAL_ID' && (
                    <div>
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Document Number</label>
                      <input 
                        value={newGuest.idDocNumber} 
                        onChange={e => setNewGuest({...newGuest, idDocNumber: e.target.value})} 
                        className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                      />
                    </div>
                  )}
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900">Loyalty is automatic</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                      New guests start at Bronze with 0 points. Points and tier are calculated from checked-out stays
                      and posted loyalty transactions, so staff do not choose the tier manually.
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-slate-100/50">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-900">Marketing Opt-in</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Allow promotional communication</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewGuest({...newGuest, marketingConsent: !newGuest.marketingConsent})}
                      className={`w-14 h-7 rounded-full transition-all relative active:scale-90 shadow-inner ${newGuest.marketingConsent ? 'bg-primary' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${newGuest.marketingConsent ? 'left-8' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Internal Preferences/Notes</label>
                    <textarea 
                      rows={3} 
                      value={newGuest.notes} 
                      onChange={e => setNewGuest({...newGuest, notes: e.target.value})} 
                      placeholder="Pillow type, dietary restrictions, floor preferences..." 
                      className="w-full bg-slate-50 border-slate-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 rounded-2xl p-4 transition-all font-medium resize-none"
                    />
                  </div>
                </div>
              </section>
            </div>
            
            {/* Footer */}
            <div className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex gap-4 justify-end sticky bottom-0 backdrop-blur-sm">
              <button 
                type="button" 
                className="hms-btn-outline px-6 py-3 rounded-2xl font-bold transition-all active:scale-95" 
                onClick={() => setIsCreating(false)} 
                disabled={createLoading}
              >
                Discard
              </button>
              <button 
                type="button" 
                className="hms-btn-solid min-w-[200px] px-8 py-3 rounded-2xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95 hover:brightness-110" 
                onClick={() => void handleCreateGuest()} 
                disabled={createLoading}
              >
                {createLoading ? 'Finalizing Profile...' : 'Create Guest Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

