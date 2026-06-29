import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Top padding for screen headers (status bar / notch + small gap). */
export function useHeaderPadding(extra = 8): number {
  const insets = useSafeAreaInsets();
  return insets.top + extra;
}

/** Bottom padding for tab bars and footers (home indicator / nav bar). */
export function useBottomPadding(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}
