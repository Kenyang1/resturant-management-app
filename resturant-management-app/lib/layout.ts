import { useMemo } from "react"
import { Platform, useWindowDimensions, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/** Below this window width, the web build gets the same layout as the native phone app. */
export const DESKTOP_BREAKPOINT = 900
/** Width of the persistent left nav on desktop web. */
export const DESKTOP_SIDEBAR_WIDTH = 248
/** Content reads best capped at this width and centered, same idea as Notion/Linear's content column. */
export const DESKTOP_CONTENT_MAX_WIDTH = 860

/** True only for the web build at a desktop-sized viewport — never for the native phone app. */
export function useIsDesktopWeb() {
  const { width } = useWindowDimensions()
  return Platform.OS === "web" && width >= DESKTOP_BREAKPOINT
}

/**
 * Responsive spacing for the whole app: horizontal padding, bottom scroll inset (clears tab bar + home indicator),
 * mascot heights, and the desktop-web content column. Recomputed when window size or safe-area insets change.
 */
export function useMobileLayout() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()

  return useMemo(() => {
    const isDesktop = Platform.OS === "web" && width >= DESKTOP_BREAKPOINT
    const horizontal = isDesktop ? 32 : width < 360 ? 16 : 20
    // Extra space above the tab bar so list content is not hidden behind it.
    const scrollBottomPad = isDesktop ? 40 : 28 + Math.max(insets.bottom, 4)
    const compact = width < 375
    const homeMascotHeight = compact ? 130 : 160
    const tabMascotHeight = compact ? 118 : 140
    // Wrap a screen's top-level content in this so it reads as one centered column on desktop,
    // instead of mobile-width content pinned to the left of a huge browser window. Always
    // `flex: 1` (not just on desktop) since it wraps a ScrollView that needs a sized parent
    // chain to know its own scrollable height, on every platform.
    const desktopFrameStyle: ViewStyle = isDesktop
      ? { flex: 1, width: "100%", maxWidth: DESKTOP_CONTENT_MAX_WIDTH, alignSelf: "center" }
      : { flex: 1 }

    return {
      insets,
      horizontal,
      scrollBottomPad,
      width,
      height,
      compact,
      homeMascotHeight,
      tabMascotHeight,
      isDesktop,
      desktopFrameStyle,
    }
  }, [insets, width, height])
}
