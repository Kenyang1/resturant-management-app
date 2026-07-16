/**
 * Bottom tab navigator: Home, Inventory, Tasks, Finance, Management logs, Profile. Header is hidden; each tab screen sets its own UI.
 */
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { colors } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Base height for icons + labels (excluding home-indicator inset). */
const TAB_BAR_CONTENT_HEIGHT = 62;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Tabs only mount when signed in, so this registers the device for the right user.
  usePushNotifications();
  const bottomInset = Platform.OS === "ios" ? insets.bottom : Math.max(insets.bottom, 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navActive,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarStyle: {
          backgroundColor: colors.navBackground,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 7,
          paddingBottom: bottomInset,
          // Fixed height omitted the home-indicator area on iPhone — labels were clipped.
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        },
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 13,
          fontFamily: "Nunito_600SemiBold",
        },
        tabBarIconStyle: { marginBottom: 1 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="inventory-log"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "checkbox" : "checkbox-outline"} color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: "Finance",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="management-log"
        options={{
          title: "Logs",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "document-text" : "document-text-outline"} color={color} size={size - 1} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} color={color} size={size - 1} />
          ),
        }}
      />
    </Tabs>
  );
}
