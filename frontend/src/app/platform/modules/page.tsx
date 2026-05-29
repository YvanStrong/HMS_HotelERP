"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

type PlatformModuleRow = {
  moduleKey: string;
  label: string;
  description?: string | null;
  tier: string;
  locked: boolean;
  paidAddon: boolean;
  pricePerMonth?: number | null;
  active: boolean;
  sortOrder?: number | null;
};

type ModuleForm = {
  label: string;
  description: string;
  tier: string;
  priceMode: string;
  customPrice: string;
  active: boolean;
  sortOrder: string;
};

const PRICE_OPTIONS = ["0", "9.99", "19.99", "29.99", "39.99", "49.99", "59.99", "79.99", "99.99", "149.99", "199.99", "299.99"];
const SORT_ORDER_OPTIONS = ["0", "10", "20", "30", "40", "50", "60", "70", "80", "90", "100", "150", "200", "300"];
const PAGE_SIZE = 6;

export default function PlatformModulesPage() {
  const [modules, setModules] = useState<PlatformModuleRow[]>([]);
  const [forms, setForms] = useState<Record<string, ModuleForm>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addonPage, setAddonPage] = useState(1);
  const [standardPage, setStandardPage] = useState(1);

  const addons = useMemo(
    () =>
      modules
        .filter((module) => module.tier === "ADDON")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label)),
    [modules],
  );

  const standardModules = useMemo(
    () =>
      modules
        .filter((module) => module.tier !== "ADDON")
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.label.localeCompare(b.label)),
    [modules],
  );

  const addonTotalPages = Math.max(1, Math.ceil(addons.length / PAGE_SIZE));
  const standardTotalPages = Math.max(1, Math.ceil(standardModules.length / PAGE_SIZE));
  const pagedAddons = addons.slice((addonPage - 1) * PAGE_SIZE, addonPage * PAGE_SIZE);
  const pagedStandardModules = standardModules.slice((standardPage - 1) * PAGE_SIZE, standardPage * PAGE_SIZE);

  useEffect(() => {
    setAddonPage((page) => Math.min(page, addonTotalPages));
    setStandardPage((page) => Math.min(page, standardTotalPages));
  }, [addonTotalPages, standardTotalPages]);

  async function load() {
    if (!getToken()) return;
    setLoading(true);
    try {
      const rows = await apiFetch<PlatformModuleRow[]>("/api/v1/platform/modules/catalog", { quiet: true });
      setModules(rows);
      setForms(Object.fromEntries(rows.map((module) => [module.moduleKey, toForm(module)])));
      setAddonPage(1);
      setStandardPage(1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function updateForm(moduleKey: string, patch: Partial<ModuleForm>) {
    setForms((prev) => ({ ...prev, [moduleKey]: { ...prev[moduleKey]!, ...patch } }));
  }

  async function saveModule(module: PlatformModuleRow) {
    const form = forms[module.moduleKey];
    if (!form) return;
    const priceValue = form.priceMode === "custom" ? form.customPrice : form.priceMode;
    if (form.priceMode === "custom" && priceValue.trim() === "") {
      setMessage("Enter a custom monthly price or choose a preset price.");
      return;
    }
    const parsedPrice = priceValue.trim() === "" ? null : Number(priceValue);
    if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setMessage("Price must be a positive number.");
      return;
    }
    setBusyKey(module.moduleKey);
    setMessage(null);
    try {
      const updated = await apiFetch<PlatformModuleRow>(`/api/v1/platform/modules/${module.moduleKey}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: form.label.trim(),
          description: form.description.trim(),
          tier: module.locked ? undefined : form.tier,
          pricePerMonth: parsedPrice,
          clearPrice: parsedPrice == null,
          active: form.active,
          sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        }),
        quiet: true,
      });
      setModules((prev) => prev.map((item) => (item.moduleKey === updated.moduleKey ? updated : item)));
      setForms((prev) => ({ ...prev, [updated.moduleKey]: toForm(updated) }));
      setMessage(`${updated.label} saved.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save module.");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading module catalog...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/70 to-slate-50 p-6 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">Platform Catalog</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Modules & Pricing</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Set monthly prices for any service, decide if it is standard or paid add-on, and control whether hotels can enable it.
            </p>
          </div>
          <button type="button" className="hms-btn-outline text-sm" onClick={() => void load()}>
            Refresh Catalog
          </button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SummaryCard label="Paid add-ons" value={addons.length} />
          <SummaryCard label="Standard/core services" value={standardModules.length} />
          <SummaryCard label="Available services" value={modules.filter((module) => module.active).length} />
        </div>
      </div>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Add-on Services</h2>
            <p className="text-sm text-muted-foreground">
              Services set to Paid Add-on appear here. You can also set prices for standard services below.
            </p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {pagedAddons.map((module) => (
            <ModuleEditor
              key={module.moduleKey}
              module={module}
              form={forms[module.moduleKey]}
              busy={busyKey === module.moduleKey}
              onChange={(patch) => updateForm(module.moduleKey, patch)}
              onSave={() => void saveModule(module)}
            />
          ))}
        </div>
        <PaginationControls
          currentPage={addonPage}
          totalPages={addonTotalPages}
          totalItems={addons.length}
          onPageChange={setAddonPage}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">Standard / Core Modules</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Set prices for standard services here too, or move a standard service to Paid Add-on if you want to sell it separately.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {pagedStandardModules.map((module) => (
            <ModuleEditor
              key={module.moduleKey}
              module={module}
              form={forms[module.moduleKey]}
              busy={busyKey === module.moduleKey}
              onChange={(patch) => updateForm(module.moduleKey, patch)}
              onSave={() => void saveModule(module)}
            />
          ))}
        </div>
        <PaginationControls
          currentPage={standardPage}
          totalPages={standardTotalPages}
          totalItems={standardModules.length}
          onPageChange={setStandardPage}
        />
      </section>
    </div>
  );
}

