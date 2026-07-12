/**
 * App entry: waits for Firebase auth to initialize, then sends the user to the main tabs or login.
 * This file is the default route "/" — see Root `_layout.tsx` for the full stack.
 */
import { auth } from "@/lib/firebase";
import { colors } from "@/lib/theme";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { User } from "firebase/auth";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "react-native-paper";

export default function Index() {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)


  const onAuthStateChangedListener = (user: User | null) => {
    setUser(user)
    setInitializing(false)
  }

  useEffect(() => {
    // Subscribe once; cleanup unsubscribes on unmount.
    const subscriber = auth.onAuthStateChanged(onAuthStateChangedListener);
    return subscriber;
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

  return <Redirect href={user ? "/(tabs)" : "/login"} />
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
