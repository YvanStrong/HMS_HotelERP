"use client";

import { useEffect, useRef, useState } from "react";
import { HMS_ERROR_EVENT, type HmsErrorDetail } from "@/lib/errorPopup";

type PopupState = {
  visible: boolean;
  title: string;
  message: string;
  timeoutMs: number;
};

const DEFAULT_TIMEOUT_MS = 4200;

export function ErrorPopupHost() {
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    title: "Error",
    message: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearPopupTimer = () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const openPopup = (detail: HmsErrorDetail) => {
      clearPopupTimer();
      const timeoutMs = detail.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      setPopup({
        visible: true,
        title: detail.title || "Error",
        message: detail.message || "Something went wrong.",
        timeoutMs,
      });
      timerRef.current = window.setTimeout(() => {
        setPopup((prev) => ({ ...prev, visible: false }));
      }, timeoutMs);
    };

    const onHmsError = (event: Event) => {
      const customEvent = event as CustomEvent<HmsErrorDetail>;
      openPopup(customEvent.detail ?? { message: "Unexpected error." });
    };

    const onWindowError = (event: ErrorEvent) => {
      openPopup({ message: event.message || "Unexpected runtime error." });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason instanceof Error
            ? reason.message
            : "Unhandled async error.";
      openPopup({ message });
    };

    window.addEventListener(HMS_ERROR_EVENT, onHmsError as EventListener);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      clearPopupTimer();
      window.removeEventListener(HMS_ERROR_EVENT, onHmsError as EventListener);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (!popup.visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-4 shadow-2xl animate-fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-destructive">{popup.title}</p>
            <p className="mt-1 text-sm text-foreground">{popup.message}</p>
          </div>
          <button
            type="button"
            className="hms-btn-outline hms-btn-sm"
            onClick={() => setPopup((prev) => ({ ...prev, visible: false }))}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

