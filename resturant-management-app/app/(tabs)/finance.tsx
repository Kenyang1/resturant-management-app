/**
 * Finance tab — revenue & expense entries with period totals and vs previous period.
 * Data: Supabase table `finance_entries` (see supabase-finance-entries.sql).
 */
import { MascotBanner } from "@/components/MascotBanner"
import { confirmAction } from "@/lib/alert"
import { FinanceEntry, FinanceKind, useFinanceEntries } from "@/lib/hooks/useFinanceEntries"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { colors } from "@/lib/theme"
import { useMemo, useState } from "react"
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, SegmentedButtons, Text, TextInput } from "react-native-paper"

type PeriodFilter = "all" | "month" | "week"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfWeekSunday(d: Date) {
  const res = new Date(d)
  res.setDate(d.getDate() - d.getDay())
  res.setHours(0, 0, 0, 0)
  return res
}

function getCurrentRange(period: PeriodFilter): { start: string; end: string } | null {
  const today = new Date()
  const end = toYMD(today)
  if (period === "all") return null
  if (period === "month") {
    return { start: toYMD(startOfMonth(today)), end }
  }
  return { start: toYMD(startOfWeekSunday(today)), end }
}

function getPreviousRange(period: Exclude<PeriodFilter, "all">): { start: string; end: string } {
  const today = new Date()
  if (period === "month") {
    const firstThis = startOfMonth(today)
    const lastPrev = new Date(firstThis)
    lastPrev.setDate(0)
    const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
    return { start: toYMD(firstPrev), end: toYMD(lastPrev) }
  }
  const thisWeekStart = startOfWeekSunday(today)
  const prevWeekEnd = new Date(thisWeekStart)
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1)
  const prevWeekStart = new Date(prevWeekEnd)
  prevWeekStart.setDate(prevWeekStart.getDate() - 6)
  return { start: toYMD(prevWeekStart), end: toYMD(prevWeekEnd) }
}

function inRange(isoDate: string, start: string, end: string) {
  return isoDate >= start && isoDate <= end
}

function sumByKind(entries: FinanceEntry[], kind: FinanceKind, range: { start: string; end: string } | null) {
  return entries.reduce((acc, e) => {
    if (e.kind !== kind) return acc
    if (range && !inRange(e.occurred_on, range.start, range.end)) return acc
    return acc + e.amount
  }, 0)
}

function matchesSearch(item: FinanceEntry, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const cat = (item.category ?? "").toLowerCase()
  const notes = (item.notes ?? "").toLowerCase()
  const amt = item.amount.toFixed(2)
  return cat.includes(q) || notes.includes(q) || amt.includes(q) || item.kind.includes(q)
}

