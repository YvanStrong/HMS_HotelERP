"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { ImageUpload } from "@/components/ImageUpload";

type PublicHotel = {
  id: string;
  name: string;
  logoUrl?: string | null;
  imageUrl?: string | null;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type HotelSettingsResponse = {
  id: string;
  name?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  currency?: string | null;
  defaultCountry?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tinNumber?: string | null;
  timezone?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  invoicePrefix?: string | null;
  defaultIdType?: string | null;
  phoneCountryCode?: string | null;
  taxRate?: number | null;
};

type FeePolicy = {
  earlyCheckinFee: number;
  lateCheckoutFee: number;
  noShowDefaultFee: number;
  currency: string;
  overstayPolicy?: {
    autoPostEnabled: boolean;
    graceMinutes: number;
    hourlyPercent: number;
    halfDayCapPercent: number;
    fullDayAfterHours: number;
    maxDailyPercent: number;
    applyTax: boolean;
    postTiming: "AT_CHECKOUT" | "SCHEDULED_AUTO";
  };
};

const DEFAULT_OVERSTAY_POLICY: NonNullable<FeePolicy["overstayPolicy"]> = {
  autoPostEnabled: false,
  graceMinutes: 60,
  hourlyPercent: 1.5,
  halfDayCapPercent: 50,
  fullDayAfterHours: 6,
  maxDailyPercent: 100,
  applyTax: true,
  postTiming: "AT_CHECKOUT",
};

const LOCAL_KEY_PREFIX = "hms:hotel:settings:";

const inputClass =
  "w-full rounded-lg border border-slate-200/90 bg-white/80 px-2.5 py-1.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100";

function localSettingsKey(hotelId: string): string {
  return `${LOCAL_KEY_PREFIX}${hotelId}`;
}

function Field({
  label,
  hint,
  children,
  span,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  span?: "full";
}) {
  return (
    <label className={span === "full" ? "col-span-full space-y-1" : "space-y-1"}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] leading-snug text-slate-400">{hint}</span> : null}
    </label>
  );
}

