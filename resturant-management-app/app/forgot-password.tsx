/**
 * Requests a password-reset email via Supabase Auth. Always shows the same
 * success message regardless of whether the email exists, to avoid leaking
 * which addresses have accounts.
 */
import { notify } from "@/lib/alert"
import { getResetPasswordRedirectUrl } from "@/lib/authRedirect"
import { useMobileLayout } from "@/lib/layout"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Text, TextInput } from "react-native-paper"

export default function ForgotPassword() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) {
      notify("Missing info", "Please enter your email.")
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getResetPasswordRedirectUrl(),
      })
      if (error) throw error
      notify("Check your email", "If that address has an account, we sent a password reset link.")
      router.replace("/login")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not send reset email."
      notify("Error", message)
    } finally {
      setLoading(false)
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
              <Ionicons name="mail" size={40} color={colors.primary} />
            </View>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>We&apos;ll email you a link to set a new password</Text>
          </View>

          <Card style={styles.card}>
            <Card.Content style={styles.cardContent}>
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.input}
              />
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
              ) : (
                <Button
                  mode="contained"
                  onPress={handleSend}
                  style={styles.primaryButton}
                  labelStyle={styles.buttonLabel}
                >
                  Send Reset Link
                </Button>
              )}
            </Card.Content>
          </Card>

          <View style={styles.footer}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.link}>Back to Sign In</Text>
            </Pressable>
          </View>
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
  footer: {
    alignItems: "center",
    marginTop: 24,
  },
  link: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
})
