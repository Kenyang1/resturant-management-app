import { Sheet } from "@/components/Sheet"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { useRef, useState } from "react"
import { ScrollView, StyleSheet, View } from "react-native"
import { ActivityIndicator, Button, Text, TextInput } from "react-native-paper"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

type MisoChatModalProps = {
  visible: boolean
  onDismiss: () => void
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi, I'm Miso! Ask me anything about your restaurant — stock levels, recent spending, open tasks, or what's in the logs.",
}

/** Shared chat UI for every Ask Miso entry point. Answers come from the
 * miso-chat Edge Function, which reads the caller's restaurant data under
 * their own RLS and asks Claude. */
export function MisoChatModal({ visible, onDismiss }: MisoChatModalProps) {
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([WELCOME])
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  async function handleSendChat() {
    const prompt = chatInput.trim()
    if (!prompt || sending) return

    const userMessage: ChatMessage = { id: `${Date.now()}-user`, role: "user", text: prompt }
    const history = [...chatMessages, userMessage]
    setChatMessages(history)
    setChatInput("")
    setSending(true)

    try {
      const { data, error } = await supabase.functions.invoke("miso-chat", {
        body: {
          // The welcome bubble is UI-only; the function expects real turns.
          messages: history
            .filter((m) => m.id !== "welcome")
            .map((m) => ({ role: m.role, content: m.text })),
        },
      })
      const reply: string | undefined = data?.reply
      if (error || !reply) throw error ?? new Error("Empty reply")

      setChatMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-assistant`, role: "assistant", text: reply },
      ])
    } catch (err) {
      console.warn("Miso chat failed:", err)
      setChatMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: "Sorry — I couldn't reach the kitchen brain just now. Please try again in a moment.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet visible={visible} onDismiss={onDismiss}>
      <View style={styles.chatHeader}>
        <Text style={styles.chatTitle}>Ask Miso</Text>
        <Button compact onPress={onDismiss}>
          Close
        </Button>
      </View>
      <Text style={styles.chatSubtext}>
        Miso can see your restaurant&apos;s inventory, finances, tasks, and logs.
      </Text>

      <ScrollView
        ref={scrollRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatScrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {chatMessages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.chatBubble,
              message.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant,
            ]}
          >
            <Text
              style={[
                styles.chatBubbleText,
                message.role === "user"
                  ? styles.chatBubbleTextUser
                  : styles.chatBubbleTextAssistant,
              ]}
            >
              {message.text}
            </Text>
          </View>
        ))}
        {sending && (
          <View style={[styles.chatBubble, styles.chatBubbleAssistant, styles.thinkingBubble]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.chatBubbleText, styles.chatBubbleTextAssistant]}>
              Miso is thinking…
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.chatComposer}>
        <TextInput
          mode="outlined"
          placeholder="Ask a question..."
          value={chatInput}
          onChangeText={setChatInput}
          onSubmitEditing={handleSendChat}
          style={styles.chatInput}
          outlineStyle={styles.chatInputOutline}
        />
        <Button
          mode="contained"
          onPress={handleSendChat}
          disabled={sending}
          style={styles.chatSendButton}
        >
          Send
        </Button>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  chatSubtext: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  chatScroll: {
    maxHeight: 300,
  },
  chatScrollContent: {
    gap: 10,
    paddingBottom: 6,
  },
  chatBubble: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: "90%",
  },
  chatBubbleAssistant: {
    backgroundColor: colors.background,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatBubbleUser: {
    backgroundColor: colors.primary,
    alignSelf: "flex-end",
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatBubbleTextAssistant: {
    color: colors.textPrimary,
  },
  chatBubbleTextUser: {
    color: "#FFFFFF",
  },
  chatComposer: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  chatInputOutline: {
    borderRadius: 12,
  },
  chatSendButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
})
