/**
 * Home tab — dashboard: greeting, quick links to other tabs, stats, and previews of recent logs/inventory.
 * Fetches both Supabase tables in parallel; "Low stock" counts items with stock_quantity under 10.
 */
import { MascotBanner } from "@/components/MascotBanner"
import { useInventoryLog } from "@/lib/hooks/useInventoryLog"
import { useManagementLog } from "@/lib/hooks/useManagementLog"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { Pressable, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Card, Text } from "react-native-paper"

function formatDate(isoString: string | null) {
  if (!isoString) return ""
  const date = new Date(isoString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/** Time-of-day greeting for the header line. */
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export default function HomeScreen() {
  const { horizontal, scrollBottomPad, homeMascotHeight, compact } = useMobileLayout()
  const { data: managementLog, loading: mgmtLoading, error: mgmtError } = useManagementLog()
  const { data: inventoryLog, loading: invLoading, error: invError } = useInventoryLog()
  const loading = mgmtLoading || invLoading
  const error = mgmtError ?? invError

  // Same rule as Profile help text: flag inventory below 10 units.
  const lowStockCount = inventoryLog.filter((i) => i.stock_quantity < 10).length

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Ionicons name="restaurant" size={48} color={colors.primary} style={{ marginBottom: 16 }} />
        <Text style={styles.loadingText}>Loading...</Text>
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
      <MascotBanner
        source={mascotImages.home}
        height={homeMascotHeight}
        accessibilityLabel="Chef cat mascot welcoming you to the restaurant app"
      />
      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Ionicons name="restaurant" size={20} color={colors.primary} />
          <Text style={styles.headerBadgeText}>Restaurant</Text>
        </View>
        <Text style={[styles.greeting, compact && styles.greetingCompact]}>{getGreeting()}</Text>
        <Text style={styles.subtitle}>Manage your kitchen & operations</Text>
      </View>

      <View style={styles.quickActions}>
        <View style={styles.quickActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.quickActionManagement,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push("/(tabs)/management-log")}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: "rgba(234,88,12,0.2)" }]}>
              <Ionicons name="document-text" size={26} color={colors.management} />
            </View>
            <Text style={styles.quickActionLabel}>Management</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.quickActionInventory,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push("/(tabs)/inventory-log")}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: "rgba(8,145,178,0.2)" }]}>
              <Ionicons name="albums" size={26} color={colors.inventory} />
            </View>
            <Text style={styles.quickActionLabel}>Inventory</Text>
          </Pressable>
        </View>
        <View style={[styles.quickActionsRow, styles.quickActionsRowLast]}>
          <Pressable
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.quickActionFinance,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push("/(tabs)/finance")}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: "rgba(255,176,32,0.22)" }]}>
              <Ionicons name="wallet" size={26} color={colors.finance} />
            </View>
            <Text style={styles.quickActionLabel}>Finance</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.quickActionCard,
              styles.quickActionSettings,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <View style={[styles.quickActionIconWrap, { backgroundColor: "rgba(124,58,237,0.2)" }]}>
              <Ionicons name="settings" size={26} color={colors.settings} />
            </View>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCardLogs]}>
          <Text style={styles.statValue}>{managementLog.length}</Text>
          <Text style={styles.statLabel}>Logs</Text>
        </View>
        <View style={[styles.statCard, styles.statCardItems]}>
          <Text style={styles.statValue}>{inventoryLog.length}</Text>
          <Text style={styles.statLabel}>Items</Text>
        </View>
        <View style={[styles.statCard, lowStockCount > 0 ? styles.statCardWarning : styles.statCardStock]}>
          <Text style={[styles.statValue, lowStockCount > 0 && styles.statValueWarning]}>{lowStockCount}</Text>
          <Text style={styles.statLabel}>Low Stock</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Management Logs</Text>
          <Pressable onPress={() => router.push("/(tabs)/management-log")} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {managementLog.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content style={styles.emptyCardContent}>
              <Ionicons name="document-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No management logs yet</Text>
            </Card.Content>
          </Card>
        ) : (
          managementLog.slice(0, 3).map((item) => (
            <Card
              key={item.id}
              style={styles.card}
              mode="elevated"
              onPress={() => router.push("/(tabs)/management-log")}
            >
              <Card.Content style={styles.cardContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription} numberOfLines={2}>
                  {item.description}
                </Text>
                {item.created_at && (
                  <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Inventory</Text>
          <Pressable onPress={() => router.push("/(tabs)/inventory-log")} hitSlop={8}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
        {inventoryLog.length === 0 ? (
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.emptyCardContent}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyText}>No inventory items yet</Text>
            </Card.Content>
          </Card>
        ) : (
          inventoryLog.slice(0, 3).map((item) => (
            <Card
              key={item.id}
              style={styles.card}
              mode="elevated"
              onPress={() => router.push("/(tabs)/inventory-log")}
            >
              <Card.Content style={styles.cardContent}>
                <Text style={styles.itemTitle}>{item.item_name}</Text>
                <Text style={styles.itemDescription}>
                  {item.stock_quantity} in stock • {item.storage_location}
                </Text>
                <Text style={styles.itemDate}>
                  ${item.cost_per_unit.toFixed(2)} per unit
                </Text>
              </Card.Content>
            </Card>
          ))
        )}
      </View>
    </ScrollView>
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
    paddingTop: 4,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
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
  header: {
    marginBottom: 24,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceWarm,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "rgba(88, 204, 2, 0.45)",
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  greeting: {
    fontSize: 30,
    fontWeight: "bold",
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  greetingCompact: {
    fontSize: 26,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
  },
  quickActions: {
    marginBottom: 20,
    gap: 10,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionsRowLast: {
    marginBottom: 0,
  },
  quickActionCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    elevation: 3,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
  },
  quickActionManagement: {
    borderTopWidth: 3,
    borderTopColor: colors.management,
  },
  quickActionInventory: {
    borderTopWidth: 3,
    borderTopColor: colors.inventory,
  },
  quickActionFinance: {
    borderTopWidth: 3,
    borderTopColor: colors.finance,
  },
  quickActionSettings: {
    borderTopWidth: 3,
    borderTopColor: colors.settings,
  },
  quickActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    elevation: 2,
  },
  statCardLogs: {
    backgroundColor: colors.statLogsBg,
    borderWidth: 2,
    borderColor: colors.statLogsBorder,
  },
  statCardItems: {
    backgroundColor: colors.statItemsBg,
    borderWidth: 2,
    borderColor: colors.statItemsBorder,
  },
  statCardStock: {
    backgroundColor: colors.statStockBg,
    borderWidth: 2,
    borderColor: colors.statStockBorder,
  },
  statCardWarning: {
    backgroundColor: "#FFF4D4",
    borderWidth: 2,
    borderColor: colors.lowStock,
  },
  statValue: {
    fontSize: 26,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  statValueWarning: {
    color: colors.warning,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  seeAll: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  emptyCardContent: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
})
