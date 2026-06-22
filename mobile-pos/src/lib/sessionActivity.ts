import { mmkvGetString, mmkvSetString } from "../storage/mmkv";

export const LAST_ACTIVE_KEY = "last_active_at";
export const LOCK_MS = 30 * 60 * 1000;

export function bumpSessionActivity(): void {
  mmkvSetString(LAST_ACTIVE_KEY, String(Date.now()));
}

export function idleMsSinceLastActivity(): number {
  const last = Number(mmkvGetString(LAST_ACTIVE_KEY) ?? "0");
  return Date.now() - last;
}
