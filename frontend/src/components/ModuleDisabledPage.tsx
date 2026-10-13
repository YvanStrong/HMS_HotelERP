"use client";

export function ModuleDisabledPage({
  module,
  reason = "module",
}: {
  module: string;
  /** module = not entitled on hotel; access = role/permission denied */
  reason?: "module" | "access";
}) {
  if (reason === "access") {
    return (
      <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-rose-200 bg-rose-50 p-8 text-rose-950 shadow-soft dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-50">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">
          Access denied
        </p>
        <h1 className="mt-2 text-2xl font-black">{module} is not available for your role</h1>
        <p className="mt-3 text-sm leading-6 text-rose-900 dark:text-rose-100/90">
          Your account does not have permission to use this area. Contact a hotel administrator if you
          believe you should have access.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-amber-950 shadow-soft dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-50">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
        Module disabled
      </p>
      <h1 className="mt-2 text-2xl font-black">{module} is not enabled for this property</h1>
      <p className="mt-3 text-sm leading-6 text-amber-900 dark:text-amber-100/90">
        This hotel or restaurant package does not currently include this feature. Contact the platform
        administrator to enable it or activate the relevant add-on.
      </p>
    </section>
  );
}
