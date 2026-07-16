import * as Linking from "expo-linking"
import { Platform } from "react-native"

/** Cross-platform redirect target for Supabase's password-reset email link. */
export function getResetPasswordRedirectUrl() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`
  }
  return Linking.createURL("/reset-password")
}

/** Cross-platform shareable link for a team invite. */
export function getAcceptInviteUrl(token: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.origin}/accept-invite?token=${token}`
  }
  return Linking.createURL("/accept-invite", { queryParams: { token } })
}
