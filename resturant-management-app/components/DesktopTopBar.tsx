/**
 * Persistent top bar for the desktop-web shell: current section title + a real notification
 * bell (low-stock + overdue-task count, the same "needs attention" signal Home's right rail
 * shows) that jumps to Home where that detail lives.
 */
import { useEffect, useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { router, usePathname } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { useInventoryLog } from "@/lib/hooks/useInventoryLog"
import { useTasks } from "@/lib/hooks/useTasks"
import { supabase } from "@/lib/supabase"
import { colors, radii } from "@/lib/theme"

const SECTION_TITLES: { match: (pathname: string) => boolean; title: string }[] = [
  { match: (p) => p === "/" || p === "/index", title: "Dashboard" },
  { match: (p) => p.startsWith("/inventory-log"), title: "Inventory" },
  { match: (p) => p.startsWith("/tasks"), title: "Shift tasks" },
  { match: (p) => p.startsWith("/finance"), title: "Finance" },
  { match: (p) => p.startsWith("/management-log"), title: "Management logs" },
  { match: (p) => p.startsWith("/profile"), title: "More" },
]

export function DesktopTopBar() {
  const pathname = usePathname()
  const { data: inventoryLog } = useInventoryLog()
  const { data: tasks } = useTasks()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const title = SECTION_TITLES.find((s) => s.match(pathname))?.title ?? "Dashboard"
  const lowStockCount = inventoryLog.filter((item) => item.stock_quantity < 10).length
  const overdueTaskCount = tasks.filter(
    (t) => t.status === "pending" && t.assigned_to === userId && t.due_at && new Date(t.due_at) < new Date()
  ).length
  const attentionCount = lowStockCount + overdueTaskCount

  return (
    <View style={styles.bar}>
      <Text style={styles.title}>{title}</Text>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel={
          attentionCount > 0 ? `${attentionCount} items need attention` : "No alerts"
        }
        onPress={() => router.push("/(tabs)")}
        style={styles.bellButton}
        scaleTo={0.92}
      >
        <Ionicons name="notifications-outline" size={21} color={colors.textPrimary} />
        {attentionCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{attentionCount > 9 ? "9+" : attentionCount}</Text>
          </View>
        )}
      </AnimatedPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  bellButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.apricotEmphasis,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
  },
})
