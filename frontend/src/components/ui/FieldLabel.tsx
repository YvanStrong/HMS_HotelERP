"use client";

import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  label: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
  htmlFor?: string;
};

export function FieldLabel({ label, hint, children, className = "", htmlFor }: Props) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <span>{label}</span>
        {hint ? (
          <span className="group relative inline-flex shrink-0" title={hint}>
            <HelpCircle className="h-3.5 w-3.5 cursor-help text-slate-400" aria-hidden />
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block md:group-hover:block"
            >
              {hint}
            </span>
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
