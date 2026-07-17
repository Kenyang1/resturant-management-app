/**
 * Pressable with animated tactile feedback: eases into the pressed state (ease-out, since the
 * surface is reacting to an already-moving finger) and springs back on release (spring, not a
 * fixed-duration timing, because a quick re-tap can interrupt the release mid-flight).
 */
import { forwardRef } from "react"
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

const ReanimatedPressable = Animated.createAnimatedComponent(Pressable)

type AnimatedPressableProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>
  /** Scale at full press depth. Defaults to a subtle native-feeling depress. */
  scaleTo?: number
}

export const AnimatedPressable = forwardRef<React.ElementRef<typeof Pressable>, AnimatedPressableProps>(
  function AnimatedPressable({ style, scaleTo = 0.97, onPressIn, onPressOut, ...rest }, ref) {
    const depth = useSharedValue(0)

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: 1 - depth.value * (1 - scaleTo) }],
      opacity: 1 - depth.value * 0.18,
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
        style={[style, animatedStyle]}
        {...rest}
      />
    )
  }
)
