/**
 * Management Log tab — CRUD for operational notes (maintenance, compliance, incidents).
 * Data: Supabase table `management_log`.
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { EmptyState } from "@/components/EmptyState"
import { FormSheet } from "@/components/FormSheet"
import { MisoCallout } from "@/components/MisoCallout"
import { MisoChatModal } from "@/components/miso-chat-modal"
import { PrimaryAction } from "@/components/PrimaryAction"
import { ScreenHeader } from "@/components/ScreenHeader"
import { SearchField } from "@/components/SearchField"
import { Skeleton } from "@/components/Skeleton"
import { confirmAction } from "@/lib/alert"
import { ManagementLogItem, useManagementLog } from "@/lib/hooks/useManagementLog"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors, radii } from "@/lib/theme"
import { Ionicons } from "@expo/vector-icons"
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
  const { horizontal, scrollBottomPad, desktopFrameStyle } = useMobileLayout()
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
        <View style={desktopFrameStyle}>
          <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
            <ScreenHeader title="Management logs" />
            <Skeleton style={styles.summaryCard} />
            <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
            <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
            <Skeleton style={[styles.logCard, styles.skeletonLogCard]} />
          </View>
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
      <View style={desktopFrameStyle}>
        <ScrollView
          style={styles.scrollView}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <ScreenHeader
            title="Management logs"
            subtitle={`${managementLog.length} ${managementLog.length === 1 ? "entry" : "entries"}`}
          />

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

          <SearchField
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search management logs"
          />

          <MisoCallout
            image={mascotImages.logNote}
            title="Need help reviewing your logs?"
            subtitle="Miso can summarize recent activity and incidents."
            actionLabel="Ask Miso"
            actionIcon="help-circle"
            onPress={() => setChatVisible(true)}
            tone="warm"
          />

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
              <EmptyState
                image={mascotImages.logNote}
                title="No management logs yet"
                subtitle="Add your first operational note to start the record."
                actionLabel="Add first log"
                onAction={openAddModal}
              />
            ) : filteredLog.length === 0 ? (
              <EmptyState
                icon={<Ionicons name="search-outline" size={28} color={colors.primary} />}
                title="No matching logs"
                subtitle="Try a different search or clear the filter."
              />
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

          <PrimaryAction label="Add log" onPress={openAddModal} />
        </ScrollView>
      </View>

      <FormSheet
        visible={modalVisible}
        onDismiss={closeModal}
        icon={editingItem ? "create-outline" : "add"}
        title={editingItem ? "Edit entry" : "Add entry"}
        subtitle="Capture the details your team will need for the next shift."
      >
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
      </FormSheet>

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
  summaryCard: {
    minHeight: 144,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: colors.primary,
    boxShadow: "0 4px 12px rgba(22, 108, 67, 0.12)",
  },
  summaryTitle: {
    fontSize: 17,
    fontFamily: "Nunito_700Bold",
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
    fontFamily: "Nunito_800ExtraBold",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
    marginTop: 3,
  },
  metricLabel: {
    maxWidth: "100%",
    fontSize: 9,
    fontFamily: "Nunito_700Bold",
    color: "rgba(255,255,255,0.84)",
    marginTop: 1,
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
    fontFamily: "Nunito_800ExtraBold",
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  resultsCount: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
    backgroundColor: colors.surfaceWarm,
    borderRadius: radii.pill,
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
    borderRadius: radii.md,
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
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  logMain: {
    flex: 1,
    minWidth: 0,
  },
  logCategory: {
    fontSize: 10.5,
    fontFamily: "Nunito_700Bold",
    color: colors.primary,
    marginTop: 5,
  },
  itemTitle: {
    fontSize: 15,
    fontFamily: "Nunito_700Bold",
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
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceWarm,
  },
  itemDescription: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
    marginTop: 3,
  },
  itemDate: {
    fontSize: 10.5,
    fontFamily: "Nunito_700Bold",
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
    borderRadius: radii.sm,
    backgroundColor: colors.background,
  },
  modalInput: {
    backgroundColor: colors.surface,
    marginBottom: 13,
  },
  modalInputOutline: {
    borderRadius: radii.md,
    borderColor: colors.border,
  },
  descriptionInput: {
    minHeight: 116,
  },
  saveErrorText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Nunito_600SemiBold",
    color: colors.error,
    marginBottom: 14,
    backgroundColor: "#FBE7E5",
    padding: 11,
    borderRadius: radii.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderRadius: radii.pill,
    borderColor: colors.border,
  },
  saveButton: {
    flex: 1.25,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  modalButtonContent: {
    minHeight: 46,
  },
  cancelButtonText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
    color: colors.textSecondary,
  },
  saveButtonText: {
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
})