function ModuleEditor({
  module,
  form,
  busy,
  onChange,
  onSave,
}: {
  module: PlatformModuleRow;
  form?: ModuleForm;
  busy: boolean;
  onChange: (patch: Partial<ModuleForm>) => void;
  onSave: () => void;
}) {
  if (!form) return null;
  const priceLabel =
    form.priceMode === ""
      ? "No fixed price"
      : form.priceMode === "custom"
        ? form.customPrice
          ? `$${form.customPrice}/month`
          : "Custom price"
        : `$${form.priceMode}/month`;
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-slate-950">{module.moduleKey}</p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{form.tier}</p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${form.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
            {form.active ? "AVAILABLE" : "DISABLED"}
          </span>
          <p className="mt-2 text-xs font-bold text-emerald-700">{priceLabel}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label>Display name</label>
          <input value={form.label} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
        <div>
          <label>Price setup</label>
          <select value={form.priceMode} onChange={(e) => onChange({ priceMode: e.target.value })}>
            <option value="">No fixed price / custom quote</option>
            {PRICE_OPTIONS.map((price) => (
              <option key={price} value={price}>
                ${price}/month
              </option>
            ))}
            <option value="custom">Add custom price...</option>
          </select>
        </div>
        {form.priceMode === "custom" && (
          <div>
            <label>Custom monthly price</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.customPrice}
              onChange={(e) => onChange({ customPrice: e.target.value })}
              placeholder="Example: 64.99"
            />
          </div>
        )}
        <div>
          <label>Service type</label>
          <select
            value={form.tier}
            disabled={module.locked}
            onChange={(e) => onChange({ tier: e.target.value })}
          >
            {module.locked && <option value="CORE">Core module</option>}
            <option value="DEFAULT">Standard function</option>
            <option value="ADDON">Paid add-on</option>
          </select>
        </div>
        <div>
          <label>Sort order</label>
          <select value={form.sortOrder} onChange={(e) => onChange({ sortOrder: e.target.value })}>
            {sortOrderOptions(form.sortOrder).map((order) => (
              <option key={order} value={order}>
                {order}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Availability</label>
          <select
            value={form.active ? "available" : "disabled"}
            disabled={module.locked}
            onChange={(e) => onChange({ active: e.target.value === "available" })}
          >
            <option value="available">Available to enable</option>
            <option value="disabled">Disabled globally</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {module.locked
            ? "Core module is always available."
            : form.tier === "ADDON"
              ? "To give or remove this add-on for one hotel, open that hotel and use Manage Functions."
              : "Standard functions can also have prices and can be enabled on each hotel's Manage Functions page."}
        </p>
        <button type="button" className="hms-btn-solid text-sm" disabled={busy || !form.label.trim()} onClick={onSave}>
          {busy ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function toForm(module: PlatformModuleRow): ModuleForm {
  const savedPrice = module.pricePerMonth != null ? String(module.pricePerMonth) : "";
  const presetPrice = PRICE_OPTIONS.includes(savedPrice);
  return {
    label: module.label,
    description: module.description ?? "",
    tier: module.tier,
    priceMode: savedPrice === "" ? "" : presetPrice ? savedPrice : "custom",
    customPrice: savedPrice !== "" && !presetPrice ? savedPrice : "",
    active: module.active,
    sortOrder: String(module.sortOrder ?? 0),
  };
}

function sortOrderOptions(current: string): string[] {
  return SORT_ORDER_OPTIONS.includes(current) ? SORT_ORDER_OPTIONS : [current, ...SORT_ORDER_OPTIONS];
}

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= PAGE_SIZE) return null;
  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} · {totalItems} services
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="hms-btn-outline text-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          Previous
        </button>
        <select value={currentPage} onChange={(e) => onPageChange(Number(e.target.value))} className="w-24 text-sm">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <option key={page} value={page}>
              Page {page}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="hms-btn-outline text-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
