"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

type HotelSettings = {
  id: string;
  name: string;
  companyName?: string | null;
  logoUrl?: string | null;
  imageUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tinNumber?: string | null;
  currency?: string | null;
  timezone?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  invoicePrefix?: string | null;
  taxRate?: number | null;
};

type FeePolicy = {
  earlyCheckinFee: number;
  lateCheckoutFee: number;
  noShowDefaultFee: number;
  currency: string;
  overstayAutoPostEnabled?: boolean;
  overstayGraceMinutes?: number;
  overstayHourlyPercent?: number;
  overstayHalfDayCapPercent?: number;
  overstayFullNightAfterHours?: number;
  overstayMaxDailyPercent?: number;
  overstayApplyTax?: boolean;
  overstayPostTiming?: "AT_CHECKOUT" | "SCHEDULED_AUTO" | string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const LOCAL_KEY_PREFIX = "hms:hotel:settings:";

function localSettingsKey(hotelId: string): string {
  return `${LOCAL_KEY_PREFIX}${hotelId}`;
}

export default function HotelSettingsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [form, setForm] = useState<HotelSettings>({
    id: hotelId,
    name: "",
    companyName: "",
    logoUrl: "",
    imageUrl: "",
    phone: "",
    email: "",
    address: "",
    tinNumber: "",
    currency: "USD",
    timezone: "UTC",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    invoicePrefix: "HMS",
    taxRate: 0,
  });
  const [state, setState] = useState<SaveState>("idle");
  const [feePolicy, setFeePolicy] = useState<FeePolicy>({
    earlyCheckinFee: 0,
    lateCheckoutFee: 0,
    noShowDefaultFee: 0,
    currency: "USD",
    overstayAutoPostEnabled: false,
    overstayGraceMinutes: 60,
    overstayHourlyPercent: 1.5,
    overstayHalfDayCapPercent: 49,
    overstayFullNightAfterHours: 6,
    overstayMaxDailyPercent: 100,
    overstayApplyTax: true,
    overstayPostTiming: "AT_CHECKOUT",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hotel = await apiFetch<HotelSettings>(`/api/v1/hotels/${hotelId}/settings`);
        if (cancelled) return;
        setForm({
          ...hotel,
          companyName: hotel.companyName ?? hotel.name ?? "",
          logoUrl: hotel.logoUrl ?? "",
          imageUrl: hotel.imageUrl ?? "",
          phone: hotel.phone ?? "",
          email: hotel.email ?? "",
          address: hotel.address ?? "",
          tinNumber: hotel.tinNumber ?? "",
          currency: hotel.currency ?? "USD",
          timezone: hotel.timezone ?? "UTC",
          checkInTime: hotel.checkInTime ?? "14:00",
          checkOutTime: hotel.checkOutTime ?? "12:00",
          invoicePrefix: hotel.invoicePrefix ?? "HMS",
          taxRate: hotel.taxRate ?? 0,
        });
        const policy = await apiFetch<FeePolicy>(`/api/v1/hotels/${hotelId}/fee-policy`);
        if (cancelled) return;
        setFeePolicy({
          ...policy,
          overstayAutoPostEnabled: Boolean(policy.overstayAutoPostEnabled),
          overstayGraceMinutes: policy.overstayGraceMinutes ?? 60,
          overstayHourlyPercent: policy.overstayHourlyPercent ?? 1.5,
          overstayHalfDayCapPercent: policy.overstayHalfDayCapPercent ?? 49,
          overstayFullNightAfterHours: policy.overstayFullNightAfterHours ?? 6,
          overstayMaxDailyPercent: policy.overstayMaxDailyPercent ?? 100,
          overstayApplyTax: policy.overstayApplyTax ?? true,
          overstayPostTiming: policy.overstayPostTiming ?? "AT_CHECKOUT",
        });
      } catch {
        try {
          const raw = localStorage.getItem(localSettingsKey(hotelId));
          if (!raw || cancelled) return;
          setForm((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<HotelSettings>) }));
        } catch {
          // Ignore malformed local cache.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  async function saveSettings() {
    setState("saving");
    setError(null);

    const body = {
      name: form.name?.trim() || null,
      companyName: form.companyName?.trim() || null,
      logoUrl: form.logoUrl?.trim() || null,
      imageUrl: form.imageUrl?.trim() || null,
      phone: form.phone?.trim() || null,
      email: form.email?.trim() || null,
      address: form.address?.trim() || null,
      tinNumber: form.tinNumber?.trim() || null,
      currency: form.currency?.trim() || null,
      timezone: form.timezone?.trim() || null,
      checkInTime: form.checkInTime?.trim() || null,
      checkOutTime: form.checkOutTime?.trim() || null,
      invoicePrefix: form.invoicePrefix?.trim() || null,
      taxRate: Number(form.taxRate ?? 0),
    };

    let remoteSaved = false;
    try {
      await apiFetch(`/api/v1/hotels/${hotelId}/settings`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      await apiFetch(`/api/v1/hotels/${hotelId}/fee-policy`, {
        method: "PUT",
        body: JSON.stringify({
          overstayAutoPostEnabled: Boolean(feePolicy.overstayAutoPostEnabled),
          overstayGraceMinutes: Number(feePolicy.overstayGraceMinutes ?? 60),
          overstayHourlyPercent: Number(feePolicy.overstayHourlyPercent ?? 1.5),
          overstayHalfDayCapPercent: Number(feePolicy.overstayHalfDayCapPercent ?? 49),
          overstayFullNightAfterHours: Number(feePolicy.overstayFullNightAfterHours ?? 6),
          overstayMaxDailyPercent: Number(feePolicy.overstayMaxDailyPercent ?? 100),
          overstayApplyTax: Boolean(feePolicy.overstayApplyTax),
          overstayPostTiming: feePolicy.overstayPostTiming || "AT_CHECKOUT",
        }),
      });
      remoteSaved = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Settings could not be saved";
      setError(`${message}. Saved locally for now.`);
    }

    try {
      localStorage.setItem(localSettingsKey(hotelId), JSON.stringify(body));
    } catch {
      // Best effort.
    }

    setState(remoteSaved ? "saved" : "error");
    window.setTimeout(() => setState("idle"), 1800);
  }

  const headerCopy = useMemo(() => {
    if (state === "saving") return "Saving settings...";
    if (state === "saved") return "Settings saved.";
    if (state === "error") return "Saved locally; backend update failed.";
    return "Set hotel branding, legal company details, invoices, and operations defaults.";
  }, [state]);

  function setField<K extends keyof HotelSettings>(key: K, value: HotelSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setFeeField<K extends keyof FeePolicy>(key: K, value: FeePolicy[K]) {
    setFeePolicy((prev) => ({ ...prev, [key]: value }));
  }

  const previewNightly = 100000;
  const previewHours = 3;
  const previewCharge = Math.min(
    previewNightly * ((feePolicy.overstayHourlyPercent ?? 1.5) / 100) * previewHours,
    previewNightly * ((feePolicy.overstayHalfDayCapPercent ?? 49) / 100),
    previewNightly * ((feePolicy.overstayMaxDailyPercent ?? 100) / 100),
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-xl font-black text-primary shadow-sm">
                {form.logoUrl ? <img src={form.logoUrl} alt="Hotel logo" className="h-full w-full object-cover" /> : (form.name || "H").slice(0, 1)}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Hotel settings</p>
                <p className="mt-1 text-sm">
                  <Link href={`/hotels/${hotelId}/settings/catering-packages`} className="font-semibold text-indigo-700 hover:underline">
                    Catering packages (events)
                  </Link>
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight text-foreground">{form.name || "Hotel"}</h1>
                <p className="mt-3 text-sm text-muted-foreground">{headerCopy}</p>
              </div>
            </div>
            <button type="button" onClick={saveSettings} disabled={state === "saving"} className="hms-btn-solid hms-btn-sm">
              {state === "saving" ? "Saving..." : "Save settings"}
            </button>
          </div>
          {error && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</p>}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="hms-section-card space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Company profile</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Official hotel details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Used on invoices, guest emails, receipts, and printed documents.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label>Hotel display name</label>
              <input value={form.name ?? ""} onChange={(e) => setField("name", e.target.value)} placeholder="Hotel name" />
            </div>
            <div>
              <label>Company name</label>
              <input value={form.companyName ?? ""} onChange={(e) => setField("companyName", e.target.value)} placeholder="Registered company name" />
            </div>
            <div>
              <label>Email</label>
              <input value={form.email ?? ""} onChange={(e) => setField("email", e.target.value)} placeholder="reservations@hotel.com" type="email" />
            </div>
            <div>
              <label>Telephone</label>
              <input value={form.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} placeholder="+250 ..." />
            </div>
            <div>
              <label>TIN number</label>
              <input value={form.tinNumber ?? ""} onChange={(e) => setField("tinNumber", e.target.value)} placeholder="Tax identification number" />
            </div>
            <div>
              <label>Invoice prefix</label>
              <input value={form.invoicePrefix ?? ""} onChange={(e) => setField("invoicePrefix", e.target.value)} placeholder="HMS" />
            </div>
            <div className="md:col-span-2">
              <label>Location / address</label>
              <textarea value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} placeholder="Street, district, city, country" rows={3} />
            </div>
          </div>
        </section>

        <section className="hms-section-card space-y-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Branding</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Logo and cover</h2>
            <p className="mt-1 text-sm text-muted-foreground">Compact previews for the public catalog, settings, emails, and invoices.</p>
          </div>
          <ImageUpload
            value={form.logoUrl ?? ""}
            onChange={(value) => setField("logoUrl", value)}
            label="Hotel logo"
            placeholder="Paste logo URL or upload/paste image"
            previewClassName="h-24"
          />
          <ImageUpload
            value={form.imageUrl ?? ""}
            onChange={(value) => setField("imageUrl", value)}
            label="Hotel cover image"
            placeholder="Paste cover image URL or upload/paste image"
            previewClassName="h-32"
          />
        </section>
      </div>

      <section className="hms-section-card">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Operations</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Default hotel rules</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <label>Currency</label>
            <input value={form.currency ?? ""} onChange={(e) => setField("currency", e.target.value.toUpperCase())} placeholder="USD" />
          </div>
          <div>
            <label>Timezone</label>
            <input value={form.timezone ?? ""} onChange={(e) => setField("timezone", e.target.value)} placeholder="Africa/Kigali" />
          </div>
          <div>
            <label>Check-in</label>
            <input type="time" value={form.checkInTime ?? ""} onChange={(e) => setField("checkInTime", e.target.value)} />
          </div>
          <div>
            <label>Check-out</label>
            <input type="time" value={form.checkOutTime ?? ""} onChange={(e) => setField("checkOutTime", e.target.value)} />
          </div>
          <div>
            <label>Tax rate %</label>
            <input type="number" step="0.01" value={form.taxRate ?? 0} onChange={(e) => setField("taxRate", Number(e.target.value))} />
          </div>
        </div>
      </section>

      <section className="hms-section-card space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Reservation billing policy</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Late Checkout &amp; Overstay Fees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure how unauthorized late departures are charged. Approved extra nights should use Extend Stay instead.
            </p>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${feePolicy.overstayAutoPostEnabled ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {feePolicy.overstayAutoPostEnabled ? "Automatic overstay charges on" : "Automatic overstay charges off"}
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background p-4">
          <span>
            <span className="block font-bold">Enable automatic overstay charges</span>
            <span className="text-sm text-muted-foreground">When enabled, checkout and scheduled posting use this policy.</span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(feePolicy.overstayAutoPostEnabled)}
            onChange={(e) => setFeeField("overstayAutoPostEnabled", e.target.checked)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label>Grace period minutes</label>
            <input
              type="number"
              min={0}
              value={feePolicy.overstayGraceMinutes ?? 60}
              onChange={(e) => setFeeField("overstayGraceMinutes", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Percent per extra hour</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={feePolicy.overstayHourlyPercent ?? 1.5}
              onChange={(e) => setFeeField("overstayHourlyPercent", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Full night after billable hours</label>
            <input
              type="number"
              min={1}
              value={feePolicy.overstayFullNightAfterHours ?? 6}
              onChange={(e) => setFeeField("overstayFullNightAfterHours", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Half-day cap percent</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={feePolicy.overstayHalfDayCapPercent ?? 49}
              onChange={(e) => setFeeField("overstayHalfDayCapPercent", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Max charge percent</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={feePolicy.overstayMaxDailyPercent ?? 100}
              onChange={(e) => setFeeField("overstayMaxDailyPercent", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Posting behavior</label>
            <select
              value={feePolicy.overstayPostTiming ?? "AT_CHECKOUT"}
              onChange={(e) => setFeeField("overstayPostTiming", e.target.value)}
            >
              <option value="AT_CHECKOUT">At checkout only</option>
              <option value="SCHEDULED_AUTO">Scheduled auto-post</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Preview</p>
            <p className="mt-2 text-lg font-black">
              100,000 x {(feePolicy.overstayHourlyPercent ?? 1.5).toFixed(2)}% x 3 ={" "}
              {Math.round(previewCharge).toLocaleString()} {form.currency ?? feePolicy.currency}
            </p>
            <p className="mt-1 text-sm text-amber-900">
              Example assumes 3 billable hours after grace. Caps apply before checkout posts the charge.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 text-sm text-muted-foreground">
            <p className="font-bold text-foreground">Where charges appear</p>
            <p className="mt-1">
              Posted overstay fees use the folio charge pipeline as a Late Checkout debit, so staff see the fee on folio,
              invoice lines, tax calculations, and final balance due before checkout validation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
