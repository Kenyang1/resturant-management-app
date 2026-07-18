/**
 * More tab (route: /profile) — identity, finance shortcut, team/account/support groups, sign out.
 * Team members, pending invites, upcoming shifts, workspace/account details, and preferences all
 * still live here — just consolidated into on-demand sheets instead of always-inline cards, per
 * the More-hub redesign.
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { MisoChatModal } from "@/components/miso-chat-modal"
import { PickerField } from "@/components/PickerField"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Sheet } from "@/components/Sheet"
import { confirmAction, notify } from "@/lib/alert"
import { getAcceptInviteUrl } from "@/lib/authRedirect"
import { money, sumByKind, toYMD } from "@/lib/finance"
import { useActivityLog } from "@/lib/hooks/useActivityLog"
import { useFinanceEntries } from "@/lib/hooks/useFinanceEntries"
import { RestaurantRole, useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { useRestaurantInvites } from "@/lib/hooks/useRestaurantInvites"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useShifts } from "@/lib/hooks/useShifts"
import { shareOrCopyLink } from "@/lib/shareLink"
import { supabase } from "@/lib/supabase"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors, radii } from "@/lib/theme"
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
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Chip, SegmentedButtons, Switch, Text, TextInput } from "react-native-paper"

/** "HH:MM" <-> Date, for the shift start/end picker fields (only the time-of-day is used). */
function parseTimeString(hm: string): Date {
  const [h, m] = hm.split(":").map(Number)
  const d = new Date()
  d.setHours(isNaN(h) ? 9 : h, isNaN(m) ? 0 : m, 0, 0)
  return d
}

function formatTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
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
  const { horizontal, scrollBottomPad, desktopFrameStyle } = useMobileLayout()
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
  const [teamSheetVisible, setTeamSheetVisible] = useState(false)
  const [accountSheetVisible, setAccountSheetVisible] = useState(false)
  const [notificationsSheetVisible, setNotificationsSheetVisible] = useState(false)
  const [chatVisible, setChatVisible] = useState(false)

  const { data: members, updateOwnAvatar } = useRestaurantMembers()
  const { data: invites, createInvite } = useRestaurantInvites()
  const { data: shifts, insert: insertShift } = useShifts()
  const { data: activity, refetch: refetchActivity } = useActivityLog()
  const { data: financeEntries } = useFinanceEntries()
  const [activityVisible, setActivityVisible] = useState(false)
  const myMember = members.find((m) => m.user_id === userId)
  const myRole = myMember?.role
  const canInvite = myRole === "owner" || myRole === "manager"
  const canManageShifts = myRole === "owner" || myRole === "manager"
  // Same least-privileged rule as Finance: any staff membership hides the manager affordances.
  const myRoles = members.filter((m) => m.user_id === userId).map((m) => m.role)
  const canManageFinance = myRoles.length === 0 || !myRoles.includes("staff")
  const pendingInvites = invites.filter((i) => i.status === "pending")
  const upcomingShifts = shifts
    .filter((s) => new Date(s.ends_at) >= new Date())
    .slice(0, 5)
  const upcomingShiftCount = shifts.filter((s) => new Date(s.ends_at) >= new Date()).length

  const todayYMD = toYMD(new Date())
  const todaysRange = { start: todayYMD, end: todayYMD }
  const todaysNet =
    sumByKind(financeEntries, "revenue", todaysRange) -
    sumByKind(financeEntries, "expense", todaysRange)

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
      mediaTypes: "images",
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
      // Native uploads go through base64 → ArrayBuffer: React Native's Blob support
      // is incomplete and fetch(uri).blob() produces broken/empty Storage uploads.
      base64: Platform.OS !== "web",
    })
    if (result.canceled || !result.assets[0]) return

    setUploadingAvatar(true)
    try {
      const asset = result.assets[0]
      const contentType = asset.mimeType ?? "image/jpeg"
      const path = `${userId}/avatar`

      let body: Blob | ArrayBuffer
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri)
        body = await response.blob()
      } else {
        if (!asset.base64) throw new Error("Could not read the selected image.")
        const binary = atob(asset.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        body = bytes.buffer
      }

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, body, { upsert: true, contentType })
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
    setShiftStart("09:00")
    setShiftEnd("17:00")
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
      // Explicit confirmation: a shift whose end time has already passed won't show
      // under "Upcoming shifts", which otherwise reads as a silent failure.
      notify(
        "Shift scheduled",
        endsAt < new Date()
          ? "Saved — note it won't appear under Upcoming shifts because it has already ended."
          : "It's on the schedule."
      )
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
      // Re-run the root routing gate rather than hardcoding a destination: it sends native
      // straight to sign-in and sends the web build to the landing page, same as a fresh visit.
      router.replace("/")
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

  function goToFinance() {
    triggerNavHaptic()
    router.push("/(tabs)/finance")
  }

  const appName =
    (Constants.expoConfig?.name as string | undefined) ?? "Restaurant app"
  const appVersion = Constants.expoConfig?.version ?? "1.0.0"

  return (
    <SafeAreaView style={styles.safeRoot} edges={["top", "left", "right"]}>
      <View style={desktopFrameStyle}>
        <ScrollView
          style={styles.container}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
          ]}
        >
          <ScreenHeader title="More" />

          <View style={styles.profileHero}>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={handleChangeAvatar}
              disabled={uploadingAvatar}
              style={styles.avatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : myMember?.avatar_url ? (
                <Image
                  source={{ uri: myMember.avatar_url }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  accessibilityLabel={myMember.display_name ?? "Profile photo"}
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={17} color="#FFFFFF" />
              </View>
            </AnimatedPressable>
            <View style={styles.profileTextCol}>
              <Text style={styles.profileName} numberOfLines={1}>
                {myMember?.display_name?.trim() || "Restaurant teammate"}
              </Text>
              <Text style={styles.profileEmail} numberOfLines={2}>
                {userEmail ?? "Not signed in"}
              </Text>
              <View style={styles.roleChip}>
                <Text style={styles.roleChipText}>{myRole ?? "staff"}</Text>
              </View>
            </View>
          </View>

          <AnimatedPressable style={styles.netHeroCard} onPress={goToFinance} scaleTo={0.98}>
            <View style={styles.netHeroCopy}>
              <Text style={styles.netHeroLabel}>Today&apos;s net</Text>
              <Text style={styles.netHeroValue} numberOfLines={1} adjustsFontSizeToFit>
                {money.format(todaysNet)}
              </Text>
            </View>
            <View style={styles.netHeroAction}>
              <Ionicons
                name={todaysNet >= 0 ? "trending-up" : "trending-down"}
                size={18}
                color={colors.primaryDark}
              />
              <Text style={styles.netHeroActionText}>View finance</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
            </View>
          </AnimatedPressable>

          <Text style={styles.groupLabel}>Management</Text>
          <View style={styles.card}>
            <MenuRow
              icon="wallet"
              iconColor={colors.finance}
              label="Finance"
              description="Track revenue and expenses"
              onPress={goToFinance}
            />
            <RowDivider />
            <MenuRow
              icon="people-outline"
              iconColor={colors.primary}
              label="Team & shifts"
              description={`${members.length} member${members.length === 1 ? "" : "s"} • ${upcomingShiftCount} upcoming`}
              onPress={() => setTeamSheetVisible(true)}
            />
            {canManageFinance && (
              <>
                <RowDivider />
                <MenuRow
                  icon="checkmark-done-outline"
                  iconColor={colors.management}
                  label="Approvals"
                  description="Review pending transaction requests"
                  onPress={goToFinance}
                />
              </>
            )}
          </View>

          <Text style={styles.groupLabel}>Account</Text>
          <View style={styles.card}>
            <MenuRow
              icon="storefront-outline"
              iconColor={colors.primary}
              label="Profile & restaurant"
              description="Workspace and account details"
              onPress={() => setAccountSheetVisible(true)}
            />
            <RowDivider />
            <MenuRow
              icon="notifications-outline"
              iconColor={colors.primary}
              label="Notifications"
              onPress={() => setNotificationsSheetVisible(true)}
            />
            <RowDivider />
            <MenuRow
              icon="time-outline"
              iconColor={colors.settings}
              label="Activity history"
              description="Who changed what, and when"
              onPress={() => {
                refetchActivity()
                setActivityVisible(true)
              }}
            />
          </View>

          <Text style={styles.groupLabel}>Support</Text>
          <View style={styles.card}>
            <MenuRow
              image={mascotImages.ask}
              label="Ask Miso"
              description="Get help fast"
              onPress={() => setChatVisible(true)}
            />
            <RowDivider />
            <MenuRow
              icon="help-circle-outline"
              iconColor={colors.secondary}
              label="Help & tips"
              onPress={showHelp}
            />
            <RowDivider />
            <MenuRow
              icon="information-circle-outline"
              iconColor={colors.primary}
              label="About us"
              onPress={() => setAboutVisible(true)}
            />
            <RowDivider />
            <MenuRow
              icon="mail-outline"
              iconColor={colors.settings}
              label="Contact support"
              onPress={openSupportEmail}
            />
          </View>

          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            onPress={handleLogout}
            disabled={loggingOut}
            style={styles.logoutButton}
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
            )}
            <Text style={styles.logoutLabel}>{loggingOut ? "Logging out…" : "Log out"}</Text>
          </AnimatedPressable>
        </ScrollView>
      </View>

      <Sheet visible={teamSheetVisible} onDismiss={() => setTeamSheetVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.aboutModalTitle}>Team & shifts</Text>

          <View style={styles.sectionCardHeader}>
            <View style={styles.sectionCardIcon}>
              <Ionicons name="people-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.sectionCardCopy}>
              <Text style={styles.sectionCardTitle}>Team members</Text>
            </View>
            <Text style={styles.sectionCardCount}>
              {members.length} member{members.length === 1 ? "" : "s"}
            </Text>
          </View>
          <View style={styles.sectionDivider} />
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
                description="Create and share a secure join link"
                actionLabel="Invite"
                onPress={openInviteModal}
                showChevron={false}
              />
            </View>
          )}

          {canInvite && pendingInvites.length > 0 && (
            <>
              <Text style={styles.subgroupLabel}>Pending invitations</Text>
              <View style={styles.pendingDivider} />
              {pendingInvites.map((invite) => (
                <View key={invite.id} style={styles.pendingInviteRow}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>
                      {invite.email.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
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
                    style={styles.copyButton}
                    labelStyle={styles.copyButtonLabel}
                    textColor={colors.primary}
                  >
                    Copy
                  </Button>
                </View>
              ))}
            </>
          )}

          <Text style={styles.subgroupLabel}>Upcoming shifts</Text>
          {upcomingShifts.length === 0 ? (
            <View style={styles.emptyShift}>
              <View style={styles.emptyShiftIcon}>
                <Ionicons name="calendar-clear-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.pendingInviteTextCol}>
                <Text style={styles.emptyShiftTitle}>No upcoming shifts</Text>
                <Text style={styles.emptyShiftText}>The next scheduled shift will appear here.</Text>
              </View>
            </View>
          ) : (
            upcomingShifts.map((shift, index) => {
              const member = members.find((m) => m.user_id === shift.user_id)
              return (
                <View key={shift.id}>
                  {index > 0 && <RowDivider />}
                  <View style={styles.shiftRow}>
                    <View style={styles.shiftAvatar}>
                      {member?.avatar_url ? (
                        <Image
                          source={{ uri: member.avatar_url }}
                          style={styles.shiftAvatarImage}
                          contentFit="cover"
                          accessibilityLabel={member.display_name ?? "Team member photo"}
                        />
                      ) : (
                        <Text style={styles.shiftAvatarText}>
                          {(member?.display_name ?? "?").trim().charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
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
                description="Add a shift to the shared schedule"
                actionLabel="Add"
                onPress={openShiftModal}
                showChevron={false}
              />
            </>
          )}
        </ScrollView>
      </Sheet>

      <Sheet visible={accountSheetVisible} onDismiss={() => setAccountSheetVisible(false)}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.aboutModalTitle}>Profile & restaurant</Text>

          <View style={styles.workspaceTopRow}>
            <View style={styles.workspaceIcon}>
              <Ionicons name="storefront-outline" size={23} color={colors.primary} />
            </View>
            <View style={styles.workspaceCopy}>
              <Text style={styles.workspaceTitle}>Restaurant workspace</Text>
              <Text style={styles.workspaceMeta}>
                {members.length} member{members.length === 1 ? "" : "s"}
                {"  •  "}
                {upcomingShiftCount} upcoming shift{upcomingShiftCount === 1 ? "" : "s"}
              </Text>
            </View>
          </View>

          <Text style={styles.subgroupLabel}>Account details</Text>
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Ionicons name="lock-closed-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.pendingInviteTextCol}>
              <Text style={styles.label}>Signed in with</Text>
              <Text style={styles.value}>{userEmail ?? "—"}</Text>
              <Text style={styles.meta}>Sign-in is managed with Supabase Authentication.</Text>
            </View>
          </View>

          <Text style={styles.subgroupLabel}>App information</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.infoRowLabel}>App</Text>
            <Text style={styles.value}>{appName}</Text>
          </View>
          <View style={[styles.aboutRow, styles.aboutRowSpaced]}>
            <Text style={styles.infoRowLabel}>Version</Text>
            <Text style={styles.value}>{appVersion}</Text>
          </View>
        </ScrollView>
      </Sheet>

      <Sheet visible={notificationsSheetVisible} onDismiss={() => setNotificationsSheetVisible(false)}>
        <Text style={styles.aboutModalTitle}>Notifications</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchRowLeft}>
            <View style={styles.preferenceIconWrap}>
              <Ionicons name="notifications-outline" size={21} color={colors.primary} style={styles.switchIcon} />
            </View>
            <View style={styles.switchLabels}>
              <Text style={styles.switchTitle}>Low-stock reminders</Text>
              <Text style={styles.switchSubtitle}>Demo toggle — connect to push later</Text>
            </View>
          </View>
          <Switch value={demoNotifications} onValueChange={setDemoNotifications} color={colors.primary} />
        </View>
      </Sheet>

      <Sheet visible={aboutVisible} onDismiss={() => setAboutVisible(false)}>
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
      </Sheet>

      <Sheet visible={inviteModalVisible} onDismiss={() => setInviteModalVisible(false)}>
        <View style={styles.modalIcon}>
          <Ionicons name="person-add-outline" size={25} color={colors.primary} />
        </View>
        <Text style={styles.aboutModalTitle}>Invite teammate</Text>
        <Text style={styles.modalSubtitle}>Choose their role, then share the secure invite link.</Text>
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
      </Sheet>

      <Sheet visible={shiftModalVisible} onDismiss={closeShiftModal}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.modalIcon}>
            <Ionicons name="calendar-outline" size={25} color={colors.primary} />
          </View>
          <Text style={styles.aboutModalTitle}>Schedule a shift</Text>
          <Text style={styles.modalSubtitle}>Add a team member to the upcoming schedule.</Text>
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
          <PickerField
            label="Date"
            mode="date"
            value={new Date(`${shiftDate}T00:00:00`)}
            onChange={(d) => setShiftDate(toYMD(d))}
          />
          <View style={styles.shiftTimeRow}>
            <View style={styles.shiftTimeField}>
              <PickerField
                label="Start time"
                mode="time"
                value={parseTimeString(shiftStart)}
                onChange={(d) => setShiftStart(formatTimeString(d))}
              />
            </View>
            <View style={styles.shiftTimeField}>
              <PickerField
                label="End time"
                mode="time"
                value={parseTimeString(shiftEnd)}
                onChange={(d) => setShiftEnd(formatTimeString(d))}
              />
            </View>
          </View>
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
      </Sheet>

      <Sheet visible={activityVisible} onDismiss={() => setActivityVisible(false)}>
        <View style={styles.modalIcon}>
          <Ionicons name="time-outline" size={25} color={colors.primary} />
        </View>
        <Text style={styles.aboutModalTitle}>Activity history</Text>
        <Text style={styles.modalSubtitle}>Recent changes across inventory, logs, and finance.</Text>
        <ScrollView style={styles.activityScroll} showsVerticalScrollIndicator={false}>
          {activity.length === 0 ? (
            <Text style={styles.meta}>No activity recorded yet.</Text>
          ) : (
            activity.map((entry) => {
              const actor = members.find((m) => m.user_id === entry.actor_id)
              const verb =
                entry.action === "insert" ? "added" : entry.action === "update" ? "updated" : "deleted"
              const area =
                entry.table_name === "inventory_log"
                  ? "Inventory"
                  : entry.table_name === "management_log"
                    ? "Logs"
                    : "Finance"
              return (
                <View key={entry.id} style={styles.activityRow}>
                  <Text style={styles.activityText}>
                    <Text style={styles.activityActor}>{actor?.display_name ?? "Someone"}</Text> {verb}{" "}
                    <Text style={styles.activityActor}>{entry.record_summary}</Text> in {area}
                  </Text>
                  <Text style={styles.meta}>
                    {new Date(entry.created_at).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              )
            })
          )}
        </ScrollView>
        <Button
          mode="contained"
          onPress={() => setActivityVisible(false)}
          style={styles.aboutModalClose}
          labelStyle={styles.aboutModalCloseLabel}
        >
          Close
        </Button>
      </Sheet>

      <MisoChatModal visible={chatVisible} onDismiss={() => setChatVisible(false)} />
    </SafeAreaView>
  )
}

/** Thin line between tappable rows inside a Card. */
function RowDivider() {
  return <View style={styles.divider} />
}

/** One settings row: icon-or-image, label, optional chevron, full-row press target. */
function MenuRow({
  icon,
  image,
  iconColor,
  label,
  description,
  actionLabel,
  onPress,
  showChevron = true,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  image?: number | { uri: string }
  iconColor?: string
  label: string
  description?: string
  actionLabel?: string
  onPress: () => void
  showChevron?: boolean
}) {
  return (
    <AnimatedPressable onPress={onPress} style={styles.menuRow} scaleTo={0.99}>
      {image ? (
        <View style={styles.menuImageWrap}>
          <Image source={image} style={styles.menuImage} contentFit="contain" />
        </View>
      ) : (
        <View style={[styles.menuIconWrap, { borderColor: `${iconColor}55` }]}>
          <Ionicons name={icon!} size={22} color={iconColor} />
        </View>
      )}
      <View style={styles.menuCopy}>
        <Text style={styles.menuLabel}>{label}</Text>
        {description && <Text style={styles.menuDescription}>{description}</Text>}
      </View>
      {actionLabel ? (
        <View style={styles.menuActionPill}>
          <Text style={styles.menuActionText}>{actionLabel}</Text>
        </View>
      ) : showChevron ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      ) : null}
    </AnimatedPressable>
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
    paddingTop: 12,
    gap: 10,
  },
  groupLabel: {
    fontSize: 17,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.primary,
    letterSpacing: -0.2,
    marginBottom: 7,
    marginTop: 10,
    marginLeft: 2,
  },
  subgroupLabel: {
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.primary,
    letterSpacing: -0.15,
    marginBottom: 7,
    marginTop: 14,
    marginLeft: 2,
  },
  card: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 2px rgba(31, 55, 40, 0.05)",
    overflow: "hidden",
  },
  profileHero: {
    alignItems: "center",
    paddingTop: 2,
    paddingBottom: 4,
    gap: 12,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 4,
    borderColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
    boxShadow: "0 3px 10px rgba(31, 55, 40, 0.14)",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
  },
  avatarText: {
    fontSize: 40,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.primary,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surface,
  },
  profileTextCol: {
    width: "100%",
    alignItems: "center",
  },
  profileName: {
    maxWidth: "100%",
    fontSize: 25,
    lineHeight: 31,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  profileEmail: {
    maxWidth: "100%",
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 3,
  },
  roleChip: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
    marginTop: 8,
  },
  roleChipText: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
    textTransform: "capitalize",
  },
  netHeroCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.softSage,
  },
  netHeroCopy: {
    flex: 1,
    minWidth: 0,
  },
  netHeroLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
  },
  netHeroValue: {
    fontSize: 26,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.4,
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  netHeroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  netHeroActionText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
  },
  workspaceTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 4,
  },
  workspaceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  workspaceCopy: {
    flex: 1,
    minWidth: 0,
  },
  workspaceTitle: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  workspaceMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionCardIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  sectionCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionCardTitle: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  sectionCardCount: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 10,
  },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    gap: 10,
  },
  teamRowLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  teamAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 9,
  },
  teamAvatarImage: {
    width: "100%",
    height: "100%",
  },
  teamAvatarText: {
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.primary,
  },
  teamMemberName: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textPrimary,
    flexShrink: 1,
  },
  teamYouTag: {
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
    color: colors.primary,
  },
  teamRoleBadge: {
    overflow: "hidden",
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countPill: {
    minWidth: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    backgroundColor: colors.statLogsBg,
  },
  pendingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  pendingInviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 9,
  },
  pendingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.statLogsBg,
    borderWidth: 1,
    borderColor: colors.statLogsBorder,
  },
  pendingAvatarText: {
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.managementDark,
  },
  pendingInviteTextCol: {
    flex: 1,
    minWidth: 0,
  },
  inviteInput: {
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  shiftTimeRow: {
    flexDirection: "row",
    gap: 8,
  },
  shiftTimeField: {
    flex: 1,
    minWidth: 0,
  },
  copyButton: {
    borderRadius: radii.pill,
    borderColor: colors.statStockBorder,
  },
  copyButtonLabel: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    marginHorizontal: 8,
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
    gap: 11,
    paddingVertical: 9,
  },
  shiftAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
  },
  shiftAvatarImage: {
    width: "100%",
    height: "100%",
  },
  shiftAvatarText: {
    fontSize: 14,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.primary,
  },
  emptyShift: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  emptyShiftIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  emptyShiftTitle: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  emptyShiftText: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  assigneeLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
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
    backgroundColor: colors.surfaceWarm,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingVertical: 8,
    paddingHorizontal: 13,
    gap: 10,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
  },
  menuImageWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.softSage,
    overflow: "hidden",
  },
  menuImage: {
    width: 30,
    height: 30,
  },
  menuCopy: {
    flex: 1,
    minWidth: 0,
  },
  menuLabel: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  menuDescription: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 2,
  },
  menuActionPill: {
    minWidth: 45,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceWarm,
  },
  menuActionText: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 57,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 58,
    marginTop: 8,
  },
  switchRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    minWidth: 0,
  },
  switchIcon: {
    marginRight: 0,
  },
  preferenceIconWrap: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    marginRight: 10,
  },
  switchLabels: {
    flex: 1,
    minWidth: 0,
  },
  switchTitle: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: "Nunito_700Bold",
  },
  meta: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 17,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  infoRowLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textSecondary,
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
    minHeight: 44,
    marginTop: 8,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  logoutLabel: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
    color: colors.error,
  },
  modalIcon: {
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: -5,
    marginBottom: 18,
  },
  aboutModalImageWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
    marginBottom: 14,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
  },
  aboutModalImage: {
    width: "100%",
    height: 150,
  },
  aboutModalTitle: {
    fontSize: 23,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  aboutModalScroll: {
    maxHeight: 280,
    marginBottom: 16,
  },
  aboutModalBody: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  aboutModalClose: {
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
  aboutModalCloseLabel: {
    fontFamily: "Nunito_700Bold",
  },
  activityScroll: {
    maxHeight: 340,
    marginBottom: 16,
  },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  activityActor: {
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
})
