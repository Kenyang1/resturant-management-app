/**
 * The "Ask Miso" / contextual-help card: mascot illustration + text + button. Used on
 * Home/Tasks/Logs/Finance per the illustration pack's mapping — at most one prominent
 * illustration per screen (see assets/images/miso/README.md).
 */
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import type { ImageSourcePropType } from "react-native"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type MisoCalloutProps = {
  image: ImageSourcePropType
  title: string
  subtitle?: string
  /** Omit both to render a static, non-actionable informational card (e.g. a "good" state). */
  actionLabel?: string
  actionIcon?: keyof typeof Ionicons.glyphMap
  onPress?: () => void
  tone?: "sage" | "warm"
}

export function MisoCallout({
  image,
  title,
  subtitle,
  actionLabel,
  actionIcon = "chatbubble-ellipses",
  onPress,
  tone = "sage",
}: MisoCalloutProps) {
  const body = (
    <>
      <Image source={image} style={styles.image} contentFit="contain" accessibilityIgnoresInvertColors />
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {actionLabel && onPress && (
          <View style={styles.actionRow}>
            <Ionicons name={actionIcon} size={15} color="#FFFFFF" />
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </View>
        )}
      </View>
    </>
  )

  if (onPress) {
    return (
      <AnimatedPressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.card, tone === "warm" && styles.cardWarm]}
        scaleTo={0.98}
      >
        {body}
      </AnimatedPressable>
    )
  }

  return <View style={[styles.card, tone === "warm" && styles.cardWarm]}>{body}</View>
}

const styles = StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.softSage,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
  },
  cardWarm: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.statStockBorder,
  },
  image: {
    width: 76,
    height: 88,
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  actionRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
  },
})
