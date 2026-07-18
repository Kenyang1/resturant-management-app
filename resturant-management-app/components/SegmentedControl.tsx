/**
 * Pill-group filter control — replaces the three near-duplicate implementations that used
 * to live directly inside finance.tsx / tasks.tsx / inventory-log.tsx.
 */
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type Option<T extends string> = {
  value: T
  label: string
}

type SegmentedControlProps<T extends string> = {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  /** Active-pill fill color. Defaults to the app's primary green. */
  activeColor?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  activeColor = colors.primary,
}: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" style={styles.row}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <AnimatedPressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.pill,
              selected && { backgroundColor: activeColor, borderColor: activeColor },
            ]}
            scaleTo={0.96}
          >
            <Text style={[styles.label, selected && styles.labelActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </AnimatedPressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textSecondary,
  },
  labelActive: {
    color: "#FFFFFF",
  },
})
