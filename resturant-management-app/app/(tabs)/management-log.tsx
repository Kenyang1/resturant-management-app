/**
 * Management Log tab — CRUD for operational notes (maintenance, compliance, incidents).
 * Data: Supabase table `management_log`.
 */
import { MascotBanner } from "@/components/MascotBanner"
import { confirmAction } from "@/lib/alert"
import { ManagementLogItem, useManagementLog } from "@/lib/hooks/useManagementLog"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import { useMemo, useState } from "react"
import { Image } from "expo-image"
import { StyleSheet, View, ScrollView, Modal, TouchableWithoutFeedback, Keyboard, Pressable } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Text, TextInput } from "react-native-paper"

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  text: string
}

/** User-facing date/time for log timestamps. */
function formatDate(isoString: string | null) {
  if (!isoString) return ""
  const date = new Date(isoString)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** Client-side filter: title or description contains the search text (case-insensitive). */
function matchesSearch(item: ManagementLogItem, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = (item.title ?? "").toLowerCase()
  const description = (item.description ?? "").toLowerCase()
  return title.includes(q) || description.includes(q)
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

  return "Demo mode: I can summarize recent logs and simple keyword trends. Full AI data answers coming soon."
}

export default function ManagementLog() {
  const { horizontal, scrollBottomPad, tabMascotHeight } = useMobileLayout()
  const { data: managementLog, loading, error, insert, update, remove } = useManagementLog()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<ManagementLogItem | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [chatVisible, setChatVisible] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi! I am your demo assistant. Ask me about recent logs, incidents, or maintenance.",
    },
  ])

  // Search does not hit the server — filters the in-memory list.
  const filteredLog = useMemo(
    () => managementLog.filter((item) => matchesSearch(item, searchQuery)),
    [managementLog, searchQuery]
  )

  function confirmDelete(item: ManagementLogItem) {
    confirmAction(
      "Delete Entry",
      `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
      "Delete",
      () => remove(item.id)
    )
  }

  function openAddModal() {
    setEditingItem(null)
    setFormTitle("")
    setFormDescription("")
    setSaveError(null)
    setModalVisible(true)
  }

  function openEditModal(item: ManagementLogItem) {
    setEditingItem(item)
    setFormTitle(item.title)
    setFormDescription(item.description)
    setSaveError(null)
    setModalVisible(true)
  }

  function closeModal() {
    Keyboard.dismiss()
    setModalVisible(false)
    setEditingItem(null)
    setFormTitle("")
    setFormDescription("")
    setSaveError(null)
  }

  async function handleSave() {
    if (!formTitle.trim()) return
    const payload = { title: formTitle.trim(), description: formDescription.trim() }
    try {
      setSaveError(null)
      if (editingItem) {
        await update(editingItem.id, payload)
      } else {
        await insert(payload)
      }
      closeModal()
    } catch (err) {
      setSaveError(getErrorMessage(err))
    }
  }

  function handleSendChat() {
    const prompt = chatInput.trim()
    if (!prompt) return

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text: prompt,
    }
    const assistantMessage: ChatMessage = {
      id: `${Date.now()}-assistant`,
      role: "assistant",
      text: getMockAssistantReply(prompt, managementLog),
    }

    setChatMessages((prev) => [...prev, userMessage, assistantMessage])
    setChatInput("")
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Text style={styles.loadingText}>Loading management logs...</Text>
      </SafeAreaView>
    )
  }
  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={[styles.mascotSection, { paddingHorizontal: horizontal }]}>
        <MascotBanner
          source={mascotImages.management}
          height={tabMascotHeight}
          accessibilityLabel="Chef cat mascot with management logbook"
        />
      </View>
      <View style={[styles.header, { paddingHorizontal: horizontal }]}>
        <Text style={styles.title} numberOfLines={1}>
          Management Log
        </Text>
        <Button
          mode="contained"
          onPress={openAddModal}
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
          labelStyle={styles.addButtonLabel}
          icon="plus"
          compact
        >
          Add
        </Button>
      </View>

      <View style={[styles.searchWrap, { paddingHorizontal: horizontal }]}>
        <TextInput
          mode="outlined"
          placeholder="Search title or description"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          outlineStyle={styles.searchOutline}
          left={<TextInput.Icon icon="magnify" />}
          right={
            searchQuery.length > 0 ? (
              <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} />
            ) : undefined
          }
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {managementLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No management logs yet</Text>
            <Text style={styles.emptySubtext}>Tap "Add Entry" to create one</Text>
          </View>
        ) : filteredLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching logs</Text>
            <Text style={styles.emptySubtext}>Try a different search or clear the filter</Text>
          </View>
        ) : (
          filteredLog.map((item) => (
            <Card key={item.id} style={styles.card}>
              <Card.Content style={styles.cardContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
                {item.created_at && (
                  <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
                )}
              </Card.Content>
              <Card.Actions style={styles.cardActions}>
                <Button mode="outlined" compact onPress={() => openEditModal(item)}>
                  Edit
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => confirmDelete(item)}
                  textColor={colors.error}
                >
                  Delete
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Full-screen dimmed overlay; tap outside closes. Inner TouchableWithoutFeedback stops taps on the card from bubbling to the backdrop. */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback onPress={closeModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>
            <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {editingItem ? "Edit Entry" : "Add Entry"}
                </Text>
                {saveError && (
                  <Text style={styles.saveErrorText}>{saveError}</Text>
                )}
                <TextInput
                  label="Title"
                  value={formTitle}
                  onChangeText={setFormTitle}
                  mode="outlined"
                  style={styles.modalInput}
                  autoFocus
                />
                <TextInput
                  label="Description"
                  value={formDescription}
                  onChangeText={setFormDescription}
                  mode="outlined"
                  multiline
                  numberOfLines={3}
                  style={styles.modalInput}
                />
                <View style={styles.modalActions}>
                  <Button mode="outlined" onPress={closeModal} style={[styles.modalButton, { marginRight: 12 }]}>
                    Cancel
                  </Button>
                  <Button mode="contained" onPress={handleSave} style={styles.modalButton}>
                    Save
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
        </View>
      </Modal>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open chatbot"
        style={styles.chatFab}
        onPress={() => setChatVisible(true)}
      >
        <Image
          source={mascotImages.chat}
          style={styles.chatFabImage}
          contentFit="cover"
          accessibilityLabel="Chatbot icon"
        />
      </Pressable>

      <Modal
        visible={chatVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback onPress={() => setChatVisible(false)}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>

          <TouchableWithoutFeedback>
            <View style={styles.chatModalContent}>
              <View style={styles.chatHeader}>
                <Text style={styles.chatTitle}>Assistant (Demo)</Text>
                <Button compact onPress={() => setChatVisible(false)}>
                  Close
                </Button>
              </View>
              <Text style={styles.chatSubtext}>Visualization mode: responses are simulated.</Text>

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
                        message.role === "user" ? styles.chatBubbleTextUser : styles.chatBubbleTextAssistant,
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
                  outlineStyle={styles.searchOutline}
                />
                <Button mode="contained" onPress={handleSendChat} style={styles.chatSendButton}>
                  Send
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mascotSection: {
    paddingTop: 8,
  },
  searchWrap: {
    paddingBottom: 12,
  },
  searchInput: {
    backgroundColor: colors.surface,
  },
  searchOutline: {
    borderRadius: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginRight: 4,
  },
  addButton: {
    borderRadius: 14,
    backgroundColor: colors.management,
    borderBottomWidth: 4,
    borderBottomColor: colors.managementDark,
    flexShrink: 0,
  },
  addButtonContent: {
    flexDirection: "row-reverse",
    paddingHorizontal: 10,
    minHeight: 40,
  },
  addButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  card: {
    marginBottom: 12,
    borderRadius: 16,
    elevation: 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  itemDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardActions: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textPrimary,
    marginBottom: 20,
  },
  saveErrorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 16,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalButton: {
    minWidth: 100,
  },
  chatFab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: "hidden",
    backgroundColor: colors.surface,
    elevation: 6,
  },
  chatFabImage: {
    width: "100%",
    height: "100%",
  },
  chatModalContent: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatTitle: {
    fontSize: 20,
    fontWeight: "bold",
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
  chatSendButton: {
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
})