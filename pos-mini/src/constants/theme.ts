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

export const cardStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 12,
} as const;

export const inputStyle = {
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: 10,
  backgroundColor: colors.surface,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 16,
  color: colors.text,
} as const;

/** Solid primary button surface */
export const primaryButtonStyle = {
  backgroundColor: colors.primary,
  borderRadius: 12,
} as const;

/** Selected chip / toggle (light blue — keep dark text) */
export const selectedChipStyle = {
  borderColor: colors.primary,
  backgroundColor: colors.primarySoft,
} as const;

export const unselectedChipStyle = {
  borderColor: colors.border,
  backgroundColor: colors.surface,
} as const;
