"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, getToken } from "@/lib/api";

type PlatformModuleRow = {
  moduleKey: string;
  label: string;
  description?: string | null;
  tier: string;
  navSection?: string | null;
};

type BusinessCategoryRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  active: boolean;
  modules: PlatformModuleRow[];
};

export default function PlatformCategoriesPage() {
  const [categories, setCategories] = useState<BusinessCategoryRow[]>([]);
  const [modulesByTier, setModulesByTier] = useState<Record<string, PlatformModuleRow[]>>({});
  const [editing, setEditing] = useState<BusinessCategoryRow | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [moduleKeys, setModuleKeys] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectableModules = useMemo(
    () => Object.values(modulesByTier).flat().filter((module) => module.tier !== "CORE"),
    [modulesByTier],
  );

  async function load() {
    if (!getToken()) return;
    const [categoryRows, moduleRows] = await Promise.all([
      apiFetch<BusinessCategoryRow[]>("/api/v1/platform/categories", { quiet: true }),
      apiFetch<Record<string, PlatformModuleRow[]>>("/api/v1/platform/modules", { quiet: true }),
    ]);
    setCategories(categoryRows);
    setModulesByTier(moduleRows);
  }

  useEffect(() => {
    void load().catch((e) => setMessage(e instanceof Error ? e.message : "Could not load categories."));
  }, []);

  function beginEdit(category?: BusinessCategoryRow) {
    setEditing(category ?? null);
    setCode(category?.code ?? "");
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setIcon(category?.icon ?? "");
    setModuleKeys(category?.modules.map((module) => module.moduleKey) ?? []);
    setMessage(null);
  }

  async function saveCategory() {
    setBusy(true);
    setMessage(null);
    try {
      const body = { code, name, description, icon, moduleKeys };
      if (editing) {
        await apiFetch(`/api/v1/platform/categories/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
          quiet: true,
        });
      } else {
        await apiFetch("/api/v1/platform/categories", {
          method: "POST",
          body: JSON.stringify(body),
          quiet: true,
        });
      }
      beginEdit();
      await load();
      setMessage("Category saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save category.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(category: BusinessCategoryRow) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiFetch(`/api/v1/platform/categories/${category.id}`, { method: "DELETE", quiet: true });
      await load();
      setMessage("Category deleted.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not delete category.");
    } finally {
      setBusy(false);
    }
  }

  function toggleModule(key: string) {
    setModuleKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Business Categories</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage category templates used when provisioning hotels, restaurants, event venues, and apartments.
        </p>
      </div>
      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</div>}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-lg font-bold">{editing ? `Edit ${editing.name}` : "Create Category"}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label>Code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} disabled={editing?.code === "FULL_HOTEL"} />
          </div>
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label>Icon</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="building-2" />
          </div>
          <div className="md:col-span-2">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {selectableModules.map((module) => (
            <label key={module.moduleKey} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-sm">
              <input type="checkbox" checked={moduleKeys.includes(module.moduleKey)} onChange={() => toggleModule(module.moduleKey)} />
              <span>
                <span className="block font-bold">{module.label}</span>
                <span className="text-xs text-muted-foreground">{module.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" className="hms-btn-solid" onClick={saveCategory} disabled={busy || !code.trim() || !name.trim()}>
            {busy ? "Saving..." : "Save category"}
          </button>
          <button type="button" className="hms-btn-outline" onClick={() => beginEdit()}>
            Clear
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {categories.map((category) => (
          <div key={category.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold">{category.name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{category.code}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="hms-btn-outline text-sm" onClick={() => beginEdit(category)}>
                  Edit
                </button>
                {category.code !== "FULL_HOTEL" && (
                  <button type="button" className="hms-btn-outline text-sm" onClick={() => void deleteCategory(category)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
            {category.description && <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>}
            <p className="mt-3 text-xs text-muted-foreground">
              Modules: {category.modules.map((module) => module.label).join(", ") || "Core modules only"}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
