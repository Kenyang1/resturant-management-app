/**
 * Shown when no route matches (unknown URL). Offers a link back to login.
 */
import { colors } from "@/lib/theme";
import { Link, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops! Not Found" }} />
      <View style={styles.container}>
        <Ionicons name="restaurant-outline" size={64} color={colors.primary} style={styles.icon} />
        <Text style={styles.title}>Page Not Found</Text>
        <Text style={styles.subtitle}>Looks like this dish isn't on the menu</Text>
        <Link href="/login" style={styles.button}>
          Back to Login
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  button: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.primary,
    textDecorationLine: "underline",
  },
});
