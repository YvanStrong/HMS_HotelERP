"use client";

export function ModuleDisabledPage({ module }: { module: string }) {
  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950 shadow-soft">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Module disabled</p>
      <h1 className="mt-2 text-2xl font-black">{module} is not enabled for this property</h1>
      <p className="mt-3 text-sm leading-6 text-amber-900">
        This hotel or restaurant package does not currently include this feature. Contact the platform administrator to
        enable it or activate the relevant add-on.
      </p>
    </section>
  );
}
