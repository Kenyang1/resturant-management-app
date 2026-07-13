/**
 * Email/password sign-in via Supabase Auth. On success, `router.replace("/")` re-runs the auth gate in `app/index.tsx`.
 */
import { notify } from "@/lib/alert"
import { supabase } from "@/lib/supabase"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import { router } from "expo-router"
import { Image } from "expo-image"
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

export default function Login() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      notify("Missing info", "Please enter your email and password.")
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      router.replace("/")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed."
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
          <View style={styles.heroStack}>
            <Image
              source={mascotImages.logo}
              style={styles.logoImage}
              contentFit="contain"
              accessibilityLabel="Restaurant mascot logo"
            />
            <Text style={styles.title}>Welcome back</Text>
          </View>
          <Text style={styles.subtitle}>Sign in to manage your restaurant</Text>
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
              autoComplete="password"
              style={styles.input}
            />
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
            ) : (
              <Button
                mode="contained"
                onPress={handleLogin}
                style={styles.primaryButton}
                labelStyle={styles.buttonLabel}
              >
                Sign In
              </Button>
            )}
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Pressable onPress={() => router.push("/sign-up")} hitSlop={8}>
            <Text style={styles.link}>Sign Up</Text>
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
  /** Cat overlaps the heading so it reads as sitting on “Welcome back”. */
  heroStack: {
    alignItems: "center",
    alignSelf: "stretch",
  },
  logoImage: {
    width: 280,
    height: 224,
    marginBottom: -40,
    zIndex: 2,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
    marginTop: -4,
    zIndex: 1,
    textAlign: "center",
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
