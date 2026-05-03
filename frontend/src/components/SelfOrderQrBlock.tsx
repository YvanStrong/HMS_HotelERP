"use client";

import QRCode from "react-qr-code";

export function SelfOrderQrBlock({ value, caption }: { value: string; caption: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4">
      <div className="rounded-lg bg-white p-2">
        <QRCode value={value} size={168} level="M" />
      </div>
      <p className="text-xs text-center text-muted-foreground max-w-[220px]">{caption}</p>
    </div>
  );
}
