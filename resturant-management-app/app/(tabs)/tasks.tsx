/**
 * Tasks tab — restaurant-shared checklist. My tasks / Team / Completed filters,
 * progress bar, assignee + due time per task.
 * Data: Supabase table tasks, joined client-side against restaurant_members for names.
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { MisoChatModal } from "@/components/miso-chat-modal"
import { PickerField } from "@/components/PickerField"
import { Sheet } from "@/components/Sheet"
import { Skeleton } from "@/components/Skeleton"
import { confirmAction, notify } from "@/lib/alert"
import { ChecklistTemplate, useChecklistTemplates } from "@/lib/hooks/useChecklistTemplates"
import { useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { useShiftHandoffs } from "@/lib/hooks/useShiftHandoffs"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { Task, useTasks } from "@/lib/hooks/useTasks"
import { useMobileLayout } from "@/lib/layout"
import { dispatchPushEvent } from "@/lib/notifications"
import { mascotImages } from "@/lib/mascotImages"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { Image } from "expo-image"
import { useEffect, useMemo, useState } from "react"
import { Keyboard, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Checkbox, Chip, Icon, ProgressBar, Text, TextInput } from "react-native-paper"

type FilterTab = "mine" | "team" | "completed"

const CATEGORY_LABEL: Record<string, string> = {
  opening: "Opening",
  closing: "Closing",
  food_safety: "Food Safety",
  other: "Checklist",
}

const FILTER_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "mine", label: "My tasks" },
  { value: "team", label: "Team" },
  { value: "completed", label: "Completed" },
]

function formatDue(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  )
}

function formatNoteTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/** "YYYY-MM-DD HH:MM" (the format `due_at` is edited in) <-> Date, for the picker fields. */
function parseFormDue(formDue: string): Date {
  if (!formDue.trim()) return roundToNextHour(new Date())
  const parsed = new Date(formDue.trim().replace(" ", "T"))
  return isNaN(parsed.getTime()) ? roundToNextHour(new Date()) : parsed
}

function formatFormDue(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const h = String(d.getHours()).padStart(2, "0")
  const mi = String(d.getMinutes()).padStart(2, "0")
  return `${y}-${mo}-${day} ${h}:${mi}`
}

