/** Circular progress ring (desktop "Today's progress" widget) built with react-native-svg. */
import { StyleSheet, Text, View } from "react-native"
import Svg, { Circle } from "react-native-svg"
import { colors } from "@/lib/theme"

type ProgressRingProps = {
  progress: number
  size?: number
  strokeWidth?: number
  label: string
  caption: string
}

export function ProgressRing({ progress, size = 108, strokeWidth = 10, label, caption }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(1, progress))
  const dashOffset = circumference * (1 - clamped)

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.softSage}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.centerCopy}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  svg: {
    marginBottom: 4,
  },
  centerCopy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    textAlign: "center",
  },
  caption: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.primaryDark,
  },
})
