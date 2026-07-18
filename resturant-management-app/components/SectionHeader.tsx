/** Section title + optional count pill + optional "View all" link, used above list sections. */
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors } from "@/lib/theme"

type SectionHeaderProps = {
  title: string
  count?: number
  onViewAll?: () => void
}

export function SectionHeader({ title, count, onViewAll }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {count != null && (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        )}
      </View>
      {onViewAll && (
        <AnimatedPressable onPress={onViewAll} hitSlop={8} scaleTo={0.95}>
          <Text style={styles.viewAll}>View all</Text>
        </AnimatedPressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  titleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  countPill: {
    minWidth: 24,
    minHeight: 22,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.softSage,
  },
  countText: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
  viewAll: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
  },
})
