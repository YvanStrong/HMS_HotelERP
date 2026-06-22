"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { loadCateringPackages, money, type CateringPackage } from "@/lib/eventApi";
import { staffAppPath } from "@/lib/staffAppRoutes";

export default function CateringPackagesSettingsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [rows, setRows] = useState<CateringPackage[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("BUFFET");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await loadCateringPackages(hotelId);
    setRows(list);
  }, [hotelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    await apiFetch(`/api/v1/hotels/${hotelId}/catering-packages`, {
      method: "POST",
      body: JSON.stringify({
        packageName: name.trim(),
        packageType: type,
        pricePerPax: Number(price) || 0,
        taxable: true,
        active: true,
      }),
    });
    setName("");
    setPrice("");
    await load();
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href={staffAppPath("settings")} className="text-sm font-semibold text-indigo-700 hover:underline">← Settings</Link>
      <h1 className="text-2xl font-black text-slate-900">Catering package catalog</h1>
      <p className="text-sm text-muted-foreground" title="Each package is priced per guest and can be added to function quotes on a group.">
        Hotel-level catering packages used on group function quotes (price per guest).
      </p>
      <div className="grid gap-2 rounded-xl border bg-white p-4 sm:grid-cols-4">
        <input className="rounded-lg border px-3 py-2 text-sm sm:col-span-2" placeholder="Package name" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="rounded-lg border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="COFFEE_BREAK">Coffee break</option>
          <option value="BUFFET">Buffet</option>
          <option value="COCKTAIL">Cocktail</option>
          <option value="SET_MENU">Set menu</option>
          <option value="WEDDING">Wedding</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Price per guest" title="Amount charged for each guest when this package is on a quote." value={price} onChange={(e) => setPrice(e.target.value)} />
        <button type="button" className="hms-btn-solid text-sm sm:col-span-4" disabled={busy} onClick={() => void create()}>Add package</button>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex justify-between rounded-xl border bg-white px-4 py-3 text-sm">
            <span className="font-semibold">{row.packageName} <span className="text-slate-500">({row.packageType})</span></span>
            <span>{money(row.pricePerPax).toFixed(2)} / guest · {row.active ? "Active" : "Inactive"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
