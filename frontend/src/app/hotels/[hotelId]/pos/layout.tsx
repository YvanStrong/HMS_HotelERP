"use client";

/** POS uses the full main viewport; inner panels scroll instead of the page. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-7.25rem)] max-h-[calc(100dvh-7.25rem)] min-h-0 w-full flex-col overflow-hidden lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)]">
      {children}
    </div>
  );
}
