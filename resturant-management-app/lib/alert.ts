/**
 * React Native's Alert.alert renders nothing on Expo web — no dialog, no window.alert,
 * no visible fallback. These helpers bridge to window.alert/confirm on web and use
 * Alert.alert natively, so notifications and confirmations actually appear everywhere.
 */
import { Alert, Platform } from "react-native"

export function notify(title: string, message?: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.alert(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm()
    return
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ])
}
