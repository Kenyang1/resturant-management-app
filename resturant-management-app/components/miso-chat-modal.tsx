import type { ManagementLogItem } from "@/lib/hooks/useManagementLog"
import { colors } from "@/lib/theme"
import { useState } from "react"
import { Modal, ScrollView, StyleSheet, TouchableWithoutFeedback, View } from "react-native"
import { Button, Text, TextInput } from "react-native-paper"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

type MisoChatModalProps = {
  visible: boolean
  onDismiss: () => void
  managementLog: ManagementLogItem[]
}

function getMockAssistantReply(question: string, entries: ManagementLogItem[]) {
  const q = question.trim().toLowerCase()
  if (!q) return "Ask me about low stock, incidents, or recent management activity."

  if (q.includes("recent") || q.includes("latest")) {
    const recent = entries.slice(0, 3)
    if (recent.length === 0) return "No recent management entries found yet."
    const summary = recent.map((item) => item.title).join(", ")
    return `Recent highlights: ${summary}.`
  }

  if (q.includes("incident")) {
    const incidentCount = entries.filter((item) =>
      `${item.title} ${item.description}`.toLowerCase().includes("incident")
    ).length
    return incidentCount > 0
      ? `I found ${incidentCount} incident-related log entries in the current list.`
      : "I do not see incident-related entries yet in the current list."
  }

  if (q.includes("maintenance")) {
    const maintenanceCount = entries.filter((item) =>
      `${item.title} ${item.description}`.toLowerCase().includes("maintenance")
    ).length
    return `Maintenance-related entries: ${maintenanceCount}.`
  }

  return "Demo mode: Miso can summarize recent logs and simple keyword trends. Full AI data answers coming soon."
}

/** Shared presentation and mock-response behavior for every Ask Miso entry point. */
export function MisoChatModal({ visible, onDismiss, managementLog }: MisoChatModalProps) {
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi, I'm Miso! Ask me about recent logs, incidents, or maintenance.",
    },
  ])

  function handleSendChat() {
    const prompt = chatInput.trim()
    if (!prompt) return

    const now = Date.now()
    const userMessage: ChatMessage = {
      id: `${now}-user`,
      role: "user",
      text: prompt,
    }
    const assistantMessage: ChatMessage = {
      id: `${now}-assistant`,
      role: "assistant",
      text: getMockAssistantReply(prompt, managementLog),
    }

    setChatMessages((prev) => [...prev, userMessage, assistantMessage])
    setChatInput("")
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <View style={StyleSheet.absoluteFill}>
          <TouchableWithoutFeedback onPress={onDismiss}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </View>

        <TouchableWithoutFeedback>
          <View style={styles.chatModalContent}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Ask Miso</Text>
              <Button compact onPress={onDismiss}>
                Close
              </Button>
            </View>
            <Text style={styles.chatSubtext}>
              Demo mode — Miso&apos;s responses are simulated for now.
            </Text>

            <ScrollView
              style={styles.chatScroll}
              contentContainerStyle={styles.chatScrollContent}
              showsVerticalScrollIndicator={false}
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
            </ScrollView>

            <View style={styles.chatComposer}>
              <TextInput
                mode="outlined"
                placeholder="Ask a question..."
                value={chatInput}
                onChangeText={setChatInput}
                style={styles.chatInput}
                outlineStyle={styles.chatInputOutline}
              />
              <Button mode="contained" onPress={handleSendChat} style={styles.chatSendButton}>
                Send
              </Button>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  chatModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.border,
  },
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
