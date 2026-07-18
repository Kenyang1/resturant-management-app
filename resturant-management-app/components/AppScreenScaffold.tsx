/**
 * Standard screen shell: SafeAreaView + the desktop-web centered content frame + a scrolling
 * body, with optional fixed (non-scrolling) header/footer slots for the pattern several screens
 * already used ad hoc (title bar above the list, floating action button below it).
 */
import type { ReactNode } from "react"
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { SafeAreaView, type Edge } from "react-native-safe-area-context"
import { useMobileLayout } from "@/lib/layout"
import { colors } from "@/lib/theme"

type AppScreenScaffoldProps = {
  children: ReactNode
  /** Fixed content above the scroll area — title, progress bar, segmented control, etc. */
  header?: ReactNode
  /** Fixed content below the scroll area — a floating add button, bottom action bar, etc. */
  footer?: ReactNode
  edges?: Edge[]
  contentContainerStyle?: StyleProp<ViewStyle>
}

export function AppScreenScaffold({
  children,
  header,
  footer,
  edges = ["top", "left", "right"],
  contentContainerStyle,
}: AppScreenScaffoldProps) {
  const { horizontal, scrollBottomPad, desktopFrameStyle } = useMobileLayout()

  return (
    <SafeAreaView style={styles.safeRoot} edges={edges}>
      <View style={desktopFrameStyle}>
        {header ? <View style={{ paddingHorizontal: horizontal }}>{header}</View> : null}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad, gap: 16 },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {children}
        </ScrollView>
        {footer}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
})
