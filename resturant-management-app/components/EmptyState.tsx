/** Icon-or-mascot + title + subtext + optional call-to-action, for empty lists/sections. */
import type { ImageSourcePropType } from "react-native"
import { Image } from "expo-image"
import type { ReactNode } from "react"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type EmptyStateProps = {
  /** A rendered icon element (any icon family), shown inside the standard round tile. */
  icon?: ReactNode
  /** A mascot illustration takes priority over `icon` when both are given. */
  image?: ImageSourcePropType
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon, image, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {image ? (
        <Image source={image} style={styles.image} contentFit="contain" accessibilityIgnoresInvertColors />
      ) : icon ? (
        <View style={styles.iconWrap}>{icon}</View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction && (
        <AnimatedPressable style={styles.actionButton} onPress={onAction} scaleTo={0.95}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </AnimatedPressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  image: {
    width: 120,
    height: 96,
    marginBottom: 10,
  },
  iconWrap: {
    width: 50,
    height: 50,
    marginBottom: 12,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  title: {
    fontSize: 17,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
    textAlign: "center",
  },
  actionButton: {
    minHeight: 40,
    marginTop: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
  },
})