function roundToNextHour(d: Date): Date {
  const next = new Date(d)
  next.setMinutes(0, 0, 0)
  next.setHours(next.getHours() + 1)
  return next
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function MemberAvatar({
  name,
  avatarUrl,
  size = 32,
}: {
  name: string
  avatarUrl: string | null | undefined
  size?: number
}) {
  return (
    <View
      style={[
        styles.memberAvatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={name + " profile photo"}
        />
      ) : (
        <Text style={[styles.memberAvatarInitials, { fontSize: size <= 28 ? 10 : 12 }]}>
          {getInitials(name)}
        </Text>
      )}
    </View>
  )
}

export default function TasksScreen() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { data: tasks, loading, error, insert, update, remove, refetch: refetchTasks } = useTasks()
  const { data: members } = useRestaurantMembers()
  const { data: templates, startChecklist } = useChecklistTemplates()
  const { data: handoffs, insert: insertHandoff, update: updateHandoff } = useShiftHandoffs()
  const [userId, setUserId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>("mine")
  const [modalVisible, setModalVisible] = useState(false)
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formAssignee, setFormAssignee] = useState<string | null>(null)
  const [formDue, setFormDue] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null)
  const [handoffNote, setHandoffNote] = useState("")
  const [postingHandoff, setPostingHandoff] = useState(false)
  const [chatVisible, setChatVisible] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  async function handleStartChecklist(template: ChecklistTemplate) {
    setStartingTemplateId(template.id)
    try {
      await startChecklist(template, userId)
      await refetchTasks()
      notify(
        "Checklist started",
        template.checklist_template_items.length + " tasks added to My tasks."
      )
      setFilter("mine")
    } catch (err) {
      notify("Error", getErrorMessage(err))
    } finally {
      setStartingTemplateId(null)
    }
  }

  async function handlePostHandoff() {
    if (!handoffNote.trim()) return
    setPostingHandoff(true)
    try {
      await insertHandoff({ note: handoffNote.trim() })
      setHandoffNote("")
    } catch (err) {
      notify("Error", getErrorMessage(err))
    } finally {
      setPostingHandoff(false)
    }
  }

  async function toggleHandoffResolved(handoffId: string, resolved: boolean) {
    try {
      await updateHandoff(handoffId, { resolved: !resolved })
    } catch (err) {
      notify("Error", getErrorMessage(err))
    }
  }

  function memberFor(assigneeId: string | null) {
    return members.find((m) => m.user_id === assigneeId)
  }

  const incompleteTasks = tasks.filter((t) => t.status === "pending")
  const completedTasks = tasks.filter((t) => t.status === "completed")
  const completedCount = completedTasks.length
  const totalCount = tasks.length
  const progress = totalCount > 0 ? completedCount / totalCount : 0

  const visibleTasks = useMemo(() => {
    if (filter === "mine") return incompleteTasks.filter((t) => t.assigned_to === userId)
    if (filter === "team") return incompleteTasks.filter((t) => t.assigned_to !== userId)
    return completedTasks
  }, [filter, incompleteTasks, completedTasks, userId])

  async function toggleComplete(task: Task) {
    try {
      if (task.status === "completed") {
        await update(task.id, { status: "pending", completed_at: null, completed_by: null })
      } else {
        await update(task.id, {
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: userId,
        })
      }
    } catch (err) {
      notify("Error", getErrorMessage(err))
    }
  }

  function confirmDelete(task: Task) {
    confirmAction(
      "Delete task",
      'Remove "' + task.title + '"?',
      "Delete",
      () => void remove(task.id)
    )
  }

  function openAddModal() {
    setFormTitle("")
    setFormDescription("")
    setFormAssignee(userId)
    setFormDue("")
    setSaveError(null)
    setModalVisible(true)
  }

  function closeModal() {
    Keyboard.dismiss()
    setModalVisible(false)
  }

  async function handleSave() {
    if (!formTitle.trim()) return
    const dueIso = formDue.trim() ? parseFormDue(formDue).toISOString() : null
    try {
      setSaveError(null)
      const created = await insert({
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        assigned_to: formAssignee,
        due_at: dueIso,
      })
      if (created.assigned_to && created.assigned_to !== userId) {
        dispatchPushEvent({ type: "task_assigned", task_id: created.id })
      }
      closeModal()
    } catch (err) {
      setSaveError(getErrorMessage(err))
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={[styles.topContent, { paddingHorizontal: horizontal }]}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>
                Shift tasks
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
          <Skeleton style={[styles.taskCard, styles.skeletonTaskCard]} />
          <Skeleton style={[styles.taskCard, styles.skeletonTaskCard]} />
          <Skeleton style={[styles.taskCard, styles.skeletonTaskCard]} />
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

  const progressPercent = totalCount > 0 ? Math.round(progress * 100) : 0
  const taskSectionTitle = filter === "completed" ? "Completed" : "In progress"

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={[styles.topContent, { paddingHorizontal: horizontal }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              Shift tasks
            </Text>
            <Text style={styles.progressLabel}>
              {completedCount} of {totalCount} complete
            </Text>
          </View>
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

        <View style={styles.progressRow}>
          <ProgressBar progress={progress} color={colors.tasks} style={styles.progressBar} />
          <Text style={styles.progressPct}>{progressPercent}%</Text>
        </View>

        <View accessibilityRole="tablist" style={styles.filterRow}>
          {FILTER_OPTIONS.map((option) => {
            const selected = filter === option.value
            return (
              <AnimatedPressable
                key={option.value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFilter(option.value)}
                style={[styles.filterButton, selected && styles.filterButtonSelected]}
                scaleTo={0.96}
              >
                <Text style={[styles.filterButtonText, selected && styles.filterButtonTextSelected]}>
                  {option.label}
                </Text>
              </AnimatedPressable>
            )
          })}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeadingRow}>
          <Text style={styles.sectionHeading}>{taskSectionTitle}</Text>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{visibleTasks.length}</Text>
          </View>
        </View>

        {visibleTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Icon
                source={filter === "completed" ? "check-circle-outline" : "clipboard-check-outline"}
                size={24}
                color={colors.tasks}
              />
            </View>
            <Text style={styles.emptyText}>
              {filter === "completed" ? "No completed tasks yet" : "No tasks here"}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === "mine" ? 'Tap "Add" to create one' : "Nothing to show"}
            </Text>
          </View>
        ) : (
          visibleTasks.map((task) => {
            const assignee = memberFor(task.assigned_to)
            const assigneeName = assignee?.display_name ?? "Unassigned"
            const due = formatDue(task.due_at)
            const completed = task.status === "completed"

            return (
              <View key={task.id} style={[styles.taskCard, completed && styles.taskCardCompleted]}>
                <View style={styles.taskRow}>
                  <View style={styles.checkboxWrap}>
                    <Checkbox
                      status={completed ? "checked" : "unchecked"}
                      onPress={() => toggleComplete(task)}
                      color={colors.tasks}
                      uncheckedColor={colors.textMuted}
                    />
                  </View>

                  <AnimatedPressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: completed }}
                    onPress={() => toggleComplete(task)}
                    style={styles.taskTextCol}
                    scaleTo={0.99}
                  >
                    <Text
                      style={[styles.taskTitle, completed && styles.taskTitleDone]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>
                    <View style={styles.taskMetaRow}>
                      <View style={styles.assigneeRow}>
                        <MemberAvatar
                          name={assigneeName}
                          avatarUrl={assignee?.avatar_url}
                          size={32}
                        />
                        <Text style={styles.taskMeta} numberOfLines={1}>
                          {assigneeName}
                        </Text>
                      </View>
                      {due && (
                        <View style={styles.duePill}>
                          <Icon source="calendar-blank-outline" size={15} color={colors.management} />
                          <Text style={styles.taskDue} numberOfLines={1}>
                            {due}
                          </Text>
                        </View>
                      )}
                    </View>
                  </AnimatedPressable>

                  <AnimatedPressable
                    accessibilityRole="button"
                    accessibilityLabel={"Delete " + task.title}
                    onPress={() => confirmDelete(task)}
                    hitSlop={3}
                    style={styles.taskDeleteButton}
                    scaleTo={0.9}
                  >
                    <Icon source="trash-can-outline" size={19} color={colors.textMuted} />
                  </AnimatedPressable>
                </View>
              </View>
            )
          })
        )}

        {filter === "completed" && (
          <AnimatedPressable
            accessibilityRole="button"
            accessibilityLabel="Ask Miso for help with a shift note"
            onPress={() => setChatVisible(true)}
            style={styles.misoBanner}
            scaleTo={0.98}
          >
            <View style={styles.misoImageWrap}>
              <Image
                source={mascotImages.chat}
                style={styles.misoImage}
                contentFit="cover"
                accessibilityLabel="Miso, the chef cat assistant"
              />
            </View>
            <View style={styles.misoCopy}>
              <Text style={styles.misoPrompt}>Need help writing a shift note?</Text>
              <View style={styles.misoAction}>
                <Icon source="help-circle" size={17} color="#FFFFFF" />
                <Text style={styles.misoActionText}>Ask Miso</Text>
              </View>
            </View>
            <Icon source="chevron-right" size={22} color={colors.tasks} />
          </AnimatedPressable>
        )}

        {templates.length > 0 && (
          <View style={styles.checklistsSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>Checklists</Text>
              <Text style={styles.sectionHint}>Start a routine</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.checklistsRow}
            >
              {templates.map((template) => (
                <View key={template.id} style={styles.checklistCard}>
                  <View style={styles.checklistCardTop}>
                    <View style={styles.checklistIcon}>
                      <Icon source="clipboard-check-outline" size={19} color={colors.tasks} />
                    </View>
                    <Text style={styles.checklistCategory}>
                      {CATEGORY_LABEL[template.category] ?? "Checklist"}
                    </Text>
                  </View>
                  <Text style={styles.checklistName} numberOfLines={2}>
                    {template.name}
                  </Text>
                  <View style={styles.checklistFooter}>
                    <Text style={styles.checklistCount}>
                      {template.checklist_template_items.length} items
                    </Text>
                    <Button
                      mode="contained"
                      compact
                      loading={startingTemplateId === template.id}
                      disabled={startingTemplateId !== null}
                      onPress={() => handleStartChecklist(template)}
                      style={styles.checklistStartButton}
                      contentStyle={styles.checklistStartContent}
                      labelStyle={styles.checklistStartLabel}
                    >
                      Start
                    </Button>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.handoffSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionHeading}>Shift handoff notes</Text>
            <Text style={styles.sectionHint}>For the next crew</Text>
          </View>

          <View style={styles.handoffComposerCard}>
            <TextInput
              mode="outlined"
              placeholder="Leave a note for the next shift..."
              value={handoffNote}
              onChangeText={setHandoffNote}
              style={styles.handoffInput}
              outlineStyle={styles.inputOutline}
              multiline
            />
            <Button
              mode="contained"
              onPress={handlePostHandoff}
              loading={postingHandoff}
              disabled={postingHandoff || !handoffNote.trim()}
              compact
              style={styles.handoffPostButton}
              labelStyle={styles.handoffPostLabel}
            >
              Post note
            </Button>
          </View>

          {handoffs.slice(0, 5).map((handoff) => {
            const author = memberFor(handoff.author_id)
            const authorName = author?.display_name ?? "Team member"

            return (
              <View
                key={handoff.id}
                style={[styles.handoffCard, handoff.resolved && styles.handoffCardResolved]}
              >
                <AnimatedPressable
                  style={styles.handoffRow}
                  scaleTo={0.99}
                  onPress={() => toggleHandoffResolved(handoff.id, handoff.resolved)}
                >
                  <Checkbox
                    status={handoff.resolved ? "checked" : "unchecked"}
                    onPress={() => toggleHandoffResolved(handoff.id, handoff.resolved)}
                    color={colors.tasks}
                    uncheckedColor={colors.textMuted}
                  />
                  <View style={styles.handoffTextCol}>
                    <Text
                      style={[
                        styles.handoffNoteText,
                        handoff.resolved && styles.taskTitleDone,
                      ]}
                    >
                      {handoff.note}
                    </Text>
                    <View style={styles.handoffMetaRow}>
                      <MemberAvatar
                        name={authorName}
                        avatarUrl={author?.avatar_url}
                        size={26}
                      />
                      <Text style={styles.handoffMeta} numberOfLines={1}>
                        {authorName} · {formatNoteTime(handoff.created_at)}
                      </Text>
                    </View>
                  </View>
                </AnimatedPressable>
              </View>
            )
          })}
        </View>
      </ScrollView>

      <Sheet visible={modalVisible} onDismiss={closeModal}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>New task</Text>
          <Text style={styles.modalSubtitle}>Add a task for this shift and assign it to the team.</Text>
          {saveError && <Text style={styles.saveErrorText}>{saveError}</Text>}
          <TextInput
            label="Title"
            value={formTitle}
            onChangeText={setFormTitle}
            mode="outlined"
            style={styles.modalInput}
            outlineStyle={styles.inputOutline}
            autoFocus
          />
          <TextInput
            label="Description (optional)"
            value={formDescription}
            onChangeText={setFormDescription}
            mode="outlined"
            multiline
            numberOfLines={2}
            style={styles.modalInput}
            outlineStyle={styles.inputOutline}
          />
          {formDue.trim() ? (
            <View style={styles.dueRow}>
              <View style={styles.dueFields}>
                <View style={styles.dueFieldFlex}>
                  <PickerField
                    label="Due date"
                    mode="date"
                    value={parseFormDue(formDue)}
                    onChange={(d) => {
                      const next = new Date(parseFormDue(formDue))
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
                      setFormDue(formatFormDue(next))
                    }}
                  />
                </View>
                <View style={styles.dueFieldFlex}>
                  <PickerField
                    label="Due time"
                    mode="time"
                    value={parseFormDue(formDue)}
                    onChange={(d) => {
                      const next = new Date(parseFormDue(formDue))
                      next.setHours(d.getHours(), d.getMinutes(), 0, 0)
                      setFormDue(formatFormDue(next))
                    }}
                  />
                </View>
              </View>
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Remove due date"
                onPress={() => setFormDue("")}
                style={styles.dueClearButton}
                scaleTo={0.9}
              >
                <Icon source="close-circle" size={20} color={colors.textMuted} />
              </AnimatedPressable>
            </View>
          ) : (
            <AnimatedPressable
              accessibilityRole="button"
              onPress={() => setFormDue(formatFormDue(roundToNextHour(new Date())))}
              style={styles.addDueButton}
              scaleTo={0.97}
            >
              <Icon source="calendar-outline" size={18} color={colors.tasks} />
              <Text style={styles.addDueText}>Add due date</Text>
            </AnimatedPressable>
          )}
          <Text style={styles.assigneeLabel}>Assign to</Text>
          <View style={styles.assigneeChipRow}>
            <Chip
              selected={formAssignee === null}
              onPress={() => setFormAssignee(null)}
              style={styles.assigneeChip}
              showSelectedCheck
            >
              Unassigned
            </Chip>
            {members.map((member) => (
              <Chip
                key={member.id}
                selected={formAssignee === member.user_id}
                onPress={() => setFormAssignee(member.user_id)}
                style={styles.assigneeChip}
                showSelectedCheck
              >
                {member.display_name ?? "Member"}
              </Chip>
            ))}
          </View>
          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={closeModal} style={styles.modalButton}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.modalButton, styles.modalSaveButton]}
            >
              Save task
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
  topContent: {
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  progressLabel: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  addButton: {
    borderRadius: 999,
    backgroundColor: colors.tasks,
    flexShrink: 0,
  },
  addButtonContent: {
    minHeight: 40,
    paddingHorizontal: 10,
  },
  addButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  progressBar: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  progressPct: {
    width: 42,
    textAlign: "right",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonSelected: {
    borderColor: colors.tasks,
    backgroundColor: colors.tasks,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  filterButtonTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    gap: 12,
  },
  sectionHeadingRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeading: {
    flexShrink: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.tasksDark,
  },
  sectionCountPill: {
    minWidth: 28,
    minHeight: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 9,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.tasksDark,
    fontVariant: ["tabular-nums"],
  },
  sectionHint: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "right",
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 2px 8px rgba(26, 45, 34, 0.07)",
    overflow: "hidden",
  },
  taskCardCompleted: {
    backgroundColor: colors.surface,
  },
  skeletonTaskCard: {
    height: 118,
    borderWidth: 0,
  },
  taskRow: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
    paddingLeft: 10,
    paddingRight: 8,
  },
  checkboxWrap: {
    paddingTop: 1,
  },
  taskTextCol: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 5,
    gap: 16,
  },
  taskTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  taskMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  assigneeRow: {
    flex: 1,
    minWidth: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  memberAvatar: {
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberAvatarInitials: {
    fontWeight: "800",
    color: colors.tasksDark,
  },
  taskMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  duePill: {
    maxWidth: "100%",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.statLogsBg,
    borderWidth: 1,
    borderColor: colors.statLogsBorder,
  },
  taskDue: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: colors.managementDark,
    fontVariant: ["tabular-nums"],
  },
  taskDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 34,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    backgroundColor: colors.surfaceWarm,
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptySubtext: {
    paddingTop: 3,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: "center",
  },
  misoBanner: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.statStockBorder,
    overflow: "hidden",
  },
  misoImageWrap: {
    width: 74,
    height: 74,
    flexShrink: 0,
    borderRadius: 37,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  misoImage: {
    width: "100%",
    height: "100%",
  },
  misoCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    gap: 9,
  },
  misoPrompt: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  misoAction: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.tasks,
  },
  misoActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  checklistsSection: {
    paddingTop: 14,
    gap: 10,
  },
  checklistsRow: {
    gap: 12,
    paddingRight: 4,
    paddingBottom: 3,
  },
  checklistCard: {
    width: 190,
    minHeight: 152,
    padding: 15,
    gap: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 2px 8px rgba(26, 45, 34, 0.06)",
  },
  checklistCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checklistIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  checklistCategory: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.tasksDark,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  checklistName: {
    minHeight: 42,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  checklistFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  checklistCount: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  checklistStartButton: {
    borderRadius: 999,
    backgroundColor: colors.tasks,
  },
  checklistStartContent: {
    minHeight: 34,
    paddingHorizontal: 5,
  },
  checklistStartLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  handoffSection: {
    paddingTop: 14,
    gap: 12,
  },
  handoffComposerCard: {
    padding: 14,
    gap: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 2px 8px rgba(26, 45, 34, 0.06)",
  },
  handoffInput: {
    minHeight: 90,
    backgroundColor: colors.surface,
  },
  inputOutline: {
    borderRadius: 14,
  },
  handoffPostButton: {
    alignSelf: "flex-end",
    borderRadius: 999,
    backgroundColor: colors.tasks,
  },
  handoffPostLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  handoffCard: {
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  handoffCardResolved: {
    opacity: 0.64,
  },
  handoffRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 11,
    paddingLeft: 8,
    paddingRight: 14,
  },
  handoffTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 9,
    paddingTop: 6,
    paddingBottom: 3,
  },
  handoffNoteText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  handoffMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  handoffMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
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
  modalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  modalSubtitle: {
    paddingTop: 4,
    paddingBottom: 18,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  saveErrorText: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
    backgroundColor: "#FEE2E2",
  },
  modalInput: {
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  dueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  dueFields: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 8,
  },
  dueFieldFlex: {
    flex: 1,
    minWidth: 0,
  },
  dueClearButton: {
    width: 44,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  addDueButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  addDueText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.tasksDark,
  },
  assigneeLabel: {
    marginBottom: 9,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  assigneeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  assigneeChip: {
    marginBottom: 3,
    backgroundColor: colors.surfaceWarm,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  modalButton: {
    minWidth: 104,
    borderRadius: 999,
  },
  modalSaveButton: {
    backgroundColor: colors.tasks,
  },
})
