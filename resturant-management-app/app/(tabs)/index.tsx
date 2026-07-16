/**
 * Home tab — today's shift, inventory attention, quick actions, and priority tasks.
 * All data continues to come from the existing Supabase-backed hooks.
 */
import { MisoChatModal } from "@/components/miso-chat-modal"
import { notify } from "@/lib/alert"
import { useInventoryLog } from "@/lib/hooks/useInventoryLog"
import { useManagementLog } from "@/lib/hooks/useManagementLog"
import { useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { useShifts } from "@/lib/hooks/useShifts"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { Task, useTasks } from "@/lib/hooks/useTasks"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Checkbox, Text } from "react-native-paper"

function formatHeaderDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

function formatDue(iso: string | null) {
  if (!iso) return null

  const due = new Date(iso)
  const time = due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const isToday = due.toDateString() === new Date().toDateString()

  if (isToday) return `Due ${time}`

  const date = due.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `Due ${date}, ${time}`
}

function formatShiftTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/** Time-of-day greeting for the header line. */
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function HomeScreen() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { data: managementLog, loading: mgmtLoading, error: mgmtError } = useManagementLog()
  const { data: inventoryLog, loading: invLoading, error: invError } = useInventoryLog()
  const { data: tasks, update: updateTask } = useTasks()
  const { data: shifts } = useShifts()
  const { data: members } = useRestaurantMembers()
  const [userId, setUserId] = useState<string | null>(null)
  const [chatVisible, setChatVisible] = useState(false)
  const loading = mgmtLoading || invLoading
  const error = mgmtError ?? invError

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Same rule as Profile help text: flag inventory below 10 units.
  const lowStockCount = inventoryLog.filter((item) => item.stock_quantity < 10).length
  const currentMember = members.find((member) => member.user_id === userId)
  const firstName = currentMember?.display_name?.trim().split(/\s+/)[0]

  const todayYMD = new Date().toDateString()
  const todaysShift = shifts.find(
    (shift) => shift.user_id === userId && new Date(shift.starts_at).toDateString() === todayYMD
  )

  const myPriorityTasks = tasks
    .filter((task) => task.status === "pending" && task.assigned_to === userId)
    .sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
    .slice(0, 3)

  async function toggleTaskComplete(task: Task) {
    try {
      await updateTask(task.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userId,
      })
    } catch (err) {
      notify("Error", getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Ionicons name="restaurant" size={44} color={colors.primary} style={styles.loadingIcon} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            {currentMember?.avatar_url ? (
              <Image
                source={{ uri: currentMember.avatar_url }}
                style={styles.avatarImage}
                contentFit="cover"
                accessibilityLabel={currentMember.display_name ?? "Profile photo"}
              />
            ) : (
              <Ionicons name="person" size={24} color={colors.primary} />
            )}
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.greeting} numberOfLines={1}>
              {getGreeting()}{firstName ? `, ${firstName}` : ""}
            </Text>
            <Text style={styles.subtitle}>{formatHeaderDate()}</Text>
          </View>

          <View
            accessible
            accessibilityLabel={
              lowStockCount > 0
                ? `${lowStockCount} inventory items need attention`
                : "No inventory alerts"
            }
            style={styles.notificationIcon}
          >
            <Ionicons name="notifications-outline" size={25} color={colors.textPrimary} />
            {lowStockCount > 0 && <View style={styles.notificationDot} />}
          </View>
        </View>

        <View style={styles.shiftCard}>
          <View style={styles.shiftCopy}>
            <Text style={styles.shiftCardLabel}>Today&apos;s shift</Text>
            {todaysShift ? (
              <>
                <Text style={styles.shiftCardTime}>
                  {formatShiftTime(todaysShift.starts_at)} – {formatShiftTime(todaysShift.ends_at)}
                </Text>
                <View style={styles.shiftCardRoleBadge}>
                  <Text style={styles.shiftCardRoleText} numberOfLines={1}>
                    {todaysShift.label || "Scheduled shift"}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.shiftCardEmptyTitle}>No shift scheduled</Text>
                <Text style={styles.shiftCardEmptyText}>You have no assigned shift today.</Text>
              </>
            )}
          </View>
          <Image
            source={mascotImages.home}
            style={styles.shiftMascot}
            contentFit="contain"
            accessibilityLabel="Miso the chef mascot"
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            lowStockCount > 0
              ? `Review ${lowStockCount} low-stock inventory items`
              : "View inventory"
          }
          onPress={() => router.push("/(tabs)/inventory-log")}
          style={({ pressed }) => [
            styles.attentionBanner,
            lowStockCount === 0 && styles.attentionBannerClear,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.attentionIcon, lowStockCount === 0 && styles.attentionIconClear]}>
            <Ionicons
              name={lowStockCount > 0 ? "warning" : "checkmark"}
              size={19}
              color={lowStockCount > 0 ? "#FFFFFF" : colors.primary}
            />
          </View>
          <Text style={styles.attentionText} numberOfLines={1}>
            {lowStockCount > 0
              ? `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} need attention`
              : "Inventory is fully stocked"}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.quickActionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/inventory-log")}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="cube-outline" size={27} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Stock count</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/management-log")}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="clipboard-outline" size={27} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Add log</Text>
            </Pressable>
          </View>
          <View style={styles.quickActionsRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/(tabs)/finance")}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
            >
              <View style={styles.quickActionIconWrap}>
                <Ionicons name="receipt-outline" size={27} color={colors.primary} />
              </View>
              <Text style={styles.quickActionLabel}>Record expense</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setChatVisible(true)}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
            >
              <View style={[styles.quickActionIconWrap, styles.misoIconWrap]}>
                <Ionicons name="chatbubble-ellipses-outline" size={27} color="#FFFFFF" />
              </View>
              <Text style={styles.quickActionLabel}>Ask Miso</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Priority tasks</Text>
            <Pressable onPress={() => router.push("/(tabs)/tasks")} hitSlop={8}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>

          {myPriorityTasks.length === 0 ? (
            <Pressable
              onPress={() => router.push("/(tabs)/tasks")}
              style={({ pressed }) => [styles.emptyTaskCard, pressed && styles.pressed]}
            >
              <View style={styles.emptyTaskIcon}>
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              </View>
              <Text style={styles.emptyTaskText}>No tasks assigned to you right now</Text>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </Pressable>
          ) : (
            myPriorityTasks.map((task) => {
              const due = formatDue(task.due_at)

              return (
                <View key={task.id} style={styles.taskCard}>
                  <Checkbox
                    status="unchecked"
                    onPress={() => toggleTaskComplete(task)}
                    color={colors.primary}
                    uncheckedColor={colors.textMuted}
                  />
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.taskPressArea, pressed && styles.taskPressed]}
                    onPress={() => router.push("/(tabs)/tasks")}
                  >
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {due ? (
                      <View style={styles.taskDuePill}>
                        <Text style={styles.taskDueText} numberOfLines={1}>
                          {due}
                        </Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    )}
                  </Pressable>
                </View>
              )
            })
          )}
        </View>
      </ScrollView>

      <MisoChatModal
        visible={chatVisible}
        onDismiss={() => setChatVisible(false)}
        managementLog={managementLog}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    gap: 18,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingIcon: {
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    right: 6,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.background,
  },
  shiftCard: {
    minHeight: 166,
    overflow: "hidden",
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
  },
  shiftCopy: {
    width: "72%",
    zIndex: 1,
  },
  shiftCardLabel: {
    fontSize: 21,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  shiftCardTime: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  shiftCardRoleBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginTop: 14,
  },
  shiftCardRoleText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  shiftCardEmptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 3,
  },
  shiftCardEmptyText: {
    maxWidth: 190,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
  },
  shiftMascot: {
    position: "absolute",
    width: 132,
    height: 164,
    right: -10,
    bottom: -28,
  },
  attentionBanner: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.statLogsBg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  attentionBannerClear: {
    backgroundColor: colors.surfaceWarm,
    borderColor: colors.statStockBorder,
  },
  attentionIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.warning,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionIconClear: {
    backgroundColor: colors.surface,
  },
  attentionText: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  quickActionsSection: {
    gap: 10,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 2px rgba(31, 55, 40, 0.07)",
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  misoIconWrap: {
    backgroundColor: colors.primary,
    borderRadius: 21,
  },
  quickActionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  taskCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 5,
    paddingRight: 10,
    boxShadow: "0 1px 2px rgba(31, 55, 40, 0.06)",
  },
  taskPressArea: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingLeft: 2,
  },
  taskPressed: {
    opacity: 0.6,
  },
  taskTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  taskDuePill: {
    maxWidth: 126,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.statLogsBg,
    borderWidth: 1,
    borderColor: colors.management,
  },
  taskDueText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.managementDark,
    fontVariant: ["tabular-nums"],
  },
  emptyTaskCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTaskIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  emptyTaskText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
})
