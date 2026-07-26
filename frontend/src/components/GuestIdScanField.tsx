"use client";

import { useRef, useState } from "react";
import { parseRwandaIdScan, type RwandaIdScanResult } from "@/lib/parseRwandaIdScan";

type Props = {
  onParsed: (result: RwandaIdScanResult) => void;
  className?: string;
};

/**
 * Wedge / keyboard barcode scanners typically type characters then Enter.
 * Staff can also paste a scan string and press Apply.
 */
export function GuestIdScanField({ onParsed, className = "" }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function apply(raw: string) {
    const parsed = parseRwandaIdScan(raw);
    if (!parsed) {
      setError("Could not read ID scan. Expect 16-digit ID then SURNAME + Firstname (spaces optional).");
      setHint(null);
      return;
    }
    setError(null);
    setHint(`Filled: ${parsed.fullName} · ID ${parsed.nationalId}`);
    setValue("");
    onParsed(parsed);
    inputRef.current?.focus();
  }

  return (
    <div className={`rounded-2xl border border-sky-200 bg-sky-50/70 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-sky-800">Scan national ID</p>
          <p className="mt-0.5 text-xs text-sky-700/90">
            Scan the ID barcode, or paste the scan string and press Enter.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
            setHint(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply(value);
            }
          }}
          placeholder="e.g. 1 2001 7 0135399 0 05…INGABIREGloria…"
          className="w-full flex-1 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-medium"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="hms-btn-solid shrink-0 whitespace-nowrap"
          onClick={() => apply(value)}
        >
          Apply scan
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
      {hint && !error && <p className="mt-2 text-xs font-semibold text-emerald-700">{hint}</p>}
    </div>
  );
}
