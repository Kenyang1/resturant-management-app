/**
 * Generic list row: leading icon-tile/avatar, title/subtitle, trailing content. Used for
 * Inventory items, Finance transactions, Management-log entries, and Task rows.
 */
import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type EntityRowProps = {
  leading?: ReactNode
  title: string
  subtitle?: string
  trailing?: ReactNode
  onPress?: () => void
  numberOfLinesTitle?: number
  numberOfLinesSubtitle?: number
}

export function EntityRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  numberOfLinesTitle = 1,
  numberOfLinesSubtitle = 1,
}: EntityRowProps) {
  const content = (
    <>
      {leading}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={numberOfLinesTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={numberOfLinesSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </>
  )

  if (onPress) {
    return (
      <AnimatedPressable style={styles.row} onPress={onPress} scaleTo={0.99}>
        {content}
      </AnimatedPressable>
    )
  }

  return <View style={styles.row}>{content}</View>
}

const styles = StyleSheet.create({
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 3px rgba(31, 41, 35, 0.05)",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
})
