import { getCardStyle, getInputStyle, getPrimaryButtonStyle, getThemeColors } from '../constants/theme';
import { useAppStore } from '../store/appStore';

export function useThemeMode() {
  return useAppStore((s) => s.themeMode);
}

export function useThemeColors() {
  return getThemeColors(useAppStore((s) => s.themeMode));
}

export function useCardStyle() {
  return getCardStyle(useAppStore((s) => s.themeMode));
}

export function useInputStyle() {
  return getInputStyle(useAppStore((s) => s.themeMode));
}

export function usePrimaryButtonStyle() {
  return getPrimaryButtonStyle(useAppStore((s) => s.themeMode));
}

/** Convenience bundle for screens still using cardStyle + colors together. */
export function useThemedStyles() {
  const mode = useAppStore((s) => s.themeMode);
  return {
    colors: getThemeColors(mode),
    cardStyle: getCardStyle(mode),
    inputStyle: getInputStyle(mode),
    primaryButtonStyle: getPrimaryButtonStyle(mode),
  };
}
