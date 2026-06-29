/** Allergen and dietary flag display helpers for mobile POS. */

export const ALLERGEN_ICONS: Record<string, { emoji: string; label: string }> = {
  NUTS: { emoji: "🥜", label: "Nuts" },
  GLUTEN: { emoji: "🌾", label: "Gluten" },
  DAIRY: { emoji: "🥛", label: "Dairy" },
  EGGS: { emoji: "🥚", label: "Eggs" },
  SHELLFISH: { emoji: "🐚", label: "Shellfish" },
  SOY: { emoji: "🫘", label: "Soy" },
  SESAME: { emoji: "🌰", label: "Sesame" },
  FISH: { emoji: "🐟", label: "Fish" },
};

export const DIETARY_ICONS: Record<string, { emoji: string; label: string }> = {
  VEGAN: { emoji: "🌿", label: "Vegan" },
  VEGETARIAN: { emoji: "🥬", label: "Vegetarian" },
  HALAL: { emoji: "🥩", label: "Halal" },
  KOSHER: { emoji: "✡️", label: "Kosher" },
  GLUTEN_FREE: { emoji: "🌾", label: "Gluten-free" },
  DAIRY_FREE: { emoji: "🥛", label: "Dairy-free" },
};

export type HoldCourse = "STARTER" | "MAIN" | "DESSERT";

export const HOLD_COURSES: { id: HoldCourse; label: string }[] = [
  { id: "STARTER", label: "Starter" },
  { id: "MAIN", label: "Main" },
  { id: "DESSERT", label: "Dessert" },
];

/** Parse guest dietary notes into restriction tokens. */
export function parseGuestRestrictions(notes?: string | null): string[] {
  if (!notes?.trim()) return [];
  const n = notes.toLowerCase();
  const found: string[] = [];
  if (n.includes("vegan")) found.push("VEGAN");
  if (n.includes("vegetarian") || n.includes("veggie")) found.push("VEGETARIAN");
  if (n.includes("halal")) found.push("HALAL");
  if (n.includes("kosher")) found.push("KOSHER");
  if (n.includes("gluten")) found.push("GLUTEN_FREE");
  if (n.includes("dairy") || n.includes("lactose")) found.push("DAIRY_FREE");
  if (n.includes("nut")) found.push("NUTS");
  if (n.includes("shellfish") || n.includes("seafood")) found.push("SHELLFISH");
  return found;
}

export function productConflictsWithGuest(
  allergens: string[] | undefined,
  dietaryFlags: string[] | undefined,
  guestRestrictions: string[],
): { conflict: boolean; message?: string } {
  if (guestRestrictions.length === 0) return { conflict: false };
  const a = new Set((allergens ?? []).map((x) => x.toUpperCase()));
  const d = new Set((dietaryFlags ?? []).map((x) => x.toUpperCase()));

  for (const r of guestRestrictions) {
    if (r === "VEGAN" && (a.has("DAIRY") || a.has("EGGS") || a.has("FISH") || a.has("SHELLFISH"))) {
      return { conflict: true, message: `Contains animal products — guest is vegan` };
    }
    if (r === "VEGETARIAN" && (a.has("FISH") || a.has("SHELLFISH"))) {
      return { conflict: true, message: `Contains fish/shellfish — guest is vegetarian` };
    }
    if (r === "GLUTEN_FREE" && a.has("GLUTEN")) {
      return { conflict: true, message: `Contains gluten — guest needs gluten-free` };
    }
    if (r === "DAIRY_FREE" && a.has("DAIRY")) {
      return { conflict: true, message: `Contains dairy — guest is dairy-free` };
    }
    if (r === "NUTS" && a.has("NUTS")) {
      return { conflict: true, message: `Contains nuts — guest has nut allergy` };
    }
    if (r === "SHELLFISH" && a.has("SHELLFISH")) {
      return { conflict: true, message: `Contains shellfish — guest allergy` };
    }
    if (r === "HALAL" && !d.has("HALAL")) {
      return { conflict: true, message: `Not marked halal — guest requires halal` };
    }
  }
  return { conflict: false };
}

export function localizedProductName(
  product: { productName: string; nameTranslations?: Record<string, string> | null },
  lang: string,
): string {
  const tr = product.nameTranslations?.[lang] ?? product.nameTranslations?.[lang.split("-")[0]];
  return tr?.trim() || product.productName;
}
