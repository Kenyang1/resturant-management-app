/**
 * Creates a Supabase Auth account, then sends the user to the login screen (they sign in explicitly).
 */
import { notify } from "@/lib/alert"
import { supabase } from "@/lib/supabase"
import { useMobileLayout } from "@/lib/layout"
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

export default function SignUp() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSignUp = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      notify("Missing info", "Please fill out all fields.")
      return
    }
    if (password !== confirmPassword) {
      notify("Password mismatch", "Passwords do not match.")
      return
    }
    if (password.length < 6) {
      notify("Weak password", "Password must be at least 6 characters.")
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) throw error
      // With email confirmation enabled, signUp returns no session until the user
      // clicks the confirmation link — tell them that instead of implying they're done.
      if (data.session) {
        notify("Account created", "Your account is ready — sign in to get started.")
      } else {
        notify("Check your email", "We sent a confirmation link to your email. Confirm it, then sign in.")
      }
      router.replace("/login")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sign up failed."
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
            <Ionicons name="restaurant" size={40} color={colors.primary} />
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join us to manage your restaurant</Text>
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
            <TextInput
              label="Password"
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
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <Button
                mode="contained"
                onPress={handleSignUp}
                disabled={loading}
                style={styles.primaryButton}
              >
                Create Account
              </Button>
            )}
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.link}>Sign In</Text>
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  link: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
  },
})
