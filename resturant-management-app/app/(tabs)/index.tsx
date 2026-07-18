/**
 * Home tab — today's shift, inventory attention, quick actions, and priority tasks.
 * All data continues to come from the existing Supabase-backed hooks.
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { MisoCallout } from "@/components/MisoCallout"
import { MisoChatModal } from "@/components/miso-chat-modal"
import { ProgressRing } from "@/components/ProgressRing"
import { Skeleton } from "@/components/Skeleton"
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
import { colors, radii } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Checkbox, Text } from "react-native-paper"

function formatDate(isoString: string | null) {
  if (!isoString) return ""
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

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
  const { horizontal, scrollBottomPad, desktopFrameStyle, isDesktop } = useMobileLayout()
  // Home's desktop layout needs a wider, row-flex frame (main column + right rail) than the
  // shared single-column content frame other screens use.
  const homeFrameStyle = isDesktop
    ? ({
        flex: 1,
        width: "100%",
        maxWidth: 1200,
        alignSelf: "center",
        flexDirection: "row",
        gap: 24,
      } as const)
    : desktopFrameStyle
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

  const now = new Date()
  const todayYMD = now.toDateString()
  const todaysShift = shifts.find(
    (shift) => shift.user_id === userId && new Date(shift.starts_at).toDateString() === todayYMD
  )
  const nextShift = shifts
    .filter((shift) => shift.user_id === userId && new Date(shift.starts_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]

  const myTasks = tasks.filter((task) => task.assigned_to === userId)
  const myPriorityTasks = myTasks
    .filter((task) => task.status === "pending")
    .sort((a, b) => {
      if (!a.due_at && !b.due_at) return 0
      if (!a.due_at) return 1
      if (!b.due_at) return -1
      return a.due_at.localeCompare(b.due_at)
    })
    .slice(0, 3)
  const overdueTaskCount = myTasks.filter(
    (task) => task.status === "pending" && task.due_at && new Date(task.due_at) < now
  ).length
  const myCompletedCount = myTasks.filter((task) => task.status === "completed").length
  const taskProgress = myTasks.length > 0 ? myCompletedCount / myTasks.length : 0

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
      <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
        <View style={desktopFrameStyle}>
          <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
            <View style={styles.header}>
              <Skeleton style={styles.avatarButton} />
              <View style={styles.headerCopy}>
                <Skeleton style={styles.skeletonLine} />
              </View>
            </View>
            <Skeleton style={styles.shiftCard} />
            <View style={styles.quickActionsRow}>
              <Skeleton style={styles.quickActionCard} />
              <Skeleton style={styles.quickActionCard} />
            </View>
            <Skeleton style={styles.taskCard} />
            <Skeleton style={styles.taskCard} />
          </View>
        </View>
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

  const attentionBanner = (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={
        lowStockCount > 0 ? `Review ${lowStockCount} low-stock inventory items` : "View inventory"
      }
      onPress={() => router.push("/(tabs)/inventory-log")}
      style={[styles.attentionBanner, lowStockCount === 0 && styles.attentionBannerClear]}
      scaleTo={0.98}
    >
      <View style={[styles.attentionIcon, lowStockCount === 0 && styles.attentionIconClear]}>
        <Ionicons
          name={lowStockCount > 0 ? "warning" : "checkmark"}
          size={19}
          color={lowStockCount > 0 ? "#3D2B05" : colors.primary}
        />
      </View>
      <Text style={styles.attentionText} numberOfLines={1}>
        {lowStockCount > 0
          ? `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} need attention`
          : "Inventory is fully stocked"}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={lowStockCount > 0 ? "#3D2B05" : colors.textPrimary}
      />
    </AnimatedPressable>
  )

  const quickActions = (
    <View style={styles.quickActionsSection}>
      <Text style={styles.sectionTitle}>Quick actions</Text>
      <View style={[styles.quickActionsGrid, isDesktop && styles.quickActionsGridDesktop]}>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/inventory-log")}
          style={[styles.quickActionCard, isDesktop && styles.quickActionCardDesktop]}
          scaleTo={0.97}
        >
          <View style={styles.quickActionIconWrap}>
            <Ionicons name="cube-outline" size={27} color={colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Stock count</Text>
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/management-log")}
          style={[styles.quickActionCard, isDesktop && styles.quickActionCardDesktop]}
          scaleTo={0.97}
        >
          <View style={styles.quickActionIconWrap}>
            <Ionicons name="clipboard-outline" size={27} color={colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Add log</Text>
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => router.push("/(tabs)/finance")}
          style={[styles.quickActionCard, isDesktop && styles.quickActionCardDesktop]}
          scaleTo={0.97}
        >
          <View style={styles.quickActionIconWrap}>
            <Ionicons name="receipt-outline" size={27} color={colors.primary} />
          </View>
          <Text style={styles.quickActionLabel}>Record expense</Text>
        </AnimatedPressable>
        <AnimatedPressable
          accessibilityRole="button"
          onPress={() => setChatVisible(true)}
          style={[styles.quickActionCard, isDesktop && styles.quickActionCardDesktop]}
          scaleTo={0.97}
        >
          <View style={[styles.quickActionIconWrap, styles.misoIconWrap]}>
            <Ionicons name="chatbubble-ellipses-outline" size={27} color="#FFFFFF" />
          </View>
          <Text style={styles.quickActionLabel}>Ask Miso</Text>
        </AnimatedPressable>
      </View>
    </View>
  )

  const priorityTasksSection = (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Priority tasks</Text>
        <Pressable onPress={() => router.push("/(tabs)/tasks")} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {myPriorityTasks.length === 0 ? (
        <AnimatedPressable
          onPress={() => router.push("/(tabs)/tasks")}
          style={styles.emptyTaskCard}
          scaleTo={0.98}
        >
          <View style={styles.emptyTaskIcon}>
            <Ionicons name="checkmark" size={18} color={colors.primary} />
          </View>
          <Text style={styles.emptyTaskText}>No tasks assigned to you right now</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
        </AnimatedPressable>
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
              <AnimatedPressable
                accessibilityRole="button"
                style={styles.taskPressArea}
                scaleTo={0.98}
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
              </AnimatedPressable>
            </View>
          )
        })
      )}
    </View>
  )

  const recentActivitySection = (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>At a glance</Text>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statLogs]}>
            <Text style={styles.statValue}>{managementLog.length}</Text>
            <Text style={styles.statLabel}>Logs</Text>
          </View>
          <View style={[styles.statCard, styles.statItems]}>
            <Text style={styles.statValue}>{inventoryLog.length}</Text>
            <Text style={styles.statLabel}>Items</Text>
          </View>
          <View style={[styles.statCard, lowStockCount > 0 ? styles.statWarning : styles.statStock]}>
            <Text style={[styles.statValue, lowStockCount > 0 && styles.statValueWarning]}>
              {lowStockCount}
            </Text>
            <Text style={styles.statLabel}>Low stock</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent management logs</Text>
          <Pressable onPress={() => router.push("/(tabs)/management-log")} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {managementLog.length === 0 ? (
          <View style={styles.emptyActivityCard}>
            <Ionicons name="document-text-outline" size={22} color={colors.textMuted} />
            <Text style={styles.emptyActivityText}>No management logs yet</Text>
          </View>
        ) : (
          managementLog.slice(0, 3).map((item) => (
            <AnimatedPressable
              key={item.id}
              onPress={() => router.push("/(tabs)/management-log")}
              style={styles.activityCard}
              scaleTo={0.98}
            >
              <View style={styles.activityIcon}>
                <Ionicons name="document-text-outline" size={20} color={colors.management} />
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.activityDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.created_at && (
                  <Text style={styles.activityMeta}>{formatDate(item.created_at)}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent inventory</Text>
          <Pressable onPress={() => router.push("/(tabs)/inventory-log")} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {inventoryLog.length === 0 ? (
          <View style={styles.emptyActivityCard}>
            <Ionicons name="cube-outline" size={22} color={colors.textMuted} />
            <Text style={styles.emptyActivityText}>No inventory items yet</Text>
          </View>
        ) : (
          inventoryLog.slice(0, 3).map((item) => (
            <AnimatedPressable
              key={item.id}
              onPress={() => router.push("/(tabs)/inventory-log")}
              style={styles.activityCard}
              scaleTo={0.98}
            >
              <View style={[styles.activityIcon, styles.inventoryActivityIcon]}>
                <Ionicons name="cube-outline" size={20} color={colors.inventory} />
              </View>
              <View style={styles.activityCopy}>
                <Text style={styles.activityTitle} numberOfLines={1}>
                  {item.item_name}
                </Text>
                <Text style={styles.activityDescription} numberOfLines={1}>
                  {item.stock_quantity} in stock • {item.storage_location}
                </Text>
                <Text style={styles.activityMeta}>${item.cost_per_unit.toFixed(2)} per unit</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </AnimatedPressable>
          ))
        )}
      </View>
    </>
  )

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <View style={homeFrameStyle}>
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
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.avatarButton}
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
            </AnimatedPressable>

            <View style={styles.headerCopy}>
              <Text style={styles.greeting} numberOfLines={1}>
                {getGreeting()}
                {firstName ? `, ${firstName}` : ""}
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
              source={mascotImages.shiftReady}
              style={styles.shiftMascot}
              contentFit="contain"
              accessibilityLabel="Miso the chef mascot, ready for the shift"
            />
          </View>

          {attentionBanner}
          {quickActions}

          {isDesktop ? (
            <View style={styles.desktopSplit}>
              <View style={styles.desktopMainCol}>{priorityTasksSection}</View>
              <View style={styles.desktopMainCol}>{recentActivitySection}</View>
            </View>
          ) : (
            <>
              {priorityTasksSection}
              {recentActivitySection}
            </>
          )}
        </ScrollView>

        {isDesktop && (
          <View style={styles.rightRail}>
            <View style={styles.railCard}>
              <Text style={styles.railTitle}>Needs attention</Text>
              <View style={styles.railDivider} />
              <AnimatedPressable
                style={styles.railRow}
                onPress={() => router.push("/(tabs)/inventory-log")}
                scaleTo={0.98}
              >
                <View style={styles.railRowIcon}>
                  <Ionicons name="alert" size={16} color={colors.apricotEmphasis} />
                </View>
                <View style={styles.railRowCopy}>
                  <Text style={styles.railRowTitle}>
                    {lowStockCount} low-stock item{lowStockCount === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.railRowSubtitle}>Restock soon</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
              <AnimatedPressable
                style={styles.railRow}
                onPress={() => router.push("/(tabs)/tasks")}
                scaleTo={0.98}
              >
                <View style={styles.railRowIcon}>
                  <Ionicons name="alert" size={16} color={colors.apricotEmphasis} />
                </View>
                <View style={styles.railRowCopy}>
                  <Text style={styles.railRowTitle}>
                    {overdueTaskCount} overdue task{overdueTaskCount === 1 ? "" : "s"}
                  </Text>
                  <Text style={styles.railRowSubtitle}>Require action</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </AnimatedPressable>
            </View>

            <View style={styles.railCard}>
              <Text style={styles.railTitle}>Today&apos;s progress</Text>
              <View style={styles.ringWrap}>
                <ProgressRing
                  progress={taskProgress}
                  label={`${myCompletedCount} of ${myTasks.length}`}
                  caption={`${Math.round(taskProgress * 100)}% completed`}
                />
              </View>
            </View>

            <View style={styles.railCard}>
              <Text style={styles.railTitle}>Next shift</Text>
              <View style={styles.nextShiftRow}>
                <View style={styles.railRowIcon}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                </View>
                <View style={styles.railRowCopy}>
                  <Text style={styles.railRowTitle}>
                    {nextShift ? formatShiftTime(nextShift.starts_at) : "Nothing scheduled"}
                  </Text>
                  <Text style={styles.railRowSubtitle}>
                    {nextShift ? nextShift.label || "Scheduled shift" : "Check back later"}
                  </Text>
                </View>
              </View>
            </View>

            <MisoCallout
              image={mascotImages.ask}
              title="Ask Miso"
              subtitle="Need something? I'm here to help!"
              actionLabel="Chat with Miso"
              onPress={() => setChatVisible(true)}
            />
          </View>
        )}
      </View>

      <MisoChatModal visible={chatVisible} onDismiss={() => setChatVisible(false)} />
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
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 24,
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
  skeletonLine: {
    height: 21,
    borderRadius: 6,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
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
    borderRadius: radii.xl,
    padding: 20,
  },
  shiftCopy: {
    width: "72%",
    zIndex: 1,
  },
  shiftCardLabel: {
    fontSize: 21,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  shiftCardTime: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  shiftCardRoleBadge: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: radii.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginTop: 14,
  },
  shiftCardRoleText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
  },
  shiftCardEmptyTitle: {
    fontSize: 20,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
    marginTop: 3,
  },
  shiftCardEmptyText: {
    maxWidth: 190,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Nunito_600SemiBold",
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
  },
  shiftMascot: {
    position: "absolute",
    width: 148,
    height: 180,
    right: -14,
    bottom: -28,
  },
  attentionBanner: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.warning,
  },
  attentionBannerClear: {
    backgroundColor: colors.softSage,
  },
  attentionIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: "rgba(61, 43, 5, 0.16)",
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
    fontFamily: "Nunito_800ExtraBold",
    color: "#3D2B05",
  },
  quickActionsSection: {
    gap: 10,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickActionsGridDesktop: {
    flexWrap: "nowrap",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    flexBasis: "47%",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    boxShadow: "0 1px 3px rgba(31, 55, 40, 0.07)",
  },
  quickActionCardDesktop: {
    flexBasis: 0,
  },
  quickActionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
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
    fontFamily: "Nunito_700Bold",
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
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
  },
  desktopSplit: {
    flexDirection: "row",
    gap: 20,
  },
  desktopMainCol: {
    flex: 1,
    minWidth: 0,
    gap: 18,
  },
  taskCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
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
  taskTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  taskDuePill: {
    maxWidth: 126,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.softSage,
  },
  taskDueText: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
  emptyTaskCard: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
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
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    gap: 9,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 13,
    borderRadius: radii.md,
  },
  statLogs: {
    backgroundColor: colors.statLogsBg,
  },
  statItems: {
    backgroundColor: colors.statItemsBg,
  },
  statStock: {
    backgroundColor: colors.statStockBg,
  },
  statWarning: {
    backgroundColor: "#FBEAD1",
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  statValueWarning: {
    color: colors.managementDark,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    boxShadow: "0 1px 2px rgba(31, 55, 40, 0.05)",
  },
  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.statLogsBg,
  },
  inventoryActivityIcon: {
    backgroundColor: colors.statItemsBg,
  },
  activityCopy: {
    flex: 1,
    minWidth: 0,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  activityDescription: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  activityMeta: {
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
    marginTop: 3,
  },
  emptyActivityCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  emptyActivityText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
  },
  rightRail: {
    width: 300,
    flexShrink: 0,
    paddingVertical: 18,
    paddingRight: 4,
    gap: 16,
  },
  railCard: {
    padding: 16,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  railTitle: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
  },
  railDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  railRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  railRowIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDF0D9",
  },
  railRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  railRowTitle: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  railRowSubtitle: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
    marginTop: 1,
  },
  ringWrap: {
    alignItems: "center",
    marginTop: 12,
  },
  nextShiftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
})
