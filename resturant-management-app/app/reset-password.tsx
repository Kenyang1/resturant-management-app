/**
 * Lands here from the Supabase password-reset email link (`?code=...`). We
 * exchange the code for a session ourselves — same on web and native — since
 * relying on the client's URL auto-detection can't tell "just exchanged a
 * recovery code" apart from "user already had a session" (see lib/supabase.web.ts).
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
import { Button, Card, Text, TextInput } from "react-native-paper"

export default function ResetPassword() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { code } = useLocalSearchParams<{ code?: string }>()
  const [checking, setChecking] = useState(true)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function establishSession() {
      try {
        if (!code) throw new Error("This reset link is invalid or has expired.")
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) throw error
        if (!cancelled) setChecking(false)
      } catch (err) {
        if (!cancelled) {
          setLinkError(err instanceof Error ? err.message : "This reset link is invalid or has expired.")
          setChecking(false)
        }
      }
    }
    establishSession()
    return () => {
      cancelled = true
    }
  }, [code])

  const handleSave = async () => {
    if (password.length < 6) {
      notify("Weak password", "Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      notify("Password mismatch", "Passwords do not match.")
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      notify("Password updated", "You're all set.")
      router.replace("/(tabs)")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not update password."
      notify("Error", message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              <Ionicons name="lock-closed" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Set new password</Text>
            {!checking && !linkError && (
              <Text style={styles.subtitle}>Choose a new password for your account</Text>
            )}
          </View>

          {checking ? (
            <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
          ) : linkError ? (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.errorText}>{linkError}</Text>
                <Button
                  mode="contained"
                  onPress={() => router.replace("/forgot-password")}
                  style={styles.primaryButton}
                  labelStyle={styles.buttonLabel}
                >
                  Request a New Link
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <Card style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <TextInput
                  label="New Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  secureTextEntry
                  autoComplete="password-new"
                  placeholder="At least 6 characters"
                  style={styles.input}
                />
                <TextInput
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  mode="outlined"
                  secureTextEntry
                  autoComplete="password-new"
                  style={styles.input}
                />
                {saving ? (
                  <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
                ) : (
                  <Button
                    mode="contained"
                    onPress={handleSave}
                    style={styles.primaryButton}
                    labelStyle={styles.buttonLabel}
                  >
                    Save New Password
                  </Button>
                )}
              </Card.Content>
            </Card>
          )}
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
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
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
  input: {
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderBottomWidth: 4,
    borderBottomColor: colors.primaryDark,
  },
  buttonLabel: {
    fontWeight: "700",
    fontSize: 16,
  },
  loader: {
    marginVertical: 24,
  },
  errorText: {
    fontSize: 15,
    color: colors.error,
    textAlign: "center",
    marginBottom: 16,
  },
})
