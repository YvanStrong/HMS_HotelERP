"use client";

import type { DepotRow } from "@/lib/posTickets";

type Props = {
  depots: DepotRow[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  selectClassName?: string;
  label?: string;
  showLabel?: boolean;
};

export function PosOutletSelect({
  depots,
  value,
  onChange,
  className,
  selectClassName = "hms-input",
  label = "Outlet",
  showLabel = true,
}: Props) {
  const select = (
    <select className={selectClassName} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">All outlets</option>
      {depots.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );

  if (!showLabel) return select;

  return (
    <label className={className ?? "flex flex-col gap-1 text-sm"}>
      {label}
      {select}
    </label>
  );
}
