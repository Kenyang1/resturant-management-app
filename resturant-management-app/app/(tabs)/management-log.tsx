/**
 * Management Log tab — CRUD for operational notes (maintenance, compliance, incidents).
 * Data: Supabase table `management_log`.
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { MisoChatModal } from "@/components/miso-chat-modal"
import { Sheet } from "@/components/Sheet"
import { Skeleton } from "@/components/Skeleton"
import { confirmAction } from "@/lib/alert"
import { ManagementLogItem, useManagementLog } from "@/lib/hooks/useManagementLog"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
import { Image } from "expo-image"
import { useMemo, useState } from "react"
import { Keyboard, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Text, TextInput } from "react-native-paper"

type LogPresentation = {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  iconColor: string
  iconBackground: string
}

type OverviewMetric = {
  label: string
  value: number
  icon: keyof typeof Ionicons.glyphMap
}

/** User-facing date/time for log timestamps. */
function formatDate(isoString: string | null) {
  if (!isoString) return ""
  const date = new Date(isoString)
  const today = new Date()
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  if (isToday) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** Adds a lightweight category treatment without changing the stored log data. */
function getLogPresentation(item: ManagementLogItem): LogPresentation {
  const copy = `${item.title} ${item.description}`.toLowerCase()

  if (
    copy.includes("maintenance") ||
    copy.includes("repair") ||
    copy.includes("equipment") ||
    copy.includes("broken")
  ) {
    return {
      label: "Maintenance",
      icon: "construct-outline",
      iconColor: colors.managementDark,
      iconBackground: colors.statLogsBg,
    }
  }

  if (copy.includes("incident") || copy.includes("accident") || copy.includes("injury")) {
    return {
      label: "Incident",
      icon: "alert-circle-outline",
      iconColor: colors.error,
      iconBackground: "#FFF1EF",
    }
  }

  if (
    copy.includes("compliance") ||
    copy.includes("inspection") ||
    copy.includes("safety") ||
    copy.includes("temperature")
  ) {
    return {
      label: "Compliance",
      icon: "shield-checkmark-outline",
      iconColor: colors.primary,
      iconBackground: colors.surfaceWarm,
    }
  }

  return {
    label: "Operations",
    icon: "clipboard-outline",
    iconColor: colors.inventory,
    iconBackground: colors.statItemsBg,
  }
}

/** Client-side filter: title or description contains the search text (case-insensitive). */
function matchesSearch(item: ManagementLogItem, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = (item.title ?? "").toLowerCase()
  const description = (item.description ?? "").toLowerCase()
  return title.includes(q) || description.includes(q)
}

export default function ManagementLog() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { data: managementLog, loading, error, insert, update, remove } = useManagementLog()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<ManagementLogItem | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [chatVisible, setChatVisible] = useState(false)

  // Search does not hit the server — filters the in-memory list.
  const filteredLog = useMemo(
    () => managementLog.filter((item) => matchesSearch(item, searchQuery)),
    [managementLog, searchQuery]
  )

  const overviewMetrics = useMemo<OverviewMetric[]>(() => {
    const today = new Date()
    const matchesKeywords = (item: ManagementLogItem, keywords: string[]) => {
      const copy = `${item.title} ${item.description}`.toLowerCase()
      return keywords.some((keyword) => copy.includes(keyword))
    }

    return [
      {
        label: "Total logs",
        value: managementLog.length,
        icon: "clipboard-outline",
      },
      {
        label: "Issues",
        value: managementLog.filter((item) =>
          matchesKeywords(item, ["incident", "issue", "spill"])
        ).length,
        icon: "warning-outline",
      },
      {
        label: "Maintenance",
        value: managementLog.filter((item) =>
          matchesKeywords(item, ["repair", "maintenance", "equipment"])
        ).length,
        icon: "construct-outline",
      },
      {
        label: "Today",
        value: managementLog.filter((item) => {
          if (!item.created_at) return false
          const createdAt = new Date(item.created_at)
          return (
            createdAt.getFullYear() === today.getFullYear() &&
            createdAt.getMonth() === today.getMonth() &&
            createdAt.getDate() === today.getDate()
          )
        }).length,
        icon: "today-outline",
      },
    ]
  }, [managementLog])

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Management logs</Text>
            </View>
          </View>
          <Skeleton style={styles.summaryCard} />
          <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
          <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
          <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
        </View>
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
      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Management logs</Text>
            <Text style={styles.subtitle}>
              {managementLog.length} {managementLog.length === 1 ? "entry" : "entries"}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Operations overview</Text>
          <View style={styles.metricsRow}>
            {overviewMetrics.map((metric, index) => (
              <View
                key={metric.label}
                style={[styles.metric, index < overviewMetrics.length - 1 && styles.metricDivider]}
              >
                <Ionicons name={metric.icon} size={23} color="#FFFFFF" />
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricLabel} numberOfLines={1}>
                  {metric.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <TextInput
          mode="outlined"
          placeholder="Search management logs"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          outlineStyle={styles.searchOutline}
          contentStyle={styles.searchContent}
          left={<TextInput.Icon icon="magnify" color={colors.textSecondary} />}
          right={
            searchQuery.length > 0 ? (
              <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} />
            ) : undefined
          }
        />

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Ask Miso about management logs"
          onPress={() => setChatVisible(true)}
          style={styles.misoBanner}
          scaleTo={0.98}
        >
          <View style={styles.misoImageWrap}>
            <Image
              source={mascotImages.chat}
              style={styles.misoImage}
              contentFit="cover"
              accessibilityLabel="Miso assistant"
            />
          </View>
          <View style={styles.misoCopy}>
            <Text style={styles.misoTitle}>Need help reviewing your logs?</Text>
            <Text style={styles.misoText}>Miso can summarize recent activity and incidents.</Text>
            <View style={styles.misoButton}>
              <Ionicons name="help-circle" size={17} color="#FFFFFF" />
              <Text style={styles.misoButtonText}>Ask Miso</Text>
            </View>
          </View>
        </AnimatedPressable>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            {searchQuery.trim().length > 0 && (
              <Text style={styles.resultsCount}>
                {filteredLog.length} {filteredLog.length === 1 ? "result" : "results"}
              </Text>
            )}
          </View>

          {managementLog.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="document-text-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No management logs yet</Text>
              <Text style={styles.emptySubtext}>
                Add your first operational note to start the record.
              </Text>
              <AnimatedPressable
                accessibilityRole="button"
                onPress={openAddModal}
                style={styles.emptyButton}
                scaleTo={0.95}
              >
                <Text style={styles.emptyButtonText}>Add first log</Text>
              </AnimatedPressable>
            </View>
          ) : filteredLog.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>No matching logs</Text>
              <Text style={styles.emptySubtext}>Try a different search or clear the filter.</Text>
            </View>
          ) : (
            filteredLog.map((item) => {
              const presentation = getLogPresentation(item)

              return (
                <View key={item.id} style={styles.logCard}>
                  <View
                    style={[
                      styles.logIconWrap,
                      { backgroundColor: presentation.iconBackground },
                    ]}
                  >
                    <Ionicons name={presentation.icon} size={23} color={presentation.iconColor} />
                  </View>

                  <View style={styles.logMain}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemDescription} numberOfLines={2}>
                      {item.description || "No additional details."}
                    </Text>
                    <Text style={styles.logCategory}>{presentation.label}</Text>
                  </View>

                  <View style={styles.logTrailing}>
                    {item.created_at && (
                      <View style={styles.datePill}>
                        <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>
                      </View>
                    )}
                    <View style={styles.cardActions}>
                      <AnimatedPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.title}`}
                        onPress={() => openEditModal(item)}
                        style={styles.cardAction}
                        scaleTo={0.9}
                      >
                        <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                      </AnimatedPressable>
                      <AnimatedPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.title}`}
                        onPress={() => confirmDelete(item)}
                        style={styles.cardAction}
                        scaleTo={0.9}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.error} />
                      </AnimatedPressable>
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel="Add management log"
          onPress={openAddModal}
          style={styles.bottomAddButton}
          scaleTo={0.97}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.bottomAddButtonText}>Add log</Text>
        </AnimatedPressable>
      </ScrollView>

      <Sheet visible={modalVisible} onDismiss={closeModal}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons
                name={editingItem ? "create-outline" : "add"}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalEyebrow}>MANAGEMENT LOG</Text>
              <Text style={styles.modalTitle}>
                {editingItem ? "Edit entry" : "Add entry"}
              </Text>
            </View>
            <AnimatedPressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={closeModal}
              style={styles.modalClose}
              scaleTo={0.9}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </AnimatedPressable>
          </View>

          <Text style={styles.modalDescription}>
            Capture the details your team will need for the next shift.
          </Text>

          {saveError && <Text style={styles.saveErrorText}>{saveError}</Text>}

          <TextInput
            label="Title"
            value={formTitle}
            onChangeText={setFormTitle}
            mode="outlined"
            style={styles.modalInput}
            outlineStyle={styles.modalInputOutline}
            autoFocus
          />
          <TextInput
            label="Description"
            value={formDescription}
            onChangeText={setFormDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            style={[styles.modalInput, styles.descriptionInput]}
            outlineStyle={styles.modalInputOutline}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={closeModal}
              style={styles.cancelButton}
              contentStyle={styles.modalButtonContent}
              labelStyle={styles.cancelButtonText}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={styles.saveButton}
              contentStyle={styles.modalButtonContent}
              labelStyle={styles.saveButtonText}
            >
              {editingItem ? "Save changes" : "Add log"}
            </Button>
          </View>
        </ScrollView>
      </Sheet>

      <MisoChatModal visible={chatVisible} onDismiss={() => setChatVisible(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 18,
    gap: 14,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.55,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  summaryCard: {
    minHeight: 144,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: colors.primary,
    boxShadow: "0 4px 12px rgba(22, 108, 67, 0.12)",
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  metricsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 13,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  metricDivider: {
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.33)",
  },
  metricValue: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    marginTop: 3,
  },
  metricLabel: {
    maxWidth: "100%",
    fontSize: 9,
    fontWeight: "600",
    color: "rgba(255,255,255,0.84)",
    marginTop: 1,
  },
  searchInput: {
    height: 50,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchContent: {
    minHeight: 50,
  },
  misoBanner: {
    minHeight: 108,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
  },
  misoImageWrap: {
    width: 88,
    height: 88,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  misoImage: {
    width: "100%",
    height: "100%",
  },
  misoCopy: {
    flex: 1,
    minWidth: 0,
  },
  misoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  misoText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 3,
  },
  misoButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  misoButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  listSection: {
    gap: 10,
  },
  sectionHeader: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontVariant: ["tabular-nums"],
  },
  logCard: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 3px rgba(31, 55, 40, 0.06)",
  },
  skeletonLogCard: {
    minHeight: 92,
    borderWidth: 0,
  },
  logIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logCategory: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 5,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
    color: colors.textPrimary,
  },
  logTrailing: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 1,
  },
  datePill: {
    maxWidth: 86,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
  },
  itemDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 3,
  },
  itemDate: {
    fontSize: 10.5,
    fontWeight: "700",
    color: colors.primary,
    fontVariant: ["tabular-nums"],
  },
  cardActions: {
    flexDirection: "row",
    gap: 4,
  },
  cardAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptySubtext: {
    maxWidth: 280,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 5,
  },
  emptyButton: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: colors.primary,
    marginTop: 15,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  bottomAddButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.primary,
    boxShadow: "0 4px 10px rgba(22, 108, 67, 0.18)",
  },
  bottomAddButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  modalHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
    color: colors.primary,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: -0.25,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  modalDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 14,
    marginBottom: 16,
  },
  saveErrorText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.error,
    marginBottom: 14,
    backgroundColor: "#FFF1EF",
    padding: 11,
    borderRadius: 11,
  },
  modalInput: {
    backgroundColor: colors.surface,
    marginBottom: 13,
  },
  modalInputOutline: {
    borderRadius: 14,
    borderColor: colors.border,
  },
  descriptionInput: {
    minHeight: 116,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 999,
    borderColor: colors.border,
  },
  saveButton: {
    flex: 1.25,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  modalButtonContent: {
    minHeight: 46,
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
})