function formatShortDate(iso: string) {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

export default function FinanceScreen() {
  const { horizontal, scrollBottomPad, tabMascotHeight } = useMobileLayout()
  const { data: entries, loading, error, insert, update, remove } = useFinanceEntries()
  const [period, setPeriod] = useState<PeriodFilter>("month")
  const [searchQuery, setSearchQuery] = useState("")

  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<FinanceEntry | null>(null)
  const [formKind, setFormKind] = useState<FinanceKind>("revenue")
  const [formAmount, setFormAmount] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formNotes, setFormNotes] = useState("")
  const [formDate, setFormDate] = useState(toYMD(new Date()))
  const [saveError, setSaveError] = useState<string | null>(null)

  const currentRange = useMemo(() => getCurrentRange(period), [period])
  const previousRange = useMemo(
    () => (period === "all" ? null : getPreviousRange(period)),
    [period]
  )

  const totalsCurrent = useMemo(() => {
    const rev = sumByKind(entries, "revenue", currentRange)
    const exp = sumByKind(entries, "expense", currentRange)
    return { revenue: rev, expense: exp, net: rev - exp }
  }, [entries, currentRange])

  const totalsPrevious = useMemo(() => {
    if (!previousRange) return { revenue: 0, expense: 0, net: 0 }
    const rev = sumByKind(entries, "revenue", previousRange)
    const exp = sumByKind(entries, "expense", previousRange)
    return { revenue: rev, expense: exp, net: rev - exp }
  }, [entries, previousRange])

  const netDeltaPct = useMemo(() => {
    if (period === "all" || !previousRange) return null
    return pctChange(totalsCurrent.net, totalsPrevious.net)
  }, [period, previousRange, totalsCurrent.net, totalsPrevious.net])

  const filteredEntries = useMemo(
    () => entries.filter((e) => matchesSearch(e, searchQuery)),
    [entries, searchQuery]
  )

  function confirmDelete(item: FinanceEntry) {
    confirmAction(
      "Delete entry",
      `Remove this ${item.kind} of ${money.format(item.amount)}?`,
      "Delete",
      () => void remove(item.id)
    )
  }

  function openAddModal() {
    setEditingItem(null)
    setFormKind("revenue")
    setFormAmount("")
    setFormCategory("")
    setFormNotes("")
    setFormDate(toYMD(new Date()))
    setSaveError(null)
    setModalVisible(true)
  }

  function openEditModal(item: FinanceEntry) {
    setEditingItem(item)
    setFormKind(item.kind)
    setFormAmount(String(item.amount))
    setFormCategory(item.category)
    setFormNotes(item.notes ?? "")
    setFormDate(item.occurred_on)
    setSaveError(null)
    setModalVisible(true)
  }

  function closeModal() {
    Keyboard.dismiss()
    setModalVisible(false)
    setEditingItem(null)
    setSaveError(null)
  }

  async function handleSave() {
    const amt = parseFloat(formAmount)
    if (isNaN(amt) || amt < 0) {
      setSaveError("Enter a valid amount (0 or more)")
      return
    }
    if (!formCategory.trim()) {
      setSaveError("Category is required")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formDate.trim())) {
      setSaveError("Use date format YYYY-MM-DD")
      return
    }
    const payload = {
      kind: formKind,
      amount: amt,
      category: formCategory.trim(),
      notes: formNotes.trim() || null,
      occurred_on: formDate.trim(),
    }
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
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Text style={styles.loadingText}>Loading finance...</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={["left", "right", "bottom"]}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Text style={styles.errorHint}>
          Create the finance_entries table in Supabase (see supabase-finance-entries.sql).
        </Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={[styles.mascotSection, { paddingHorizontal: horizontal }]}>
        <MascotBanner
          source={mascotImages.finance}
          height={tabMascotHeight}
          accessibilityLabel="Chef cat mascot for finance tracking"
        />
      </View>

      <View style={[styles.header, { paddingHorizontal: horizontal }]}>
        <Text style={styles.title} numberOfLines={1}>
          Finance
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

      <View style={[styles.periodWrap, { paddingHorizontal: horizontal }]}>
        <Text style={styles.periodLabel}>Summary period</Text>
        <SegmentedButtons
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodFilter)}
          buttons={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "all", label: "All" },
          ]}
          style={styles.segmented}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryRevenue]}>
            <Text style={styles.summaryLabel}>Revenue</Text>
            <Text style={styles.summaryValue}>{money.format(totalsCurrent.revenue)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryExpense]}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <Text style={styles.summaryValue}>{money.format(totalsCurrent.expense)}</Text>
          </View>
        </View>

        <Card style={[styles.netCard, totalsCurrent.net >= 0 ? styles.netPositive : styles.netNegative]} mode="elevated">
          <Card.Content style={styles.netCardContent}>
            <Text style={styles.netLabel}>Net ({period === "all" ? "all time" : period === "month" ? "this month" : "this week"})</Text>
            <Text style={styles.netValue}>{money.format(totalsCurrent.net)}</Text>
            {period !== "all" && previousRange && (
              <Text style={styles.netCompare}>
                Prior {period === "month" ? "month" : "week"}: {money.format(totalsPrevious.net)}
                {netDeltaPct != null && (
                  <Text style={styles.netDelta}>
                    {" "}
                    ({netDeltaPct >= 0 ? "+" : ""}
                    {netDeltaPct.toFixed(0)}% vs prior)
                  </Text>
                )}
              </Text>
            )}
          </Card.Content>
        </Card>

        <View style={[styles.searchWrap, { marginHorizontal: 0 }]}>
          <TextInput
            mode="outlined"
            placeholder="Search category, notes, or amount"
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

        <Text style={styles.listHeading}>All entries</Text>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No entries yet</Text>
            <Text style={styles.emptySubtext}>Tap Add to log revenue or an expense</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching entries</Text>
            <Text style={styles.emptySubtext}>Try another search or clear the filter</Text>
          </View>
        ) : (
          filteredEntries.map((item) => (
            <Card key={item.id} style={styles.card} mode="elevated">
              <Card.Content style={styles.cardContent}>
                <View style={styles.cardTopRow}>
                  <View style={[styles.kindPill, item.kind === "revenue" ? styles.kindRevenue : styles.kindExpense]}>
                    <Text style={styles.kindPillText}>{item.kind === "revenue" ? "Revenue" : "Expense"}</Text>
                  </View>
                  <Text style={[styles.amountText, item.kind === "expense" && styles.amountExpense]}>
                    {item.kind === "expense" ? "−" : "+"}
                    {money.format(item.amount)}
                  </Text>
                </View>
                <Text style={styles.itemTitle}>{item.category}</Text>
                {item.notes ? (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.notes}
                  </Text>
                ) : null}
                <Text style={styles.itemDate}>{formatShortDate(item.occurred_on)}</Text>
              </Card.Content>
              <Card.Actions style={styles.cardActions}>
                <Button mode="outlined" compact onPress={() => openEditModal(item)}>
                  Edit
                </Button>
                <Button mode="outlined" compact onPress={() => confirmDelete(item)} textColor={colors.error}>
                  Delete
                </Button>
              </Card.Actions>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.absoluteFill}>
            <TouchableWithoutFeedback onPress={closeModal}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </View>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingItem ? "Edit entry" : "Add entry"}</Text>
              {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

              <Text style={styles.fieldLabel}>Type</Text>
              <View style={styles.kindRow}>
                <Pressable
                  onPress={() => setFormKind("revenue")}
                  style={({ pressed }) => [
                    styles.kindChoice,
                    formKind === "revenue" && styles.kindChoiceActive,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.kindChoiceText, formKind === "revenue" && styles.kindChoiceTextActive]}>
                    Revenue
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFormKind("expense")}
                  style={({ pressed }) => [
                    styles.kindChoice,
                    formKind === "expense" && styles.kindChoiceActiveExpense,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.kindChoiceText, formKind === "expense" && styles.kindChoiceTextActive]}>
                    Expense
                  </Text>
                </Pressable>
              </View>

              <TextInput
                label="Amount"
                value={formAmount}
                onChangeText={setFormAmount}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.modalInput}
              />
              <TextInput
                label="Category"
                value={formCategory}
                onChangeText={setFormCategory}
                mode="outlined"
                style={styles.modalInput}
                placeholder="e.g. Sales, Payroll, Utilities"
              />
              <TextInput
                label="Notes (optional)"
                value={formNotes}
                onChangeText={setFormNotes}
                mode="outlined"
                style={styles.modalInput}
                multiline
              />
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={formDate}
                onChangeText={setFormDate}
                mode="outlined"
                style={styles.modalInput}
              />

              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={closeModal} style={[styles.modalButton, { marginRight: 12 }]}>
                  Cancel
                </Button>
                <Button mode="contained" onPress={() => void handleSave()} style={styles.modalButton}>
                  Save
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    paddingTop: 4,
    paddingBottom: 8,
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
    backgroundColor: colors.finance,
    borderBottomWidth: 4,
    borderBottomColor: colors.financeDark,
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
  periodWrap: {
    paddingBottom: 12,
  },
  periodLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  segmented: {
    backgroundColor: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
  },
  summaryRevenue: {
    backgroundColor: colors.statStockBg,
    borderColor: colors.statStockBorder,
  },
  summaryExpense: {
    backgroundColor: "#FFEBEE",
    borderColor: "rgba(255, 75, 75, 0.35)",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  netCard: {
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  netPositive: {
    borderColor: colors.statStockBorder,
    backgroundColor: colors.statFinanceBg,
  },
  netNegative: {
    borderColor: "rgba(255, 75, 75, 0.35)",
    backgroundColor: "#FFF5F5",
  },
  netCardContent: {
    paddingVertical: 14,
  },
  netLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  netValue: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 4,
  },
  netCompare: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
  },
  netDelta: {
    fontWeight: "700",
    color: colors.textPrimary,
  },
  searchWrap: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: colors.surface,
  },
  searchOutline: {
    borderRadius: 12,
  },
  listHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 10,
  },
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
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kindPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
  },
  kindRevenue: {
    backgroundColor: colors.statStockBg,
    borderColor: colors.statStockBorder,
  },
  kindExpense: {
    backgroundColor: "#FFEBEE",
    borderColor: "rgba(255, 75, 75, 0.35)",
  },
  kindPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  amountText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  amountExpense: {
    color: colors.error,
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
    paddingVertical: 36,
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
  errorHint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 12,
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
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 8,
  },
  kindRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  kindChoice: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.background,
  },
  kindChoiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceWarm,
  },
  kindChoiceActiveExpense: {
    borderColor: colors.error,
    backgroundColor: "#FFF5F5",
  },
  kindChoiceText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  kindChoiceTextActive: {
    color: colors.textPrimary,
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
})
