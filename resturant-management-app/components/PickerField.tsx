/**
 * Native date/time field: tapping it opens the system picker instead of asking people to type
 * a date or time by hand. On iOS the picker component has no dialog chrome of its own, so it's
 * presented inside the app's bottom Sheet; on Android the native module already owns a dialog,
 * so we invoke it directly via the imperative API instead of wrapping it in anything.
 */
import { Ionicons } from "@expo/vector-icons"
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker"
import { useState } from "react"
import { Platform, StyleSheet, Text, View } from "react-native"
import { Button } from "react-native-paper"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { Sheet } from "@/components/Sheet"
import { colors } from "@/lib/theme"

type PickerMode = "date" | "time"

type PickerFieldProps = {
  label: string
  value: Date
  onChange: (date: Date) => void
  mode: PickerMode
  minimumDate?: Date
}

function formatValue(value: Date, mode: PickerMode) {
  if (mode === "date") {
    return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }
  return value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

export function PickerField({ label, value, onChange, mode, minimumDate }: PickerFieldProps) {
  const [sheetVisible, setSheetVisible] = useState(false)

  function openPicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value,
        mode,
        minimumDate,
        onChange: (event, selected) => {
          if (event.type === "set" && selected) onChange(selected)
        },
      })
    } else {
      setSheetVisible(true)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <AnimatedPressable style={styles.field} onPress={openPicker} scaleTo={0.98}>
        <Ionicons
          name={mode === "date" ? "calendar-outline" : "time-outline"}
          size={18}
          color={colors.primary}
        />
        <Text style={styles.value}>{formatValue(value, mode)}</Text>
      </AnimatedPressable>

      {Platform.OS === "ios" && (
        <Sheet visible={sheetVisible} onDismiss={() => setSheetVisible(false)}>
          <Text style={styles.sheetTitle}>{label}</Text>
          <DateTimePicker
            value={value}
            mode={mode}
            display={mode === "date" ? "inline" : "spinner"}
            onChange={(event, selected) => {
              if (selected) onChange(selected)
            }}
            minimumDate={minimumDate}
            accentColor={colors.primary}
          />
          <Button
            mode="contained"
            onPress={() => setSheetVisible(false)}
            style={styles.doneButton}
          >
            Done
          </Button>
        </Sheet>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  field: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  doneButton: {
    marginTop: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
})
