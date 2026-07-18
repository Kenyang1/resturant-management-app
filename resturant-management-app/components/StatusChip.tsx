/** Semantic status pill: Low (amber) / Out (critical red) / Good (pale green) / Pending / Complete. */
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, Text, View } from "react-native"
import { colors, radii } from "@/lib/theme"

export type Status = "low" | "out" | "good" | "pending" | "complete"

type StatusChipProps = {
  status: Status
  /** Overrides the default label ("Low", "Out", "Good", "Pending", "Complete"). */
  label?: string
}

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  low: { label: "Low", bg: "#FDF0D9", text: "#9A6B0F" },
  out: { label: "Out", bg: "#FBE7E5", text: colors.errorDark },
  good: { label: "Good", bg: colors.softSage, text: colors.primaryDark },
  pending: { label: "Pending", bg: colors.surfaceWarm, text: colors.managementDark },
  complete: { label: "Complete", bg: colors.softSage, text: colors.primaryDark, icon: "checkmark" },
}

export function StatusChip({ status, label }: StatusChipProps) {
  const config = STATUS_CONFIG[status]
  return (
    <View style={[styles.chip, { backgroundColor: config.bg }]}>
      {config.icon && <Ionicons name={config.icon} size={12} color={config.text} />}
      <Text style={[styles.text, { color: config.text }]} numberOfLines={1}>
        {label ?? config.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  text: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
})
