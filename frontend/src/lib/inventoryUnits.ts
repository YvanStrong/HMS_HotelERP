/** Common product units for inventory items (dropdown). */
export const INVENTORY_PRODUCT_UNITS = [
  "piece",
  "box",
  "carton",
  "pack",
  "bottle",
  "can",
  "kg",
  "g",
  "lb",
  "oz",
  "l",
  "ml",
  "m",
  "cm",
  "roll",
  "set",
  "pair",
  "dozen",
  "crate",
  "pallet",
  "bag",
  "tube",
  "unit",
] as const;

export type InventoryProductUnit = (typeof INVENTORY_PRODUCT_UNITS)[number];