function MetricInput({
  label,
  suffix,
  value,
  onChange,
  min,
  step,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-2 backdrop-blur-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full min-w-0 border-0 bg-transparent p-0 text-base font-semibold tabular-nums text-slate-900 shadow-none focus:ring-0"
        />
        <span className="shrink-0 text-[10px] font-medium text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}

export default function HotelSettingsPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);

  const [hotelName, setHotelName] = useState("Hotel");
  const [logoUrl, setLogoUrl] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<HotelSettingsResponse | null>(null);
  const [feePolicy, setFeePolicy] = useState<FeePolicy | null>(null);
  const overstayPolicy = feePolicy?.overstayPolicy ?? DEFAULT_OVERSTAY_POLICY;
  const currency = feePolicy?.currency ?? settings?.currency ?? "RWF";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedSettings = false;
      try {
        const settingsResponse = await apiFetch<HotelSettingsResponse>(`/api/v1/hotels/${hotelId}/settings`, {
          quiet: true,
        });
        if (!cancelled) {
          loadedSettings = true;
          setSettings(settingsResponse);
          setHotelName(settingsResponse.name || "Hotel");
          setLogoUrl(settingsResponse.logoUrl ?? "");
        }
      } catch {
        /* fallback */
      }

      try {
        const policy = await apiFetch<FeePolicy>(`/api/v1/hotels/${hotelId}/fee-policy`, { quiet: true });
        if (!cancelled) setFeePolicy({ ...policy, overstayPolicy: policy.overstayPolicy ?? DEFAULT_OVERSTAY_POLICY });
      } catch {
        if (!cancelled) {
          setFeePolicy({
            earlyCheckinFee: 0,
            lateCheckoutFee: 0,
            noShowDefaultFee: 0,
            currency: "RWF",
            overstayPolicy: DEFAULT_OVERSTAY_POLICY,
          });
        }
      }

      try {
        const hotels = await apiFetch<PublicHotel[]>("/api/v1/public/hotels");
        const hotel = hotels.find((h) => h.id === hotelId);
        if (!hotel || cancelled) return;
        if (!loadedSettings) {
          setHotelName(hotel.name || "Hotel");
          setLogoUrl(hotel.logoUrl ?? "");
        }
        setHeroImageUrl(hotel.imageUrl ?? "");
      } catch {
        /* keep */
      }

      try {
        const raw = localStorage.getItem(localSettingsKey(hotelId));
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as { logoUrl?: string; imageUrl?: string };
        if (parsed.logoUrl) setLogoUrl(parsed.logoUrl);
        if (parsed.imageUrl) setHeroImageUrl(parsed.imageUrl);
      } catch {
        /* ignore */
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
      name: settings?.name ?? hotelName,
      companyName: settings?.companyName ?? settings?.name ?? hotelName,
      logoUrl: logoUrl.trim() || null,
      phone: settings?.phone ?? null,
      email: settings?.email ?? null,
      address: settings?.address ?? null,
      tinNumber: settings?.tinNumber ?? null,
      defaultCountry: settings?.defaultCountry ?? null,
      defaultIdType: settings?.defaultIdType ?? null,
      phoneCountryCode: settings?.phoneCountryCode ?? null,
      invoicePrefix: settings?.invoicePrefix ?? null,
      timezone: settings?.timezone ?? "UTC",
      currency: settings?.currency ?? feePolicy?.currency ?? "RWF",
      checkInTime: settings?.checkInTime ?? null,
      checkOutTime: settings?.checkOutTime ?? null,
      taxRate: settings?.taxRate ?? null,
    };

    let remoteSaved = false;
    try {
      await Promise.all([
        apiFetch(`/api/v1/hotels/${hotelId}/settings`, { method: "PUT", body: JSON.stringify(body) }),
        apiFetch(`/api/v1/hotels/${hotelId}/fee-policy`, {
          method: "PUT",
          body: JSON.stringify({
            earlyCheckinFee: feePolicy?.earlyCheckinFee ?? 0,
            lateCheckoutFee: feePolicy?.lateCheckoutFee ?? 0,
            noShowDefaultFee: feePolicy?.noShowDefaultFee ?? 0,
            currency,
            overstayPolicy,
          }),
        }),
      ]);
      remoteSaved = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Settings could not be saved";
      setError(message);
    }

    try {
      localStorage.setItem(localSettingsKey(hotelId), JSON.stringify({ logoUrl, imageUrl: heroImageUrl }));
    } catch {
      /* best effort */
    }

    setState(remoteSaved ? "saved" : "error");
    window.setTimeout(() => setState("idle"), 2000);
  }

  const preview = useMemo(() => {
    const nightly = 100000;
    const hours = 3;
    const raw = nightly * (Number(overstayPolicy.hourlyPercent) / 100) * hours;
    const fullNight = hours >= Number(overstayPolicy.fullDayAfterHours || 6);
    const halfCap = nightly * (Number(overstayPolicy.halfDayCapPercent) / 100);
    const dailyCap = nightly * (Number(overstayPolicy.maxDailyPercent) / 100);
    const amount = fullNight ? Math.min(nightly, dailyCap || nightly) : Math.min(raw, halfCap || raw, dailyCap || raw);
    return Math.round(amount * 100) / 100;
  }, [overstayPolicy]);

  function updateOverstayPolicy<K extends keyof NonNullable<FeePolicy["overstayPolicy"]>>(
    key: K,
    value: NonNullable<FeePolicy["overstayPolicy"]>[K],
  ) {
    setFeePolicy((current) => {
      const base = current ?? {
        earlyCheckinFee: 0,
        lateCheckoutFee: 0,
        noShowDefaultFee: 0,
        currency: settings?.currency ?? "RWF",
        overstayPolicy: DEFAULT_OVERSTAY_POLICY,
      };
      return {
        ...base,
        overstayPolicy: { ...(base.overstayPolicy ?? DEFAULT_OVERSTAY_POLICY), [key]: value },
      };
    });
  }

  function updateHotelSetting<K extends keyof HotelSettingsResponse>(key: K, value: HotelSettingsResponse[K]) {
    setSettings((current) => {
      const next = {
        id: hotelId,
        name: hotelName,
        currency,
        ...(current ?? {}),
        [key]: value,
      };
      if (key === "name") setHotelName(String(value || "Hotel"));
      return next;
    });
  }

  const statusPill =
    state === "saving"
      ? "bg-amber-100 text-amber-800"
      : state === "saved"
        ? "bg-emerald-100 text-emerald-800"
        : state === "error"
          ? "bg-rose-100 text-rose-800"
          : "bg-slate-100 text-slate-600";

  return (
    <div className="relative -mx-2 min-h-[calc(100vh-8rem)] px-2 pb-8 sm:-mx-4 sm:px-4">
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
        aria-hidden
      >
        <div className="absolute -left-20 top-0 h-64 w-64 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-cyan-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-48 w-96 rounded-full bg-emerald-100/40 blur-3xl" />
      </div>

      <div className="mx-auto max-w-5xl space-y-4">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-md">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-600">Configuration</p>
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-950">{hotelName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusPill}`}>
              {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Error" : "Ready"}
            </span>
            <button type="button" onClick={saveSettings} disabled={state === "saving"} className="hms-btn-solid hms-btn-sm">
              {state === "saving" ? "Saving…" : "Save all"}
            </button>
          </div>
        </header>

        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-5">
          {/* Left: identity */}
          <section className="space-y-4 lg:col-span-3">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md">
              <h2 className="text-sm font-bold text-slate-900">Hotel profile</h2>
              <p className="mt-0.5 text-xs text-slate-500">Shown on invoices, receipts, and guest documents.</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Display name">
                  <input
                    value={settings?.name ?? hotelName}
                    onChange={(e) => updateHotelSetting("name", e.target.value)}
                    className={inputClass}
                    placeholder="Hotel name"
                  />
                </Field>
                <Field label="Legal / company name">
                  <input
                    value={settings?.companyName ?? ""}
                    onChange={(e) => updateHotelSetting("companyName", e.target.value)}
                    className={inputClass}
                    placeholder="Registered company"
                  />
                </Field>
                <Field label="Telephone">
                  <input
                    value={settings?.phone ?? ""}
                    onChange={(e) => updateHotelSetting("phone", e.target.value)}
                    className={inputClass}
                    placeholder="+250 …"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={settings?.email ?? ""}
                    onChange={(e) => updateHotelSetting("email", e.target.value)}
                    className={inputClass}
                    placeholder="contact@hotel.com"
                  />
                </Field>
                <Field label="TIN number">
                  <input
                    value={settings?.tinNumber ?? ""}
                    onChange={(e) => updateHotelSetting("tinNumber", e.target.value)}
                    className={`${inputClass} font-mono text-xs`}
                    placeholder="Tax ID"
                  />
                </Field>
                <Field label="Currency">
                  <input
                    value={settings?.currency ?? currency}
                    onChange={(e) => updateHotelSetting("currency", e.target.value)}
                    className={inputClass}
                    placeholder="RWF"
                  />
                </Field>
                <Field label="Location" span="full">
                  <textarea
                    rows={2}
                    value={settings?.address ?? ""}
                    onChange={(e) => updateHotelSetting("address", e.target.value)}
                    className={`${inputClass} resize-none`}
                    placeholder="Street, city, country"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Late checkout policy</h2>
                  <p className="mt-0.5 max-w-md text-xs text-slate-500">
                    Auto fee when guest stays past checkout. Use{" "}
                    <strong className="font-semibold text-slate-700">Extend stay</strong> on the reservation if they pay
                    for another night instead.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={overstayPolicy.autoPostEnabled}
                  onClick={() => updateOverstayPolicy("autoPostEnabled", !overstayPolicy.autoPostEnabled)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    overstayPolicy.autoPostEnabled ? "bg-violet-600" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                      overstayPolicy.autoPostEnabled ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MetricInput
                  label="Grace"
                  suffix="min"
                  min={0}
                  value={overstayPolicy.graceMinutes}
                  onChange={(n) => updateOverstayPolicy("graceMinutes", Math.max(0, n))}
                />
                <MetricInput
                  label="Per hour"
                  suffix="% rate"
                  min={0}
                  step={0.1}
                  value={overstayPolicy.hourlyPercent}
                  onChange={(n) => updateOverstayPolicy("hourlyPercent", Math.max(0, n))}
                />
                <MetricInput
                  label="Full night"
                  suffix="hrs late"
                  min={1}
                  value={overstayPolicy.fullDayAfterHours}
                  onChange={(n) => updateOverstayPolicy("fullDayAfterHours", Math.max(1, n))}
                />
                <MetricInput
                  label="Half-day cap"
                  suffix="%"
                  min={0}
                  value={overstayPolicy.halfDayCapPercent}
                  onChange={(n) => updateOverstayPolicy("halfDayCapPercent", Math.max(0, n))}
                />
                <MetricInput
                  label="Daily max"
                  suffix="%"
                  min={0}
                  value={overstayPolicy.maxDailyPercent}
                  onChange={(n) => updateOverstayPolicy("maxDailyPercent", Math.max(0, n))}
                />
                <div className="rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-2 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Post timing</p>
                  <select
                    value={overstayPolicy.postTiming}
                    onChange={(e) =>
                      updateOverstayPolicy("postTiming", e.target.value as "AT_CHECKOUT" | "SCHEDULED_AUTO")
                    }
                    className="mt-1 w-full border-0 bg-transparent p-0 text-xs font-semibold text-slate-800 shadow-none focus:ring-0"
                  >
                    <option value="AT_CHECKOUT">At checkout</option>
                    <option value="SCHEDULED_AUTO">Auto while overdue</option>
                  </select>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 px-3 py-2 text-xs">
                <span className="text-slate-600">
                  Preview: 3 hrs late @ 100k →{" "}
                  <strong className="text-violet-900">
                    {preview.toLocaleString()} {currency}
                  </strong>
                </span>
              </div>
            </div>
          </section>

          {/* Right: branding */}
          <section className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md">
              <h2 className="text-sm font-bold text-slate-900">Branding</h2>
              <p className="mt-0.5 text-xs text-slate-500">Logo and cover for web & print.</p>
              <div className="mt-3 space-y-3">
                <ImageUpload
                  variant="compact"
                  previewShape="square"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Logo"
                  placeholder="URL or upload"
                />
                <ImageUpload
                  variant="compact"
                  previewShape="banner"
                  value={heroImageUrl}
                  onChange={setHeroImageUrl}
                  label="Cover"
                  placeholder="URL or upload"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-violet-200/80 bg-violet-50/50 p-3 text-xs leading-relaxed text-violet-900/90">
              <p className="font-semibold text-violet-800">Guest wants another night?</p>
              <p className="mt-1 text-violet-800/80">
                Open the reservation → <strong>Extend stay</strong> → pick new checkout date. That adds room nights and
                clears overstay fees. Do not use late checkout for that case.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
