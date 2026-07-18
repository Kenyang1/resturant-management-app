/**
 * Composes the shared `Skeleton` pulse primitive into a full-screen loading layout: a vertical
 * stack of blocks sized to match the real screen's shape, so loading reads as "content is
 * arriving" rather than a generic spinner.
 */
import { StyleSheet, View } from "react-native"
import { Skeleton } from "@/components/Skeleton"
import { radii } from "@/lib/theme"

type Block = {
  height: number
  width?: number | `${number}%`
  radius?: keyof typeof radii
}

type SkeletonScreenProps = {
  blocks: Block[]
  gap?: number
}

export function SkeletonScreen({ blocks, gap = 12 }: SkeletonScreenProps) {
  return (
    <View style={[styles.stack, { gap }]}>
      {blocks.map((block, index) => (
        <Skeleton
          key={index}
          style={{
            height: block.height,
            width: block.width ?? "100%",
            borderRadius: radii[block.radius ?? "lg"],
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  stack: {
    width: "100%",
  },
})
