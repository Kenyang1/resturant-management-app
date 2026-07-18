/** The big pill CTA button pattern ("Add item", "Add log", "Add transaction", ...). */
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, Text } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type PrimaryActionProps = {
  label: string
  icon?: keyof typeof Ionicons.glyphMap
  onPress: () => void
  /** "solid" fills the available width; "compact" sizes to its label (e.g. a small header button). */
  variant?: "solid" | "compact"
  disabled?: boolean
}

export function PrimaryAction({
  label,
  icon = "add",
  onPress,
  variant = "solid",
  disabled,
}: PrimaryActionProps) {
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === "solid" && styles.solid,
        disabled && styles.disabled,
      ]}
      scaleTo={0.97}
    >
      <Ionicons name={icon} size={20} color="#FFFFFF" />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    boxShadow: "0 6px 16px rgba(24, 92, 60, 0.22)",
  },
  solid: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
  },
})
