"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export type WorkflowStep = {
  key: string;
  label: string;
  hint?: string;
};

type Props = {
  steps: WorkflowStep[];
  activeKey: string;
  onStepChange: (key: string) => void;
  className?: string;
};

export function GroupWorkflowNav({ steps, activeKey, onStepChange, className = "" }: Props) {
  const index = steps.findIndex((s) => s.key === activeKey);
  const safeIndex = index >= 0 ? index : 0;
  const prev = safeIndex > 0 ? steps[safeIndex - 1] : null;
  const next = safeIndex < steps.length - 1 ? steps[safeIndex + 1] : null;

  return (
    <div className={`space-y-3 ${className}`}>
      <nav aria-label="Group workflow steps" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1">
          {steps.map((step, i) => {
            const done = i < safeIndex;
            const current = i === safeIndex;
            return (
              <li key={step.key} className="flex items-center gap-1 sm:contents">
                <button
                  type="button"
                  title={step.hint}
                  onClick={() => onStepChange(step.key)}
                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold transition sm:w-auto ${
                    current
                      ? "bg-indigo-600 text-white shadow-sm"
                      : done
                        ? "bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      current ? "bg-white/20 text-white" : done ? "bg-indigo-200 text-indigo-900" : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="truncate">{step.label}</span>
                </button>
                {i < steps.length - 1 ? (
                  <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onStepChange(prev.key)}
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>
        <p className="text-center text-xs font-semibold text-slate-600">
          Step {safeIndex + 1} of {steps.length}
          <span className="hidden sm:inline"> · {steps[safeIndex]?.label}</span>
        </p>
        <button
          type="button"
          disabled={!next}
          onClick={() => next && onStepChange(next.key)}
          className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {next ? `Next: ${next.label}` : "Done"}
          {next ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
        </button>
      </div>
    </div>
  );
}
