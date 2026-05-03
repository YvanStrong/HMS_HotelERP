"use client";

export const HMS_ERROR_EVENT = "hms:error";

export type HmsErrorDetail = {
  message: string;
  title?: string;
  timeoutMs?: number;
};

export function showErrorPopup(detail: HmsErrorDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<HmsErrorDetail>(HMS_ERROR_EVENT, { detail }));
}

