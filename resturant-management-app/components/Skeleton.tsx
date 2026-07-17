/**
 * Shape-matching loading placeholder: a gentle opacity pulse (loop, ease-in-out) rather than a
 * centered spinner, so loading screens read as "your content is arriving" instead of "wait".
 */
import { useEffect } from "react"
import { AccessibilityInfo, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"
import { colors } from "@/lib/theme"

type SkeletonProps = {
  style?: StyleProp<ViewStyle>
}

export function Skeleton({ style }: SkeletonProps) {
  const opacity = useSharedValue(0.55)

  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (cancelled || reduced) return
      opacity.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true
      )
    })
    return () => {
      cancelled = true
      cancelAnimation(opacity)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[{ backgroundColor: colors.surfaceWarm, borderRadius: 14 }, style, animatedStyle]}
    />
  )
}
