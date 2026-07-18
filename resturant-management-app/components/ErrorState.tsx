/** Icon + message + optional retry action, for a failed data fetch. */
import { Ionicons } from "@expo/vector-icons"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { colors, radii } from "@/lib/theme"

type ErrorStateProps = {
  message: string
  hint?: string
  onRetry?: () => void
}

export function ErrorState({ message, hint, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
      </View>
      <Text style={styles.message}>{message}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {onRetry && (
        <AnimatedPressable style={styles.retryButton} onPress={onRetry} scaleTo={0.95}>
          <Text style={styles.retryLabel}>Try again</Text>
        </AnimatedPressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 48,
    height: 48,
    marginBottom: 10,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBE7E5",
  },
  message: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: colors.error,
    textAlign: "center",
  },
  hint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 40,
    marginTop: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
})
