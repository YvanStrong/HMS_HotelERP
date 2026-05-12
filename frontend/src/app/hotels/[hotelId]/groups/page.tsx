"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { staffAppPath } from "@/lib/staffAppRoutes";
import {
  Users,
  Plus,
  Search,
  Building,
  ChevronRight,
  LayoutGrid,
  Briefcase,
} from "lucide-react";

interface GroupBooking {
  id: string;
  groupName: string;
  groupCode: string;
  companyName: string;
  contactPerson: string;
  status: string;
  createdAt: string;
  expectedGuests?: number | null;
  roomsNeeded?: number | null;
  eventType?: string | null;
}

export default function GroupsPage() {
  const { hotelId } = useParams();
  const [groups, setGroups] = useState<GroupBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const [newGroup, setNewGroup] = useState({
    groupName: "",
    groupCode: "",
    companyName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    status: "TENTATIVE",
    expectedGuests: "" as string | number,
    roomsNeeded: "" as string | number,
    targetCheckIn: "",
    targetCheckOut: "",
    eventType: "CONFERENCE",
    roomMixSummary: "",
    billingPreference: "MASTER_PAYS_ALL",
    notes: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, [hotelId]);

  async function loadGroups() {
    try {
      setLoading(true);
      const data = await apiFetch<GroupBooking[]>(`/api/v1/hotels/${hotelId}/groups`);
      setGroups(data || []);
    } catch (err) {
      console.error("Failed to load groups", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateGroup() {
    if (!newGroup.groupName) {
      setCreateErr("Group name is required.");
      return;
    }
    try {
      setIsCreating(true);
      setCreateErr(null);
      const payload = {
        groupName: newGroup.groupName.trim(),
        groupCode: newGroup.groupCode.trim() || null,
        companyName: newGroup.companyName.trim() || null,
        contactPerson: newGroup.contactPerson.trim() || null,
        contactEmail: newGroup.contactEmail.trim() || null,
        contactPhone: newGroup.contactPhone.trim() || null,
        status: newGroup.status,
        expectedGuests: newGroup.expectedGuests === "" ? null : Number(newGroup.expectedGuests),
        roomsNeeded: newGroup.roomsNeeded === "" ? null : Number(newGroup.roomsNeeded),
        targetCheckIn: newGroup.targetCheckIn || null,
        targetCheckOut: newGroup.targetCheckOut || null,
        eventType: newGroup.eventType || null,
        roomMixSummary: newGroup.roomMixSummary.trim() || null,
        billingPreference: newGroup.billingPreference || null,
        notes: newGroup.notes.trim() || null,
      };
      await apiFetch(`/api/v1/hotels/${hotelId}/groups`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowAddModal(false);
      setNewGroup({
        groupName: "",
        groupCode: "",
        companyName: "",
        contactPerson: "",
        contactEmail: "",
        contactPhone: "",
        status: "TENTATIVE",
        expectedGuests: "",
        roomsNeeded: "",
        targetCheckIn: "",
        targetCheckOut: "",
        eventType: "CONFERENCE",
        roomMixSummary: "",
        billingPreference: "MASTER_PAYS_ALL",
        notes: "",
      });
      void loadGroups();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  }

  const filteredGroups = groups.filter(g => 
    g.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.groupCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-indigo-600" />
            Group & Event Management
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Manage corporate bookings, tour groups, and event blocks</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-200 active:scale-95 font-bold"
        >
          <Plus className="w-5 h-5" />
          Create Group
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search groups by name, code or company..."
            className="flex-1 outline-none text-slate-700 bg-transparent font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Group Details</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-8 h-16 bg-slate-50/50" />
                  </tr>
                ))
              ) : filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400 italic bg-slate-50/30">
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase className="w-8 h-8 opacity-20" />
                      <p className="text-sm">No groups found matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shadow-sm border border-indigo-100">
                          {group.groupName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{group.groupName}</p>
                          <p className="text-[10px] text-slate-500 font-mono tracking-tighter uppercase">{group.groupCode || 'NO-CODE'}</p>
                          {(group.expectedGuests != null || group.roomsNeeded != null) && (
                            <p className="mt-1 text-[11px] font-semibold text-indigo-600">
                              {group.expectedGuests != null ? `${group.expectedGuests} pax` : ""}
                              {group.expectedGuests != null && group.roomsNeeded != null ? " · " : ""}
                              {group.roomsNeeded != null ? `${group.roomsNeeded} rooms` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-slate-600 font-medium">
                        <Building className="w-4 h-4 text-slate-400" />
                        <span>{group.companyName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-slate-900 font-medium">{group.contactPerson || '—'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        group.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                        group.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>
                        {group.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={staffAppPath("groups", group.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                          title="Billing routing & master folio"
                        >
                          Billing
                        </Link>
                        <Link
                          href={`${staffAppPath("groups", group.id, "reserve")}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-indigo-700 transition hover:bg-indigo-100"
                          title="Plan multi-room block with inventory radar"
                        >
                          <LayoutGrid className="h-4 w-4" />
                          Block
                        </Link>
                        <Link
                          href={`${staffAppPath("reservations", "new")}?groupId=${encodeURIComponent(group.id)}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-slate-100 hover:bg-white hover:text-indigo-600 hover:shadow-md"
                          title="Single-room staff reservation linked to this group"
                        >
                          <span className="sr-only">One room</span>
                          <ChevronRight className="h-5 w-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE GROUP MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="px-8 py-7 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Create Group Block</h2>
                <p className="text-sm font-medium text-slate-500">
                  Capture the story once — headcount, keys, billing vibe — then use Block reserve to drop real rooms.
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-2.5 hover:bg-slate-100 rounded-2xl transition-all active:scale-95 text-slate-400 hover:text-slate-900"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 bg-white">
              {createErr && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-bold shadow-sm animate-in shake duration-500">
                  {createErr}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Group Name *</label>
                  <input 
                    value={newGroup.groupName} 
                    onChange={e => setNewGroup({...newGroup, groupName: e.target.value})} 
                    placeholder="e.g. Google Developers Conference" 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Group Code</label>
                    <input 
                      value={newGroup.groupCode} 
                      onChange={e => setNewGroup({...newGroup, groupCode: e.target.value})} 
                      placeholder="e.g. GDEV24" 
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4 uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Status</label>
                    <select 
                      value={newGroup.status} 
                      onChange={e => setNewGroup({...newGroup, status: e.target.value})}
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    >
                      <option value="TENTATIVE">Tentative</option>
                      <option value="CONFIRMED">Confirmed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Company/Entity</label>
                  <input 
                    value={newGroup.companyName} 
                    onChange={e => setNewGroup({...newGroup, companyName: e.target.value})} 
                    placeholder="e.g. Alphabet Inc." 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Contact Person</label>
                  <input 
                    value={newGroup.contactPerson} 
                    onChange={e => setNewGroup({...newGroup, contactPerson: e.target.value})} 
                    placeholder="Primary coordinator name" 
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Coordinator email</label>
                    <input
                      type="email"
                      value={newGroup.contactEmail}
                      onChange={(e) => setNewGroup({ ...newGroup, contactEmail: e.target.value })}
                      placeholder="events@client.com"
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">War room phone</label>
                    <input
                      value={newGroup.contactPhone}
                      onChange={(e) => setNewGroup({ ...newGroup, contactPhone: e.target.value })}
                      placeholder="+250 … on-site GSM"
                      className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl h-12 transition-all font-medium px-4"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-indigo-800">Demand sketch</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Guests (pax)</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                        value={newGroup.expectedGuests}
                        onChange={(e) => setNewGroup({ ...newGroup, expectedGuests: e.target.value })}
                        placeholder="120"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Rooms needed</label>
                      <input
                        type="number"
                        min={0}
                        className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                        value={newGroup.roomsNeeded}
                        onChange={(e) => setNewGroup({ ...newGroup, roomsNeeded: e.target.value })}
                        placeholder="48"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Event archetype</label>
                      <select
                        className="mt-1 w-full rounded-xl border border-white bg-white px-2 py-2 text-xs font-semibold"
                        value={newGroup.eventType}
                        onChange={(e) => setNewGroup({ ...newGroup, eventType: e.target.value })}
                      >
                        <option value="CONFERENCE">Conference / summit</option>
                        <option value="WEDDING">Wedding weekend</option>
                        <option value="TOUR">Tour series</option>
                        <option value="SPORTS_TEAM">Sports / crew</option>
                        <option value="RETREAT">Executive retreat</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Target check-in</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                        value={newGroup.targetCheckIn}
                        onChange={(e) => setNewGroup({ ...newGroup, targetCheckIn: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600">Target check-out</label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                        value={newGroup.targetCheckOut}
                        onChange={(e) => setNewGroup({ ...newGroup, targetCheckOut: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Room mix poetry (free text)</label>
                    <textarea
                      rows={2}
                      value={newGroup.roomMixSummary}
                      onChange={(e) => setNewGroup({ ...newGroup, roomMixSummary: e.target.value })}
                      placeholder="e.g. 30 twins near elevator bank B + 10 kings for VIP row + 8 rollaways for kids"
                      className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Billing choreography</label>
                    <select
                      className="mt-1 w-full rounded-xl border border-white bg-white px-3 py-2 text-xs font-semibold"
                      value={newGroup.billingPreference}
                      onChange={(e) => setNewGroup({ ...newGroup, billingPreference: e.target.value })}
                    >
                      <option value="MASTER_PAYS_ALL">Master pays all (folio routing)</option>
                      <option value="SPLIT_BILLING">Split: room → master, extras → guest</option>
                      <option value="GUEST_PAYS_INCIDENTALS">Company room, guest incidentals</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block ml-1">Ops notes / drama log</label>
                  <textarea
                    rows={3}
                    value={newGroup.notes}
                    onChange={(e) => setNewGroup({ ...newGroup, notes: e.target.value })}
                    placeholder="Dietaries, arrival waves, security, competitor hotels sniffing around…"
                    className="w-full bg-slate-50 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex gap-4 justify-end sticky bottom-0">
              <button 
                type="button" 
                className="hms-btn-outline px-6 py-3 rounded-2xl font-bold" 
                onClick={() => setShowAddModal(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="hms-btn-solid min-w-[160px] px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-200 bg-indigo-600 text-white" 
                onClick={() => void handleCreateGroup()}
                disabled={isCreating}
              >
                {isCreating ? 'Creating Block...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
