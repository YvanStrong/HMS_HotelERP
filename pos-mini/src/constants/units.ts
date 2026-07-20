export const UNIT_PRESETS = [
  'pcs',
  'kg',
  'g',
  'lb',
  'oz',
  'L',
  'mL',
  'box',
  'pack',
  'dozen',
  'bottle',
  'can',
  'bag',
  'roll',
  'meter',
  'cm',
  'pair',
  'set',
  'case',
  'tray',
] as const;

export type UnitPreset = (typeof UNIT_PRESETS)[number];

export function isPresetUnit(unit: string): unit is UnitPreset {
  return (UNIT_PRESETS as readonly string[]).includes(unit);
}
