"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, getToken } from "@/lib/api";

type PricingRule = {
  id: string;
  name: string;
  ruleType: string;
  multiplier: number;
  priority: number;
  active: boolean;
};

type Promotion = {
  id: string;
  code: string;
  name: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  active: boolean;
};

type CalendarDay = {
  date: string;
  baseRate: number;
  dynamicRate: number;
  dayOfWeek: string;
};

export default function PricingPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [baseRate, setBaseRate] = useState(100);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", ruleType: "DAY_OF_WEEK", multiplier: 1.1, priority: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [r, p, c] = await Promise.all([
        apiFetch<PricingRule[]>(`/api/v1/hotels/${hotelId}/pricing/rules`),
        apiFetch<Promotion[]>(`/api/v1/hotels/${hotelId}/pricing/promotions`),
        apiFetch<CalendarDay[]>(`/api/v1/hotels/${hotelId}/pricing/calendar?baseRate=${baseRate}`),
      ]);
      setRules(r);
      setPromos(p);
      setCalendar(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pricing data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (getToken()) loadData();
  }, [hotelId, baseRate]);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/pricing/rules`, {
        method: "POST",
        body: JSON.stringify({ ...newRule, hotelId, active: true }),
      });
      setShowAddModal(false);
      setNewRule({ name: "", ruleType: "DAY_OF_WEEK", multiplier: 1.1, priority: 0 });
      loadData();
    } catch (e) {
      alert("Failed to add rule: " + (e instanceof Error ? e.message : "Unknown error"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Management</h1>
          <p className="text-sm text-muted-foreground">Configure dynamic pricing rules and promotions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
            <span className="text-xs font-medium">Base Rate Test:</span>
            <input 
              type="number" 
              value={baseRate} 
              onChange={e => setBaseRate(Number(e.target.value))}
              className="w-20 bg-transparent border-none p-0 text-sm font-bold text-primary focus:ring-0"
            />
          </div>
          <button onClick={loadData} className="hms-btn-outline hms-btn-sm" disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rate Calendar */}
        <section className="hms-section-card">
          <h2 className="hms-section-title">Rate Forecast (30 Days)</h2>
          <p className="text-[10px] text-muted-foreground mb-4">Showing dynamic pricing applied to ${baseRate.toFixed(2)} base rate.</p>
          <div className="h-[300px] overflow-y-auto border border-border/60 rounded-lg">
            <table className="hms-table text-xs">
              <thead className="sticky top-0 bg-background shadow-sm">
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th className="text-right">Dynamic Rate</th>
                </tr>
              </thead>
              <tbody>
                {calendar.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td className="text-muted-foreground">{d.dayOfWeek.slice(0,3)}</td>
                    <td className="text-right font-semibold">
                      ${d.dynamicRate.toFixed(2)}
                      {d.dynamicRate > baseRate && <span className="ml-1 text-[10px] text-emerald-600">↑</span>}
                      {d.dynamicRate < baseRate && <span className="ml-1 text-[10px] text-rose-600">↓</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pricing Rules */}
        <section className="hms-section-card">
          <h2 className="hms-section-title">Dynamic Rules</h2>
          <div className="space-y-3">
            {rules.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20">
                <div>
                  <p className="font-medium text-sm">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{r.ruleType} · Priority {r.priority}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-primary">x{r.multiplier.toFixed(3)}</p>
                  <span className={`text-[10px] ${r.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {r.active ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
            ))}
            <button 
              onClick={() => setShowAddModal(true)}
              className="w-full py-2 border-2 border-dashed border-border rounded-lg text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
            >
              + Add Pricing Rule
            </button>
          </div>
        </section>
      </div>

      {/* Modal for adding rule */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-border">
            <h3 className="text-xl font-bold mb-4">Add Pricing Rule</h3>
            <form onSubmit={handleAddRule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Rule Name</label>
                <input 
                  required
                  value={newRule.name}
                  onChange={e => setNewRule({...newRule, name: e.target.value})}
                  placeholder="e.g. Weekend Surcharge"
                  className="w-full rounded-lg border-border bg-muted/30 text-sm focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Type</label>
                  <select 
                    value={newRule.ruleType}
                    onChange={e => setNewRule({...newRule, ruleType: e.target.value})}
                    className="w-full rounded-lg border-border bg-muted/30 text-sm focus:ring-primary"
                  >
                    <option value="DAY_OF_WEEK">Day of Week</option>
                    <option value="SEASON">Season</option>
                    <option value="OCCUPANCY_BRACKET">Occupancy</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-muted-foreground mb-1">Multiplier</label>
                  <input 
                    type="number" step="0.01"
                    value={newRule.multiplier}
                    onChange={e => setNewRule({...newRule, multiplier: Number(e.target.value)})}
                    className="w-full rounded-lg border-border bg-muted/30 text-sm focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors">Create Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promotions */}
      <section className="hms-section-card">
        <h2 className="hms-section-title">Promotions & Coupons</h2>
        <div className="hms-table-wrap">
          <table className="hms-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono font-bold text-primary">{p.code}</td>
                  <td>{p.name}</td>
                  <td className="text-xs">{p.discountType.replace("_", " ")}</td>
                  <td>{p.discountType === "PERCENTAGE" ? `${p.discountValue}%` : `$${p.discountValue}`}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {p.active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="hms-btn-outline hms-btn-sm">Edit</button>
                  </td>
                </tr>
              ))}
              {promos.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground italic">No active promotions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
