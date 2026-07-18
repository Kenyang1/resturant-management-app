/**
 * Pressable with animated tactile feedback: eases into the pressed state (ease-out, since the
 * surface is reacting to an already-moving finger) and springs back on release (spring, not a
 * fixed-duration timing, because a quick re-tap can interrupt the release mid-flight).
 */
import { forwardRef } from "react"
import { Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable)
const isWeb = Platform.OS === "web"
// `cursor` is a react-native-web-only style extension, not in the shared RN ViewStyle type.
const webCursorStyle = isWeb ? ({ cursor: "pointer" } as ViewStyle) : undefined

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
  /** Scale at full press depth. Defaults to a subtle native-feeling depress. */
  scaleTo?: number
}

export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, AnimatedPressableProps>(
  function AnimatedPressable(
    { style, scaleTo = 0.97, onPressIn, onPressOut, onHoverIn, onHoverOut, ...rest },
    ref
  ) {
    const depth = useSharedValue(0)
    const hovered = useSharedValue(0)

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 - depth.value * (1 - scaleTo) }],
      opacity: 1 - depth.value * 0.18 - hovered.value * 0.06,
    }))

    return (
      <ReanimatedPressable
        ref={ref}
        onPressIn={(e) => {
          depth.value = withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) })
          onPressIn?.(e)
        }}
        onPressOut={(e) => {
          depth.value = withSpring(0, { damping: 14, stiffness: 260 })
          onPressOut?.(e)
        }}
        onHoverIn={(e) => {
          if (isWeb) hovered.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) })
          onHoverIn?.(e)
        }}
        onHoverOut={(e) => {
          if (isWeb) hovered.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) })
          onHoverOut?.(e)
        }}
        style={[style, webCursorStyle, animatedStyle]}
        {...rest}
      />
    )
  }
)
