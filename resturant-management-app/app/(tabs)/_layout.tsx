/**
 * Bottom tab navigator: Home, Inventory, Tasks, Logs, More (5 visible destinations, matching the
 * mockup). Finance and Profile stay fully registered/deep-linkable routes — Finance is hidden
 * from the tab bar via `href: null` (still reachable from Home/More), and the Profile screen is
 * relabeled "More" since that screen now hosts the More-hub content. Header is hidden; each tab
 * screen sets its own UI. On desktop web this same route tree is instead framed by a persistent
 * left sidebar (see DesktopSidebar) — `<Slot />` renders whichever tab route is active without
 * imposing the bottom-tabs chrome.
 */
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { DesktopTopBar } from "@/components/DesktopTopBar";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";
import { useIsDesktopWeb } from "@/lib/layout";
import { colors } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Slot, Tabs } from "expo-router";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Base height for icons + labels (excluding home-indicator inset). */
const TAB_BAR_CONTENT_HEIGHT = 62;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  // Tabs only mount when signed in, so this registers the device for the right user.
  usePushNotifications();
  const isDesktop = useIsDesktopWeb();
  const bottomInset = Platform.OS === "ios" ? insets.bottom : Math.max(insets.bottom, 8);

  if (isDesktop) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.background }}>
        <DesktopSidebar />
        <View style={{ flex: 1, minWidth: 0 }}>
          <DesktopTopBar />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Slot />
          </View>
        </View>
      </View>
    );
  }

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
          // Hidden from the visible tab bar (More hub + Home both link here) but the route
          // stays fully registered and deep-linkable.
          href: null,
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
          title: "More",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline"}
              color={color}
              size={size - 1}
            />
          ),
        }}
      />
    </Tabs>
  );
}
