import { vars } from 'nativewind';

/** Flat POS palette — no gradients */
export const colors = {
  background: '#f1f5f9',
  surface: '#ffffff',
  border: '#cbd5e1',
  borderStrong: '#94a3b8',
  primary: '#1d4ed8',
  primaryPressed: '#1e3a8a',
  primarySoft: '#dbeafe',
  success: '#047857',
  successSoft: '#d1fae5',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  warning: '#b45309',
  text: '#0f172a',
  textMuted: '#64748b',
  textInverse: '#ffffff',
  placeholder: '#94a3b8',
} as const;

export const darkColors = {
  background: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  borderStrong: '#475569',
  primary: '#3b82f6',
  primaryPressed: '#2563eb',
  primarySoft: '#1e3a5f',
  success: '#34d399',
  successSoft: '#064e3b',
  danger: '#f87171',
  dangerSoft: '#450a0a',
  warning: '#fbbf24',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  textInverse: '#0f172a',
  placeholder: '#64748b',
} as const;

export type ThemeColors = typeof colors;

export function getThemeColors(mode: 'light' | 'dark'): ThemeColors {
  return (mode === 'dark' ? darkColors : colors) as ThemeColors;
}

export function getCardStyle(mode: 'light' | 'dark' = 'light') {
  const palette = getThemeColors(mode);
  return {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
  } as const;
}

/** Push palette into NativeWind CSS variables (required for text-app-* on native). */
export function themeVars(palette: ThemeColors) {
  return vars({
    '--color-app-bg': palette.background,
    '--color-app-surface': palette.surface,
    '--color-app-border': palette.border,
    '--color-app-primary': palette.primary,
    '--color-app-primary-soft': palette.primarySoft,
    '--color-app-success': palette.success,
    '--color-app-danger': palette.danger,
    '--color-app-muted': palette.textMuted,
    '--color-app-text': palette.text,
  });
}

export function getInputStyle(mode: 'light' | 'dark' = 'light') {
  const palette = getThemeColors(mode);
  return {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    backgroundColor: palette.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
  } as const;
}

export function getPrimaryButtonStyle(mode: 'light' | 'dark' = 'light') {
  const palette = getThemeColors(mode);
  return {
    backgroundColor: palette.primary,
    borderRadius: 12,
  } as const;
}

/** @deprecated Use getCardStyle(themeMode) */
export const cardStyle = getCardStyle('light');

/** @deprecated Use getInputStyle(themeMode) */
export const inputStyle = getInputStyle('light');

/** @deprecated Use getPrimaryButtonStyle(themeMode) */
export const primaryButtonStyle = getPrimaryButtonStyle('light');

export function getChipStyles(palette: ThemeColors, selected: boolean) {
  return {
    borderColor: selected ? palette.primary : palette.border,
    backgroundColor: selected ? palette.primarySoft : palette.surface,
  } as const;
}

/** @deprecated Use getChipStyles(palette, selected) */
export const selectedChipStyle = getChipStyles(colors, true);

/** @deprecated Use getChipStyles(palette, selected) */
export const unselectedChipStyle = getChipStyles(colors, false);
