/**
 * Profile / Settings tab — Supabase user info, navigation shortcuts, demo toggles, support, logout.
 */
import { confirmAction, notify } from "@/lib/alert"
import { getAcceptInviteUrl } from "@/lib/authRedirect"
import { RestaurantRole, useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { useRestaurantInvites } from "@/lib/hooks/useRestaurantInvites"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useShifts } from "@/lib/hooks/useShifts"
import { shareOrCopyLink } from "@/lib/shareLink"
import { supabase } from "@/lib/supabase"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import Constants from "expo-constants"
import * as Haptics from "expo-haptics"
import { Image } from "expo-image"
import * as ImagePicker from "expo-image-picker"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import {
  ActivityIndicator,
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
import { Button, Card, Chip, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper"

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatShiftRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const dateStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const startTime = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  const endTime = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${dateStr}, ${startTime} – ${endTime}`
}

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
  const [userId, setUserId] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [demoNotifications, setDemoNotifications] = useState(true)
  const [aboutVisible, setAboutVisible] = useState(false)
  const [inviteModalVisible, setInviteModalVisible] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<Exclude<RestaurantRole, "owner">>("staff")
  const [inviting, setInviting] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [shiftModalVisible, setShiftModalVisible] = useState(false)
  const [shiftMemberId, setShiftMemberId] = useState<string | null>(null)
  const [shiftLabel, setShiftLabel] = useState("")
  const [shiftDate, setShiftDate] = useState("")
  const [shiftStart, setShiftStart] = useState("")
  const [shiftEnd, setShiftEnd] = useState("")
  const [savingShift, setSavingShift] = useState(false)

  const { data: members, updateOwnAvatar } = useRestaurantMembers()
  const { data: invites, createInvite } = useRestaurantInvites()
  const { data: shifts, insert: insertShift } = useShifts()
  const myMember = members.find((m) => m.user_id === userId)
  const myRole = myMember?.role
  const canInvite = myRole === "owner" || myRole === "manager"
  const canManageShifts = myRole === "owner" || myRole === "manager"
  const pendingInvites = invites.filter((i) => i.status === "pending")
  const upcomingShifts = shifts
    .filter((s) => new Date(s.ends_at) >= new Date())
    .slice(0, 5)

  useEffect(() => {
    // Read once on mount; add onAuthStateChange if you need live updates after login elsewhere.
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
      setUserId(data.user?.id ?? null)
    })
  }, [])

  const initial = userEmail?.trim()?.charAt(0)?.toUpperCase() ?? "?"

  async function handleChangeAvatar() {
    if (!userId) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      notify("Permission needed", "Allow photo library access to set a profile picture.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (result.canceled || !result.assets[0]) return

    setUploadingAvatar(true)
    try {
      const asset = result.assets[0]
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      const contentType = asset.mimeType ?? "image/jpeg"
      const path = `${userId}/avatar`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path)
      const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      await updateOwnAvatar(userId, cacheBustedUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update profile picture."
      notify("Error", message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  function openInviteModal() {
    setInviteEmail("")
    setInviteRole("staff")
    setInviteModalVisible(true)
  }

  async function handleSendInvite() {
    if (!inviteEmail.trim()) {
      notify("Missing info", "Please enter an email address.")
      return
    }
    setInviting(true)
    try {
      const invite = await createInvite(inviteEmail.trim(), inviteRole)
      setInviteModalVisible(false)
      const url = getAcceptInviteUrl(invite.token)
      const result = await shareOrCopyLink(`Join us on ${Constants.expoConfig?.name ?? "the app"}!`, url)
      notify(
        "Invite sent",
        result === "copied" ? "Invite link copied — send it to your teammate." : "Share the invite link with your teammate."
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create invite."
      notify("Error", message)
    } finally {
      setInviting(false)
    }
  }

  function openShiftModal() {
    setShiftMemberId(userId)
    setShiftLabel("")
    setShiftDate(toYMD(new Date()))
    setShiftStart("")
    setShiftEnd("")
    setShiftModalVisible(true)
  }

  function closeShiftModal() {
    setShiftModalVisible(false)
  }

  async function handleSaveShift() {
    if (!shiftMemberId) {
      notify("Missing info", "Choose who this shift is for.")
      return
    }
    const timePattern = /^\d{2}:\d{2}$/
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate.trim()) || !timePattern.test(shiftStart) || !timePattern.test(shiftEnd)) {
      notify("Missing info", "Enter a date (YYYY-MM-DD) and start/end times (HH:MM).")
      return
    }
    const startsAt = new Date(`${shiftDate.trim()}T${shiftStart}:00`)
    const endsAt = new Date(`${shiftDate.trim()}T${shiftEnd}:00`)
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      notify("Invalid times", "End time must be after start time.")
      return
    }
    setSavingShift(true)
    try {
      await insertShift({
        user_id: shiftMemberId,
        label: shiftLabel.trim() || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      closeShiftModal()
    } catch (err) {
      notify("Error", getErrorMessage(err))
    } finally {
      setSavingShift(false)
    }
  }

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
              <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} style={styles.avatar}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : myMember?.avatar_url ? (
                  <Image source={{ uri: myMember.avatar_url }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{initial}</Text>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={12} color="#FFFFFF" />
                </View>
              </Pressable>
              <View style={styles.profileTextCol}>
                <Text style={styles.profileEmail} numberOfLines={2}>
                  {userEmail ?? "Not signed in"}
                </Text>
                <Text style={styles.profileHint}>
                  {myRole ? `Restaurant ${myRole}` : "Restaurant staff account"}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Text style={styles.groupLabel}>Team</Text>
        <Card style={styles.card} mode="elevated">
          {members.map((member, index) => (
            <View key={member.id}>
              {index > 0 && <RowDivider />}
              <View style={styles.teamRow}>
                <View style={styles.teamRowLeft}>
                  <View style={styles.teamAvatar}>
                    {member.avatar_url ? (
                      <Image source={{ uri: member.avatar_url }} style={styles.teamAvatarImage} contentFit="cover" />
                    ) : (
                      <Text style={styles.teamAvatarText}>
                        {(member.display_name ?? "?").trim().charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.teamMemberName} numberOfLines={1}>
                    {member.display_name ?? "Team member"}
                  </Text>
                  {member.user_id === userId && <Text style={styles.teamYouTag}> (you)</Text>}
                </View>
                <Text style={styles.teamRoleBadge}>{member.role}</Text>
              </View>
            </View>
          ))}
          {canInvite && (
            <View>
              <RowDivider />
              <MenuRow
                icon="person-add-outline"
                iconColor={colors.primary}
                label="Invite teammate"
                onPress={openInviteModal}
                showChevron={false}
              />
            </View>
          )}
        </Card>

        {canInvite && pendingInvites.length > 0 && (
          <Card style={styles.card} mode="elevated">
            <Card.Content style={styles.cardContentTight}>
              <Text style={styles.label}>Pending invites</Text>
              {pendingInvites.map((invite) => (
                <View key={invite.id} style={styles.pendingInviteRow}>
                  <View style={styles.pendingInviteTextCol}>
                    <Text style={styles.value} numberOfLines={1}>{invite.email}</Text>
                    <Text style={styles.meta}>Invited as {invite.role}</Text>
                  </View>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() =>
                      shareOrCopyLink(
                        `Join us on ${Constants.expoConfig?.name ?? "the app"}!`,
                        getAcceptInviteUrl(invite.token)
                      ).then((result) =>
                        notify(result === "copied" ? "Link copied" : "Shared")
                      )
                    }
                  >
                    Copy Link
                  </Button>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        <Text style={styles.groupLabel}>Shifts</Text>
        <Card style={styles.card} mode="elevated">
          {upcomingShifts.length === 0 ? (
            <Card.Content style={styles.cardContentTight}>
              <Text style={styles.meta}>No upcoming shifts scheduled.</Text>
            </Card.Content>
          ) : (
            upcomingShifts.map((shift, index) => {
              const member = members.find((m) => m.user_id === shift.user_id)
              return (
                <View key={shift.id}>
                  {index > 0 && <RowDivider />}
                  <View style={styles.shiftRow}>
                    <View style={styles.pendingInviteTextCol}>
                      <Text style={styles.value} numberOfLines={1}>
                        {member?.display_name ?? "Team member"}
                        {shift.label ? ` — ${shift.label}` : ""}
                      </Text>
                      <Text style={styles.meta}>{formatShiftRange(shift.starts_at, shift.ends_at)}</Text>
                    </View>
                  </View>
                </View>
              )
            })
          )}
          {canManageShifts && (
            <>
              <RowDivider />
              <MenuRow
                icon="calendar-outline"
                iconColor={colors.tasks}
                label="Schedule a shift"
                onPress={openShiftModal}
                showChevron={false}
              />
            </>
          )}
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
              Sign-in is managed with Supabase Authentication.
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

      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.aboutModalOverlay}>
          <TouchableWithoutFeedback
            accessibilityRole="button"
            accessibilityLabel="Close invite dialog"
            onPress={() => setInviteModalVisible(false)}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.aboutModalCard}>
            <Text style={styles.aboutModalTitle}>Invite teammate</Text>
            <TextInput
              label="Email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.inviteInput}
              autoFocus
            />
            <SegmentedButtons
              value={inviteRole}
              onValueChange={(value) => setInviteRole(value as Exclude<RestaurantRole, "owner">)}
              buttons={[
                { value: "staff", label: "Staff" },
                { value: "manager", label: "Manager" },
              ]}
              style={styles.inviteRolePicker}
            />
            {inviting ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <Button
                mode="contained"
                onPress={handleSendInvite}
                style={styles.aboutModalClose}
                labelStyle={styles.aboutModalCloseLabel}
              >
                Create Invite Link
              </Button>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={shiftModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeShiftModal}
      >
        <View style={styles.aboutModalOverlay}>
          <TouchableWithoutFeedback
            accessibilityRole="button"
            accessibilityLabel="Close schedule shift dialog"
            onPress={closeShiftModal}
          >
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <View style={styles.aboutModalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.aboutModalTitle}>Schedule a shift</Text>
              <Text style={styles.assigneeLabel}>For</Text>
              <View style={styles.assigneeChipRow}>
                {members.map((m) => (
                  <Chip
                    key={m.id}
                    selected={shiftMemberId === m.user_id}
                    onPress={() => setShiftMemberId(m.user_id)}
                    style={styles.assigneeChip}
                  >
                    {m.display_name ?? "Member"}
                  </Chip>
                ))}
              </View>
              <TextInput
                label="Label (optional)"
                value={shiftLabel}
                onChangeText={setShiftLabel}
                mode="outlined"
                placeholder="Kitchen Lead"
                style={styles.inviteInput}
              />
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={shiftDate}
                onChangeText={setShiftDate}
                mode="outlined"
                placeholder="2026-07-15"
                style={styles.inviteInput}
              />
              <TextInput
                label="Start time (HH:MM)"
                value={shiftStart}
                onChangeText={setShiftStart}
                mode="outlined"
                placeholder="09:00"
                style={styles.inviteInput}
              />
              <TextInput
                label="End time (HH:MM)"
                value={shiftEnd}
                onChangeText={setShiftEnd}
                mode="outlined"
                placeholder="17:00"
                style={styles.inviteInput}
              />
              {savingShift ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  onPress={handleSaveShift}
                  style={styles.aboutModalClose}
                  labelStyle={styles.aboutModalCloseLabel}
                >
                  Save Shift
                </Button>
              )}
            </ScrollView>
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
    overflow: "visible",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
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
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  teamRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  teamAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 10,
  },
  teamAvatarImage: {
    width: "100%",
    height: "100%",
  },
  teamAvatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
  },
  teamMemberName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  teamYouTag: {
    fontSize: 13,
    color: colors.textMuted,
  },
  teamRoleBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pendingInviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  pendingInviteTextCol: {
    flex: 1,
    minWidth: 0,
  },
  inviteInput: {
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  inviteRolePicker: {
    marginBottom: 20,
  },
  loader: {
    marginVertical: 8,
  },
  shiftRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  assigneeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  assigneeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  assigneeChip: {
    marginBottom: 4,
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
