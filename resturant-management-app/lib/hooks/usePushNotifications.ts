/**
 * Registers this device for push notifications and stores its Expo push token
 * via the register_push_token() RPC (see the Milestone 6 push migration).
 *
 * No-ops on web (Expo's push service is native-only), on simulators/emulators
 * (no push hardware), and when no EAS projectId is configured yet — remote push
 * requires a development build tied to an EAS project (`eas init`), not Expo Go.
 */
import { supabase } from "@/lib/supabase"
import Constants from "expo-constants"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"
import { useEffect } from "react"
import { Platform } from "react-native"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

async function registerForPush() {
  if (Platform.OS === "web" || !Device.isDevice) return

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) {
    console.warn("Push registration skipped: no EAS projectId configured (run `eas init`).")
    return
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let status = existing
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync()
    status = req.status
  }
  if (status !== "granted") return

  const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId })
  const { error } = await supabase.rpc("register_push_token", {
    device_token: tokenData,
    device_platform: Platform.OS,
  })
  if (error) console.warn("Push token registration failed:", error.message)
}

/** Call once from a screen that only mounts when signed in (e.g. the tabs layout). */
export function usePushNotifications() {
  useEffect(() => {
    registerForPush().catch((err) => console.warn("Push registration error:", err))
  }, [])
}
