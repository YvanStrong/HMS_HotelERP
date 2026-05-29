"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

type PlatformModuleRow = {
  moduleKey: string;
  label: string;
  description?: string | null;
  tier: string;
  locked: boolean;
  paidAddon: boolean;
  pricePerMonth?: number | null;
  enabled?: boolean | null;
  showWhenDisabled?: boolean | null;
  billingStatus?: string | null;
};

type BusinessCategoryRow = { id: string; code: string; name: string };
type ModuleEntitlements = {
  coreModules: PlatformModuleRow[];
  enabledModules: PlatformModuleRow[];
  disabledModules: PlatformModuleRow[];
  availableAddons: PlatformModuleRow[];
  enabledModuleKeys: string[];
};

export default function HotelModulesPage() {
  const params = useParams();
  const hotelId = String(params.hotelId);
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [modules, setModules] = useState<ModuleEntitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [categoryRows, entitlementRows] = await Promise.all([
          apiFetch<BusinessCategoryRow[]>("/api/v1/platform/categories"),
          apiFetch<ModuleEntitlements>(`/api/v1/platform/hotels/${hotelId}/modules`),
        ]);
        if (cancelled) return;
        setCategories(categoryRows);
        setSelectedCategoryId(categoryRows[0]?.id ?? "");
        setModules(entitlementRows);
      } catch (e) {
        if (!cancelled) setMessage(e instanceof Error ? e.message : "Could not load hotel functions.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hotelId]);

  const standardModules = useMemo(
    () =>
      modules
        ? [...modules.enabledModules, ...modules.disabledModules]
            .filter((module) => module.tier === "DEFAULT")
            .sort((a, b) => a.label.localeCompare(b.label))
        : [],
    [modules],
  );

  const addonModules = useMemo(
    () =>
      modules
        ? [...modules.enabledModules, ...modules.availableAddons]
            .filter((module) => module.tier === "ADDON")
            .sort((a, b) => a.label.localeCompare(b.label))
        : [],
    [modules],
  );

  async function applyCategoryDefaults() {
    if (!selectedCategoryId) return;
    setBusy(true);
    setMessage(null);
    try {
      const next = await apiFetch<ModuleEntitlements>(`/api/v1/platform/hotels/${hotelId}/modules/category`, {
        method: "PUT",
        body: JSON.stringify({ categoryId: selectedCategoryId }),
        quiet: true,
      });
      setModules(next);
      setMessage("Business category defaults applied.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not apply category defaults.");
    } finally {
      setBusy(false);
    }
  }

  async function updateModule(
    module: PlatformModuleRow,
    enabled: boolean,
    showWhenDisabled = Boolean(module.showWhenDisabled),
    confirmDisable = true,
  ) {
    if (confirmDisable && !enabled && !window.confirm(`Disable ${module.label}? Dependent modules may also be disabled.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<{ entitlements: ModuleEntitlements; cascadeDisabled?: string[] }>(
        `/api/v1/platform/hotels/${hotelId}/modules/${module.moduleKey}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled,
            showWhenDisabled: enabled ? false : showWhenDisabled,
            reason: confirmDisable
              ? enabled
                ? "Enabled from Manage Functions"
                : "Disabled from Manage Functions"
              : showWhenDisabled
                ? "Show locked module in sidebar"
                : "Hide disabled module from sidebar",
          }),
          quiet: true,
        },
      );
      setModules(result.entitlements);
      setMessage(result.cascadeDisabled?.length ? `Updated. Also disabled: ${result.cascadeDisabled.join(", ")}.` : "Module updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update module.");
    } finally {
      setBusy(false);
    }
  }

  async function setSidebarVisibility(module: PlatformModuleRow, showWhenDisabled: boolean) {
    await updateModule(module, Boolean(module.enabled), showWhenDisabled, false);
  }

  async function toggleAddon(module: PlatformModuleRow, activate: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      if (activate) {
        await apiFetch(`/api/v1/platform/hotels/${hotelId}/modules/${module.moduleKey}/activate-addon`, {
          method: "POST",
          body: JSON.stringify({ billingStatus: "addon" }),
          quiet: true,
        });
      } else {
        await apiFetch(`/api/v1/platform/hotels/${hotelId}/modules/${module.moduleKey}/addon`, {
          method: "DELETE",
          quiet: true,
        });
      }
      const next = await apiFetch<ModuleEntitlements>(`/api/v1/platform/hotels/${hotelId}/modules`);
      setModules(next);
      setMessage(activate ? "Add-on activated." : "Add-on deactivated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not update add-on.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading hotel functions...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={`/platform/hotels/${hotelId}`} className="text-sm text-muted-foreground hover:text-primary">
            Back to hotel
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Manage Functions</h1>
          <p className="text-sm text-muted-foreground">
            Give or remove services for this hotel. Use Modules & Pricing to decide which services are paid add-ons globally.
          </p>
        </div>
        <Link href={`/platform/hotels/${hotelId}/edit`} className="hms-btn-outline">
          Edit Hotel Details
        </Link>
        <Link href="/platform/modules" className="hms-btn-outline">
          Choose Add-ons & Pricing
        </Link>
      </div>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label className="block text-sm font-medium mb-1.5">Business category template</label>
          <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          onClick={applyCategoryDefaults}
          disabled={busy || !selectedCategoryId}
        >
          Apply Defaults
        </button>
      </div>

      {modules && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Core Modules</h2>
            <p className="mb-3 text-sm text-muted-foreground">These stay enabled for every tenant.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {modules.coreModules.map((module) => (
                <div key={module.moduleKey} className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-bold">{module.label} <span className="text-xs text-muted-foreground">locked</span></p>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Standard Functions</h2>
            <p className="mb-3 text-sm text-muted-foreground">Turn modules on/off. Hidden disabled modules disappear from the hotel sidebar.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {standardModules.map((module) => (
                <ModuleCard
                  key={module.moduleKey}
                  module={module}
                  busy={busy}
                  onToggle={(enabled) => updateModule(module, enabled)}
                  onSidebarVisibility={(show) => setSidebarVisibility(module, show)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">Add-on Services</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Activate an add-on to give it to this hotel. Deactivate it to remove it from this hotel.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {addonModules.map((module) => (
                <ModuleCard
                  key={module.moduleKey}
                  module={module}
                  busy={busy}
                  actionLabel={module.enabled ? "Deactivate Add-on" : "Activate Add-on"}
                  onToggle={(enabled) => toggleAddon(module, enabled)}
                  onSidebarVisibility={(show) => setSidebarVisibility(module, show)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  busy,
  actionLabel,
  onToggle,
  onSidebarVisibility,
}: {
  module: PlatformModuleRow;
  busy: boolean;
  actionLabel?: string;
  onToggle: (enabled: boolean) => void | Promise<void>;
  onSidebarVisibility: (show: boolean) => void | Promise<void>;
}) {
  const active = Boolean(module.enabled);
  return (
    <div className="rounded-xl border border-border bg-background p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{module.label}</p>
          <p className="text-xs text-muted-foreground">{module.description}</p>
          {module.pricePerMonth != null && (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">${module.pricePerMonth}/month</p>
          )}
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
          {active ? "ENABLED" : module.showWhenDisabled ? "LOCKED" : "HIDDEN"}
        </span>
      </div>
      {!active && (
        <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(module.showWhenDisabled)}
            disabled={busy}
            onChange={(e) => void onSidebarVisibility(e.target.checked)}
          />
          Show as locked in hotel sidebar
        </label>
      )}
      <button type="button" className="hms-btn-outline mt-3 text-sm" disabled={busy} onClick={() => void onToggle(!active)}>
        {actionLabel ?? (active ? "Disable" : "Enable")}
      </button>
    </div>
  );
}
