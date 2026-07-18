/**
 * Web-only marketing landing page. The native phone app never routes here (see app/index.tsx) —
 * this is what a signed-out visitor sees first when opening the app in a browser.
 */
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { router } from "expo-router"
import { useEffect } from "react"
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native"
import { Text } from "react-native-paper"
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { DESKTOP_BREAKPOINT } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors, radii } from "@/lib/theme"

type Feature = {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  body: string
}

const FEATURES: Feature[] = [
  {
    icon: "cube-outline",
    title: "Inventory",
    body: "Track stock levels, storage locations, and cost per unit as they change.",
  },
  {
    icon: "checkbox-outline",
    title: "Tasks",
    body: "Assign shift checklists, hand off notes to the next crew, and see what's done.",
  },
  {
    icon: "wallet-outline",
    title: "Finance",
    body: "Log revenue and expenses, and compare this period to the last one.",
  },
  {
    icon: "document-text-outline",
    title: "Logs",
    body: "Keep a record of maintenance, incidents, and compliance notes your team can search.",
  },
]

const PREVIEW_ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "cube-outline", label: "Stock count" },
  { icon: "clipboard-outline", label: "Add log" },
  { icon: "receipt-outline", label: "Record expense" },
  { icon: "chatbubble-ellipses-outline", label: "Ask Miso" },
]

/** Fades and rises into place once, staggered by `delay` — for a one-time page reveal, not a loop. */
function Reveal({
  delay = 0,
  style,
  children,
}: {
  delay?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }))

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
}

/**
 * A native recreation of the Home dashboard's shift hero + quick actions — real RN views, not a
 * screenshot — so the hero shows the actual product's visual language, not just the mascot alone.
 */
function ProductPreviewCard() {
  return (
    <View style={styles.previewCard}>
      <View style={styles.previewShiftCard}>
        <Text style={styles.previewShiftLabel}>Today&apos;s shift</Text>
        <Text style={styles.previewShiftTime}>9:00 AM – 5:00 PM</Text>
        <View style={styles.previewShiftBadge}>
          <Text style={styles.previewShiftBadgeText}>Kitchen Lead</Text>
        </View>
      </View>
      <View style={styles.previewActionsGrid}>
        {PREVIEW_ACTIONS.map((action) => (
          <View key={action.label} style={styles.previewActionCard}>
            <View style={styles.previewActionIcon}>
              <Ionicons name={action.icon} size={18} color={colors.primary} />
            </View>
            <Text style={styles.previewActionLabel} numberOfLines={1}>
              {action.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default function Landing() {
  const { width } = useWindowDimensions()
  const isDesktop = width >= DESKTOP_BREAKPOINT

  return (
    <View style={styles.page}>
      <View style={styles.nav}>
        <View style={styles.navBrand}>
          <Image source={mascotImages.logo} style={styles.navLogo} contentFit="contain" />
          <Text style={styles.navName}>Meow Management</Text>
        </View>
        <AnimatedPressable
          onPress={() => router.push("/login")}
          style={styles.navSignIn}
          scaleTo={0.96}
        >
          <Text style={styles.navSignInText}>Sign in</Text>
        </AnimatedPressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, isDesktop && styles.heroDesktop]}>
          <Reveal style={[styles.heroCopy, isDesktop && styles.heroCopyDesktop]}>
            <Text style={[styles.headline, isDesktop && styles.headlineDesktop]}>
              Run your kitchen without the chaos.
            </Text>
            <Text style={styles.subtext}>
              Track inventory, assign shift tasks, log incidents, and watch cash flow, all from
              one place built for restaurant teams.
            </Text>
            <View style={styles.ctaRow}>
              <AnimatedPressable
                onPress={() => router.push("/sign-up")}
                style={styles.primaryCta}
                scaleTo={0.97}
              >
                <Text style={styles.primaryCtaText}>Get started</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => router.push("/login")}
                style={styles.secondaryCta}
                scaleTo={0.97}
              >
                <Text style={styles.secondaryCtaText}>Sign in</Text>
              </AnimatedPressable>
            </View>
          </Reveal>

          <Reveal delay={80} style={[styles.heroVisual, isDesktop && styles.heroVisualDesktop]}>
            <ProductPreviewCard />
            <Image
              source={mascotImages.shiftReady}
              style={styles.heroMascot}
              contentFit="contain"
              accessibilityLabel="Miso, the chef cat mascot, ready for the shift"
            />
          </Reveal>
        </View>

        <View style={[styles.featuresSection, isDesktop && styles.featuresSectionDesktop]}>
          <View style={[styles.featureGrid, isDesktop && styles.featureGridDesktop]}>
            {FEATURES.map((feature, index) => (
              <Reveal
                key={feature.title}
                delay={140 + index * 60}
                style={[styles.featureCard, isDesktop && styles.featureCardDesktop]}
              >
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={22} color={colors.primary} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </Reveal>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Meow Management</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.canvasWarm,
  },
  nav: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navLogo: {
    width: 30,
    height: 30,
  },
  navName: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  navSignIn: {
    minHeight: 38,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navSignInText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 32,
  },
  heroDesktop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 1080,
    width: "100%",
    alignSelf: "center",
    paddingTop: 72,
    paddingBottom: 48,
    gap: 56,
  },
  heroCopy: {
    gap: 14,
  },
  heroCopyDesktop: {
    flex: 1,
    maxWidth: 460,
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  headlineDesktop: {
    fontSize: 44,
    lineHeight: 50,
  },
  subtext: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    maxWidth: 460,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  primaryCta: {
    minHeight: 50,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    boxShadow: "0 6px 18px rgba(24, 107, 67, 0.22)",
  },
  primaryCtaText: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
  },
  secondaryCta: {
    minHeight: 50,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
  },
  secondaryCtaText: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
  },
  heroVisual: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroVisualDesktop: {
    flex: 1,
    maxWidth: 420,
  },
  previewCard: {
    width: "100%",
    maxWidth: 320,
    gap: 10,
    padding: 14,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 20px 48px rgba(23, 33, 28, 0.14)",
  },
  previewShiftCard: {
    minHeight: 92,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    gap: 4,
  },
  previewShiftLabel: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: "#FFFFFF",
  },
  previewShiftTime: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
  },
  previewShiftBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  previewShiftBadgeText: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
  },
  previewActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewActionCard: {
    flexBasis: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWarm,
  },
  previewActionIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  previewActionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  heroMascot: {
    position: "absolute",
    width: 160,
    height: 128,
    right: -36,
    bottom: -32,
  },
  featuresSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  featuresSectionDesktop: {
    paddingVertical: 48,
  },
  featureGrid: {
    gap: 14,
  },
  featureGridDesktop: {
    maxWidth: 1080,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  featureCard: {
    gap: 8,
    padding: 18,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  featureCardDesktop: {
    flexBasis: "23%",
    flexGrow: 1,
    minWidth: 220,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
  },
  featureBody: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  footer: {
    paddingVertical: 24,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
  },
})
