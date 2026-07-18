/**
 * Rounded surface container using the shared radius/tone scale — replaces the ad hoc
 * `styles.card` block each screen used to define for itself.
 */
import type { ReactNode } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import { colors, radii } from "@/lib/theme"

type Tone = "surface" | "warm" | "sage" | "primary"

type AppCardProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  radius?: keyof typeof radii
  tone?: Tone
  padding?: number
  /** One subtle elevation for normal cards, one stronger one for floating/modal-like cards. */
  elevated?: boolean
  bordered?: boolean
}

const TONE_BACKGROUND: Record<Tone, string> = {
  surface: colors.surface,
  warm: colors.surfaceWarm,
  sage: colors.softSage,
  primary: colors.primary,
}

export function AppCard({
  children,
  style,
  radius = "lg",
  tone = "surface",
  padding = 16,
  elevated = false,
  bordered = true,
}: AppCardProps) {
  return (
    <View
      style={[
        {
          borderRadius: radii[radius],
          backgroundColor: TONE_BACKGROUND[tone],
          padding,
        },
        bordered && tone !== "primary" && styles.border,
        elevated ? styles.elevatedShadow : styles.subtleShadow,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  border: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  subtleShadow: {
    boxShadow: "0 1px 3px rgba(31, 41, 35, 0.06)",
  },
  elevatedShadow: {
    boxShadow: "0 14px 36px rgba(20, 38, 28, 0.16)",
  },
})
