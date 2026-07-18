/** Restyled search input shared by Inventory/Finance/Logs. */
import { StyleSheet, View } from "react-native"
import { TextInput } from "react-native-paper"
import { colors, radii } from "@/lib/theme"

type SearchFieldProps = {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
}

export function SearchField({ value, onChangeText, placeholder = "Search" }: SearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <TextInput
        mode="outlined"
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        outlineStyle={styles.outline}
        contentStyle={styles.content}
        left={<TextInput.Icon icon="magnify" color={colors.textSecondary} />}
        right={
          value.length > 0 ? (
            <TextInput.Icon icon="close" onPress={() => onChangeText("")} />
          ) : undefined
        }
        theme={{ colors: { primary: colors.primary, outline: colors.border } }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
  },
  outline: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    minHeight: 52,
  },
})
