/**
 * Native-feeling dialog: replaces the app's plain `Modal animationType="fade"` dialogs.
 * On mobile it's a bottom sheet — enter uses ease-out (an arriving element decelerating into
 * place), exit uses ease-in (accelerating away), and the handle is a real drag target (a
 * spring, not a fixed-duration timing, since the gesture can reverse or stop mid-drag).
 * On desktop web a bottom sheet has no meaning (nothing to swipe with a mouse), so it presents
 * as a centered dialog instead: scale + fade in/out, same enter/exit easing pairing.
 */
import { useEffect, useState } from "react"
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { useIsDesktopWeb } from "@/lib/layout"
import { colors } from "@/lib/theme"

const DISMISS_VELOCITY = 800
const DISMISS_DISTANCE_RATIO = 0.28

type SheetProps = {
  visible: boolean
  onDismiss: () => void
  children: React.ReactNode
  /** Fraction of screen height the sheet may grow to. Defaults to 0.88. */
  maxHeightRatio?: number
}

export function Sheet({ visible, onDismiss, children, maxHeightRatio = 0.88 }: SheetProps) {
  const isDesktop = useIsDesktopWeb()
  const screenHeight = Dimensions.get("window").height
  const translateY = useSharedValue(screenHeight)
  const scale = useSharedValue(0.94)
  const backdropOpacity = useSharedValue(0)
  const dragStartY = useSharedValue(0)
  const [rendered, setRendered] = useState(visible)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      if (isDesktop) {
        scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
      } else {
        translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) })
      }
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) })
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) })
      if (isDesktop) {
        scale.value = withTiming(
          0.94,
          { duration: 160, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(setRendered)(false)
          }
        )
      } else {
        translateY.value = withTiming(
          screenHeight,
          { duration: 220, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(setRendered)(false)
          }
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isDesktop])

  const dismiss = () => {
    backdropOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) })
    if (isDesktop) {
      scale.value = withTiming(
        0.94,
        { duration: 160, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDismiss)()
        }
      )
    } else {
      translateY.value = withTiming(
        screenHeight,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(onDismiss)()
        }
      )
    }
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      dragStartY.value = translateY.value
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, dragStartY.value + e.translationY)
    })
    .onEnd((e) => {
      const pastThreshold =
        e.velocityY > DISMISS_VELOCITY || translateY.value > screenHeight * DISMISS_DISTANCE_RATIO
      if (pastThreshold) {
        runOnJS(dismiss)()
      } else {
        translateY.value = withSpring(0, { damping: 18, stiffness: 260 })
      }
    })

  const sheetStyle = useAnimatedStyle(() =>
    isDesktop
      ? { transform: [{ scale: scale.value }] }
      : { transform: [{ translateY: translateY.value }] }
  )
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))

  if (!rendered) return null

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, isDesktop && styles.desktopWrap]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[
            isDesktop ? styles.desktopCard : styles.sheet,
            { maxHeight: screenHeight * maxHeightRatio },
            sheetStyle,
          ]}
        >
          {!isDesktop && (
            <GestureDetector gesture={pan}>
              <View style={styles.handleGrabArea}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
          )}
          <View style={isDesktop ? styles.desktopBody : styles.body}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(22, 35, 27, 0.4)",
  },
  sheet: {
    marginTop: "auto",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    boxShadow: "0 -8px 30px rgba(22, 35, 27, 0.18)",
  },
  handleGrabArea: {
    width: "100%",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  desktopWrap: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  desktopCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    backgroundColor: colors.surface,
    boxShadow: "0 24px 60px rgba(22, 35, 27, 0.28)",
  },
  desktopBody: {
    padding: 26,
  },
})
