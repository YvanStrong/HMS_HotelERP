import { mmkvGetString, mmkvSetString } from "../storage/mmkv";

const MAX_FAVORITES = 12;

function favoritesKey(userId: string, depotId: string): string {
  return `favorites_${userId}_${depotId}`;
}

export function loadFavorites(userId: string, depotId: string): string[] {
  if (!userId || !depotId) return [];
  const raw = mmkvGetString(favoritesKey(userId, depotId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveFavorites(userId: string, depotId: string, productIds: string[]): void {
  if (!userId || !depotId) return;
  mmkvSetString(favoritesKey(userId, depotId), JSON.stringify(productIds.slice(0, MAX_FAVORITES)));
}

export function toggleFavorite(
  userId: string,
  depotId: string,
  productId: string,
): { favorites: string[]; added: boolean } {
  const current = loadFavorites(userId, depotId);
  const idx = current.indexOf(productId);
  if (idx >= 0) {
    const next = current.filter((id) => id !== productId);
    saveFavorites(userId, depotId, next);
    return { favorites: next, added: false };
  }
  if (current.length >= MAX_FAVORITES) {
    return { favorites: current, added: false };
  }
  const next = [...current, productId];
  saveFavorites(userId, depotId, next);
  return { favorites: next, added: true };
}

export function isFavorite(userId: string, depotId: string, productId: string): boolean {
  return loadFavorites(userId, depotId).includes(productId);
}

export const FAVORITES_TAB = "⭐ Favorites";
