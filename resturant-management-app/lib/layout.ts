import { useMemo } from "react"
import { useWindowDimensions } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/**
 * Responsive spacing for the whole app: horizontal padding, bottom scroll inset (clears tab bar + home indicator),
 * and mascot heights. Recomputed when window size or safe-area insets change (rotation, notch, etc.).
 */
export function useMobileLayout() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  return useMemo(() => {
    const horizontal = width < 360 ? 16 : 20
    // Extra space above the tab bar so list content is not hidden behind it.
    const scrollBottomPad = 28 + Math.max(insets.bottom, 4)
    const compact = width < 375
    const homeMascotHeight = compact ? 130 : 160
    const tabMascotHeight = compact ? 118 : 140

    return {
      insets,
      horizontal,
      scrollBottomPad,
      width,
      height,
      compact,
      homeMascotHeight,
      tabMascotHeight,
    }
  }, [insets, width, height])
}
