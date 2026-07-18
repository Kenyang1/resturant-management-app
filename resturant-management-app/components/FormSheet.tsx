/**
 * Thin wrapper over the shared `Sheet` that standardizes a form dialog's header
 * (icon + title + optional subtitle) and scroll/keyboard behavior, so every add/edit
 * form doesn't re-implement the same header markup and ScrollView props.
 */
import { Ionicons } from "@expo/vector-icons"
import type { ReactNode } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import { Sheet } from "@/components/Sheet"
import { colors, radii } from "@/lib/theme"

type FormSheetProps = {
  visible: boolean
  onDismiss: () => void
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  children: ReactNode
}

export function FormSheet({ visible, onDismiss, icon, title, subtitle, children }: FormSheetProps) {
  return (
    <Sheet visible={visible} onDismiss={onDismiss}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {icon && (
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </ScrollView>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 44,
    height: 44,
    marginBottom: 14,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  title: {
    fontSize: 21,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
})
