/**
 * Bold screen title + optional subtitle/count + optional right-side action, matching the
 * mockups' heavy black headline treatment.
 */
import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { colors } from "@/lib/theme"

type ScreenHeaderProps = {
  title: string
  subtitle?: string
  right?: ReactNode
}

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_600SemiBold",
    color: colors.primaryDark,
  },
})
