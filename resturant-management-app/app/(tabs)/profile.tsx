/**
 * Profile / Settings tab — Supabase user info, navigation shortcuts, demo toggles, support, logout.
 */
import { confirmAction, notify } from "@/lib/alert"
import { supabase } from "@/lib/supabase"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import Constants from "expo-constants"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Switch, Text } from "react-native-paper"

/** Change this to your real support inbox before shipping. */
const SUPPORT_EMAIL = "support@example.com"

/** Light haptic on iOS when jumping to another tab via menu rows (no-op on Android/web). */
function triggerNavHaptic() {
  if (Platform.OS === "ios") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
}

export default function Profile() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [demoNotifications, setDemoNotifications] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)

  useEffect(() => {
    // Email is read once on mount; add onAuthStateChange if you need live updates after login elsewhere.
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  const initial = userEmail?.trim()?.charAt(0)?.toUpperCase() ?? "?"

  async function performLogout() {
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.replace("/login")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not sign out. Try again."
      notify("Sign out failed", message)
    } finally {
      setLoggingOut(false)
    }
  }

  function handleLogout() {
    confirmAction("Logout", "Are you sure you want to sign out?", "Logout", () => void performLogout())
  }

  function openSupportEmail() {
    const q = encodeURIComponent("Restaurant app — question")
    const url = `mailto:${SUPPORT_EMAIL}?subject=${q}`
    Linking.openURL(url).catch(() => {
      notify("Email", `Contact us at ${SUPPORT_EMAIL}`)
    })
  }

  function showHelp() {
    notify(
      "Tips",
      "• Use Home for a snapshot of logs and inventory.\n• Finance tab tracks revenue and expenses by period.\n• Inventory and Logs tabs hold full lists and add/edit.\n• Low stock counts items under 10 units."
    )
  }

  const appName =
    (Constants.expoConfig?.name as string | undefined) ?? "Restaurant app"
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <Text style={styles.title}>Settings</Text>
          </View>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContent}>
            <View style={styles.profileBlock}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={styles.profileTextCol}>
                <Text style={styles.profileEmail} numberOfLines={2}>
                  {userEmail ?? "Not signed in"}
                </Text>
                <Text style={styles.profileHint}>Restaurant staff account</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Text style={styles.groupLabel}>Shortcuts</Text>
        <Card style={styles.card} mode="elevated">
          <MenuRow
            icon="home"
            iconColor={colors.primary}
            label="Home dashboard"
            onPress={() => {
              triggerNavHaptic()
              router.push("./index")
            }}
          />
          <RowDivider />
          <MenuRow
            icon="albums"
            iconColor={colors.inventory}
            label="Inventory log"
            onPress={() => {
              triggerNavHaptic()
              router.push("/(tabs)/inventory-log")
            }}
          />
          <RowDivider />
          <MenuRow
            icon="wallet"
            iconColor={colors.finance}
            label="Finance"
            onPress={() => {
              triggerNavHaptic()
              router.push("/(tabs)/finance")
            }}
          />
          <RowDivider />
          <MenuRow
            icon="document-text"
            iconColor={colors.management}
            label="Management logs"
            onPress={() => {
              triggerNavHaptic()
              router.push("/(tabs)/management-log")
            }}
          />
        </Card>

        <Text style={styles.groupLabel}>Preferences</Text>
        <Card style={styles.card} mode="elevated">
          <View style={styles.switchRow}>
            <View style={styles.switchRowLeft}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={colors.textSecondary}
                style={styles.switchIcon}
              />
              <View style={styles.switchLabels}>
                <Text style={styles.switchTitle}>Low-stock reminders</Text>
                <Text style={styles.switchSubtitle}>
                  Demo toggle — connect to push later
                </Text>
              </View>
            </View>
            <Switch
              value={demoNotifications}
              onValueChange={setDemoNotifications}
              color={colors.primary}
            />
          </View>
        </Card>

        <Text style={styles.groupLabel}>Support</Text>
        <Card style={styles.card} mode="elevated">
          <MenuRow
            icon="help-circle-outline"
            iconColor={colors.secondary}
            label="Help & tips"
            onPress={showHelp}
            showChevron={false}
          />
          <RowDivider />
          <MenuRow
            icon="information-circle-outline"
            iconColor={colors.primary}
            label="About us"
            onPress={() => setAboutVisible(true)}
            showChevron={false}
          />
          <RowDivider />
          <MenuRow
            icon="mail-outline"
            iconColor={colors.settings}
            label="Contact support"
            onPress={openSupportEmail}
            showChevron={false}
          />
        </Card>

        <Text style={styles.groupLabel}>Account</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContentTight}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{userEmail ?? "—"}</Text>
            <Text style={styles.meta}>
              Sign-in is managed with Firebase Authentication.
            </Text>
          </Card.Content>
        </Card>

        <Text style={styles.groupLabel}>About</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.cardContentTight}>
            <View style={styles.aboutRow}>
              <Text style={styles.label}>App</Text>
              <Text style={styles.value}>{appName}</Text>
            </View>
            <View style={[styles.aboutRow, styles.aboutRowSpaced]}>
              <Text style={styles.label}>Version</Text>
              <Text style={styles.value}>{appVersion}</Text>
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleLogout}
          disabled={loggingOut}
          loading={loggingOut}
          style={styles.logoutButton}
          labelStyle={styles.logoutLabel}
          icon="logout"
        >
          Logout
        </Button>
      </ScrollView>

      <Modal
        visible={aboutVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAboutVisible(false)}
      >
        <View style={styles.aboutModalOverlay}>
          <TouchableWithoutFeedback
            accessibilityRole="button"
            accessibilityLabel="Close about dialog"
            onPress={() => setAboutVisible(false)}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.aboutModalCard}>
            <View style={styles.aboutModalImageWrap}>
              <Image
                source={mascotImages.about}
                style={styles.aboutModalImage}
                contentFit="contain"
                accessibilityLabel="App mascot"
              />
            </View>
            <Text style={styles.aboutModalTitle}>About us</Text>
            <ScrollView
              style={styles.aboutModalScroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <Text style={styles.aboutModalBody}>
                {appName} is a friendly tool for restaurant teams to stay on top of day-to-day
                operations. Track inventory levels and costs, log management notes (maintenance,
                compliance, incidents), and see a quick snapshot of what needs attention—from low
                stock to recent activity—all in one place.{"\n\n"}
                Built as a mobile-first experience so managers and staff can check the kitchen
                from the floor, the office, or on the go.
              </Text>
            </ScrollView>
            <Button
              mode="contained"
              onPress={() => setAboutVisible(false)}
              style={styles.aboutModalClose}
              labelStyle={styles.aboutModalCloseLabel}
            >
              Close
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

/** Thin line between tappable rows inside a Card. */
function RowDivider() {
  return <View style={styles.divider} />
}

/** One settings row: icon, label, optional chevron, full-row press target. */
function MenuRow({
  icon,
  iconColor,
  label,
  onPress,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  label: string
  onPress: () => void
  showChevron?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.72 }]}
    >
      <View style={[styles.menuIconWrap, { borderColor: `${iconColor}55` }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 8,
  },
  header: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(88, 204, 2, 0.4)",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },
  card: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardContent: {
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  cardContentTight: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  profileBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  profileEmail: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  profileHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 68,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 16,
    paddingLeft: 14,
  },
  switchRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    minWidth: 0,
  },
  switchIcon: {
    marginRight: 10,
  },
  switchLabels: {
    flex: 1,
    minWidth: 0,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  meta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
    lineHeight: 18,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  aboutRowSpaced: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  logoutButton: {
    marginTop: 20,
    borderRadius: 14,
    backgroundColor: colors.error,
    borderBottomWidth: 4,
    borderBottomColor: colors.errorDark,
  },
  logoutLabel: {
    fontWeight: "700",
  },
  aboutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  aboutModalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 8,
  },
  aboutModalImageWrap: {
    alignItems: "center",
    marginBottom: 12,
  },
  aboutModalImage: {
    width: "100%",
    height: 160,
  },
  aboutModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 12,
  },
  aboutModalScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  aboutModalBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  aboutModalClose: {
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryDark,
  },
  aboutModalCloseLabel: {
    fontWeight: "700",
  },
})
