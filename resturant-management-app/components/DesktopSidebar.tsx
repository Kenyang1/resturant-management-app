/**
 * Persistent left nav for the desktop-web build. Mirrors the same six destinations as the
 * mobile bottom tab bar, driven by the same expo-router routes — this is a second view onto
 * one navigation model, not a separate one.
 */
import { useEffect, useState } from "react"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { router, usePathname } from "expo-router"
import { StyleSheet, Text, View } from "react-native"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { DESKTOP_SIDEBAR_WIDTH } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { supabase } from "@/lib/supabase"
import { colors, radii } from "@/lib/theme"

type NavItem = {
  href: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  activeIcon: keyof typeof Ionicons.glyphMap
  match: (pathname: string) => boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/(tabs)",
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
    match: (p) => p === "/" || p === "/index",
  },
  {
    href: "/(tabs)/inventory-log",
    label: "Inventory",
    icon: "cube-outline",
    activeIcon: "cube",
    match: (p) => p.startsWith("/inventory-log"),
  },
  {
    href: "/(tabs)/tasks",
    label: "Tasks",
    icon: "checkbox-outline",
    activeIcon: "checkbox",
    match: (p) => p.startsWith("/tasks"),
  },
  {
    href: "/(tabs)/finance",
    label: "Finance",
    icon: "wallet-outline",
    activeIcon: "wallet",
    match: (p) => p.startsWith("/finance"),
  },
  {
    href: "/(tabs)/management-log",
    label: "Logs",
    icon: "document-text-outline",
    activeIcon: "document-text",
    match: (p) => p.startsWith("/management-log"),
  },
]

export function DesktopSidebar() {
  const pathname = usePathname()
  const { data: members } = useRestaurantMembers()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const currentMember = members.find((m) => m.user_id === userId)
  const onProfile = pathname.startsWith("/profile")

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <Image source={mascotImages.logo} style={styles.brandLogo} contentFit="contain" />
        <Text style={styles.brandName} numberOfLines={1}>
          Meow Management
        </Text>
      </View>

      <View style={styles.navList}>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname)
          return (
            <AnimatedPressable
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={[styles.navRow, active && styles.navRowActive]}
              scaleTo={0.99}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={20}
                color={active ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </AnimatedPressable>
          )
        })}
      </View>

      <View style={styles.spacer} />

      <View style={styles.profileDivider} />
      <AnimatedPressable
        onPress={() => router.push("/(tabs)/profile" as never)}
        style={[styles.profileRow, onProfile && styles.navRowActive]}
        scaleTo={0.99}
        accessibilityRole="button"
      >
        <View style={styles.profileAvatar}>
          {currentMember?.avatar_url ? (
            <Image
              source={{ uri: currentMember.avatar_url }}
              style={styles.profileAvatarImage}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="person" size={16} color={colors.primary} />
          )}
        </View>
        <View style={styles.profileTextCol}>
          <Text style={styles.profileName} numberOfLines={1}>
            {currentMember?.display_name?.trim() || "Profile"}
          </Text>
          <Text style={styles.profileRole} numberOfLines={1}>
            {currentMember?.role ?? "View account"}
          </Text>
        </View>
      </AnimatedPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  sidebar: {
    width: DESKTOP_SIDEBAR_WIDTH,
    flexShrink: 0,
    height: "100%",
    paddingVertical: 20,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    marginBottom: 22,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  navList: {
    gap: 3,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
  },
  navRowActive: {
    backgroundColor: colors.softSage,
  },
  navLabel: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  navLabelActive: {
    color: colors.primaryDark,
    fontFamily: "Nunito_800ExtraBold",
  },
  spacer: {
    flex: 1,
  },
  profileDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: radii.md,
  },
  profileAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%",
  },
  profileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  profileRole: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: "capitalize",
    marginTop: 1,
  },
})
