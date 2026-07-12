/**
 * Decorative cat image strip used at the top of several tab screens.
 * Height comes from `useMobileLayout` so smaller phones get a shorter banner.
 */
import { colors } from "@/lib/theme"
import { Image } from "expo-image"
import type { ImageSourcePropType } from "react-native"
import { StyleSheet, View } from "react-native"

type Props = {
  source: ImageSourcePropType
  /** Total row height; image scales inside with contentFit contain */
  height?: number
  accessibilityLabel?: string
}

export function MascotBanner({
  source,
  height = 150,
  accessibilityLabel = "Chef cat mascot",
}: Props) {
  return (
    <View style={[styles.wrap, { height }]}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={200}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignSelf: "stretch",
    maxWidth: "100%",
    marginBottom: 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
})
