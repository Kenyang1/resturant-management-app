import { Platform, Share } from "react-native"

/** Copies to the clipboard on web (no native Share sheet there); opens the native share sheet elsewhere. */
export async function shareOrCopyLink(message: string, url: string): Promise<"copied" | "shared"> {
  if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(url)
    return "copied"
  }
  await Share.share({ message: `${message}\n${url}` })
  return "shared"
}
