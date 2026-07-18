/**
 * App entry: waits for Supabase auth to initialize, then sends the user to the main tabs or login.
 * This file is the default route "/" — see Root `_layout.tsx` for the full stack.
 */
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native-paper";

export default function Index() {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    // onAuthStateChange fires immediately with the current session, so no separate getSession() call is needed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setInitializing(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (initializing) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
        <Ionicons name="restaurant" size={48} color={colors.primary} style={styles.logo} />
        <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    )
  }

  if (session) return <Redirect href="/(tabs)" />
  // The native phone app skips straight to sign-in; only the web build shows a landing page first.
  return <Redirect href={Platform.OS === "web" ? "/landing" : "/login"} />
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    marginBottom: 16,
  },
  loader: {
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
})
