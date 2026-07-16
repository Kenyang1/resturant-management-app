/**
 * Lands here from a team-invite link (?token=...). Requires being signed in
 * as the invited email before the invite becomes visible — RLS on
 * restaurant_invites only lets the invitee see rows addressed to their own
 * email (see supabase/migrations/20260714000000_add_restaurant_invites.sql).
 */
import { notify } from "@/lib/alert"
import { useMobileLayout } from "@/lib/layout"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { router, useLocalSearchParams } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Text } from "react-native-paper"

type InviteInfo = {
  restaurant_name: string | null
  role: string
  email: string
}

export default function AcceptInvite() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const [checking, setChecking] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  const redirectParam = token ? `/accept-invite?token=${token}` : "/accept-invite"

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        if (!cancelled) {
          setError("This invite link is missing its token.")
          setChecking(false)
        }
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      if (cancelled) return
      if (!sessionData.session) {
        setSignedIn(false)
        setChecking(false)
        return
      }
      setSignedIn(true)
      const { data, error: qErr } = await supabase
        .from("restaurant_invites")
        .select("restaurant_name, role, email, status, expires_at")
        .eq("token", token)
        .maybeSingle()
      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
      } else if (!data) {
        setError("This invite wasn't found — it may have been sent to a different email address.")
      } else if (data.status !== "pending") {
        setError("This invite has already been used or revoked.")
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This invite has expired.")
      } else {
        setInvite({ restaurant_name: data.restaurant_name, role: data.role, email: data.email })
      }
      setChecking(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleAccept() {
    if (!token) return
    setAccepting(true)
    try {
      const { error: rpcError } = await supabase.rpc("accept_restaurant_invite", { invite_token: token })
      if (rpcError) throw rpcError
      notify("You're in", `Welcome to ${invite?.restaurant_name ?? "the team"}.`)
      router.replace("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not accept this invite."
      notify("Error", message)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboardWrap} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="people" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Team invite</Text>
          </View>

          {checking ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : !signedIn ? (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.bodyText}>Sign in or create an account to accept this invite.</Text>
                <Button
                  mode="contained"
                  onPress={() => router.push(`/login?redirect=${encodeURIComponent(redirectParam)}`)}
                  style={styles.primaryButton}
                  labelStyle={styles.buttonLabel}
                >
                  Sign In
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => router.push(`/sign-up?redirect=${encodeURIComponent(redirectParam)}`)}
                  style={styles.secondaryButton}
                >
                  Create Account
                </Button>
              </Card.Content>
            </Card>
          ) : error ? (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.errorText}>{error}</Text>
                <Button
                  mode="contained"
                  onPress={() => router.replace("/")}
                  style={styles.primaryButton}
                  labelStyle={styles.buttonLabel}
                >
                  Go to App
                </Button>
              </Card.Content>
            </Card>
          ) : invite ? (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.bodyText}>
                  You&apos;ve been invited to join{" "}
                  <Text style={styles.bodyTextBold}>{invite.restaurant_name ?? "a restaurant"}</Text> as{" "}
                  <Text style={styles.bodyTextBold}>{invite.role}</Text>.
                </Text>
                {accepting ? (
                  <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                ) : (
                  <Button
                    mode="contained"
                    onPress={handleAccept}
                    style={styles.primaryButton}
                    labelStyle={styles.buttonLabel}
                  >
                    Accept Invite
                  </Button>
                )}
              </Card.Content>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 32,
  },
  header: {
    marginBottom: 32,
    alignItems: "center",
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
  },
  card: {
    borderRadius: 20,
    elevation: 4,
    backgroundColor: colors.surface,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardContent: {
    padding: 24,
  },
  bodyText: {
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  bodyTextBold: {
    fontWeight: "700",
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryDark,
  },
  secondaryButton: {
    borderRadius: 14,
    marginTop: 12,
  },
  buttonLabel: {
    fontWeight: "700",
    fontSize: 16,
  },
  loader: {
    marginVertical: 8,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: "center",
    marginBottom: 16,
  },
})
