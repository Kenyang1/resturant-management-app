/**
 * Finance tab — revenue & expense entries with period totals and vs previous period.
 * Data: Supabase table `finance_entries` (see supabase-finance-entries.sql).
 */
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { PickerField } from "@/components/PickerField"
import { Sheet } from "@/components/Sheet"
import { Skeleton } from "@/components/Skeleton"
import { confirmAction, notify } from "@/lib/alert"
import { useApprovalRequests } from "@/lib/hooks/useApprovalRequests"
import { FinanceEntry, FinanceKind, useFinanceEntries } from "@/lib/hooks/useFinanceEntries"
import { useRestaurantMembers } from "@/lib/hooks/useRestaurantMembers"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { type ComponentProps, useEffect, useMemo, useState } from "react"
import { Keyboard, ScrollView, StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Text, TextInput } from "react-native-paper"

type PeriodFilter = "all" | "month" | "week"
type FinanceIconName = ComponentProps<typeof MaterialCommunityIcons>["name"]

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
]

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

function getCategoryIcon(category: string, kind: FinanceKind): FinanceIconName {
  const normalized = category.toLowerCase()
  if (normalized.includes("sale") || normalized.includes("order")) return "cash-register"
  if (normalized.includes("payroll") || normalized.includes("wage")) return "account-group-outline"
  if (normalized.includes("utilit") || normalized.includes("electric")) return "lightning-bolt-outline"
  if (normalized.includes("rent") || normalized.includes("lease")) return "store-outline"
  if (normalized.includes("food") || normalized.includes("ingredient")) return "food-apple-outline"
  if (normalized.includes("deliver") || normalized.includes("transport")) return "truck-outline"
  if (normalized.includes("suppl")) return "package-variant-closed"
  return kind === "revenue" ? "trending-up" : "receipt-text-outline"
}

export default function FinanceScreen() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { data: entries, loading, error, insert, update, remove, refetch } = useFinanceEntries()
  const { data: members } = useRestaurantMembers()
  const { data: approvalRequests, submitExpenseRequest, decide } = useApprovalRequests()
  const [userId, setUserId] = useState<string | null>(null)
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>("month")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  // Staff submit approval requests instead of writing entries directly (RLS enforces
  // this server-side too — see the Milestone 6 migration). A user can hold multiple
  // memberships (e.g. leftover solo restaurant + a team they joined), so take the
  // least-privileged view: any staff membership hides the manager affordances.
  // Until members load we assume the direct-write path; the server rejects if wrong.
  const myRoles = members.filter((m) => m.user_id === userId).map((m) => m.role)
  const canManageFinance = myRoles.length === 0 || !myRoles.includes("staff")
  const pendingApprovals = approvalRequests.filter((r) => r.status === "pending")
  const myRequests = approvalRequests.filter((r) => r.requested_by === userId)

  async function handleDecide(requestId: string, decision: "approved" | "rejected") {
    setDecidingId(requestId)
    try {
      await decide(requestId, decision)
      if (decision === "approved") await refetch()
    } catch (err) {
      notify("Error", getErrorMessage(err))
    } finally {
      setDecidingId(null)
    }
  }

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

  const revenueDeltaPct = useMemo(() => {
    if (period === "all" || !previousRange) return null
    return pctChange(totalsCurrent.revenue, totalsPrevious.revenue)
  }, [period, previousRange, totalsCurrent.revenue, totalsPrevious.revenue])

  const expenseDeltaPct = useMemo(() => {
    if (period === "all" || !previousRange) return null
    return pctChange(totalsCurrent.expense, totalsPrevious.expense)
  }, [period, previousRange, totalsCurrent.expense, totalsPrevious.expense])

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
      } else if (canManageFinance) {
        await insert(payload)
      } else {
        await submitExpenseRequest(payload)
        notify("Sent for approval", "A manager will review your transaction request.")
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
                Finance
              </Text>
              <Text style={styles.subtitle}>Cash flow at a glance</Text>
            </View>
          </View>
        </View>
        <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
          <Skeleton style={styles.netCard} />
          <View style={styles.summaryRow}>
            <Skeleton style={styles.summaryCard} />
            <Skeleton style={styles.summaryCard} />
          </View>
          <Skeleton style={[styles.card, styles.skeletonCard]} />
          <Skeleton style={[styles.card, styles.skeletonCard]} />
          <Skeleton style={[styles.card, styles.skeletonCard]} />
        </View>
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
      <View style={[styles.topContent, { paddingHorizontal: horizontal }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title} numberOfLines={1}>
              Finance
            </Text>
            <Text style={styles.subtitle}>Cash flow at a glance</Text>
          </View>
        </View>
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
        <View style={styles.netCard}>
          <View style={styles.netCopy}>
            <Text style={styles.netLabel}>Net balance</Text>
            <Text style={styles.netValue} numberOfLines={1} adjustsFontSizeToFit>
              {money.format(totalsCurrent.net)}
            </Text>
            <View style={styles.netComparisonRow}>
              <Text style={styles.netCompare}>
                {period === "all" ? "All-time balance" : period === "month" ? "This month" : "This week"}
              </Text>
              {netDeltaPct != null ? (
                <>
                  <Text style={styles.netCompareDot}>•</Text>
                  <MaterialCommunityIcons
                    name={netDeltaPct >= 0 ? "arrow-up" : "arrow-down"}
                    size={12}
                    color="#FFFFFF"
                  />
                  <Text style={styles.netDelta}>
                    {Math.abs(netDeltaPct).toFixed(1)}% vs last {period === "month" ? "month" : "week"}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <View style={styles.netChart} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <MaterialCommunityIcons
              name={netDeltaPct == null ? "wallet-outline" : netDeltaPct >= 0 ? "trending-up" : "trending-down"}
              size={56}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryRevenue]}>
            <View style={styles.summaryTopRow}>
              <View style={[styles.summaryIcon, styles.summaryRevenueIcon]}>
                <MaterialCommunityIcons name="arrow-up" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>Revenue</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money.format(totalsCurrent.revenue)}
                </Text>
              </View>
            </View>
            {period === "all" ? (
              <Text style={styles.summaryComparisonNeutral}>All-time total</Text>
            ) : revenueDeltaPct == null ? (
              <Text style={styles.summaryComparisonNeutral}>No prior-period baseline</Text>
            ) : (
              <View style={styles.summaryComparisonRow}>
                <MaterialCommunityIcons
                  name={revenueDeltaPct >= 0 ? "arrow-up" : "arrow-down"}
                  size={13}
                  color={revenueDeltaPct >= 0 ? colors.primaryDark : colors.error}
                />
                <Text
                  style={[
                    styles.summaryComparison,
                    revenueDeltaPct < 0 && styles.summaryComparisonNegative,
                  ]}
                >
                  {Math.abs(revenueDeltaPct).toFixed(1)}% vs last {period === "month" ? "month" : "week"}
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.summaryCard, styles.summaryExpense]}>
            <View style={styles.summaryTopRow}>
              <View style={[styles.summaryIcon, styles.summaryExpenseIcon]}>
                <MaterialCommunityIcons name="arrow-down" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>Expenses</Text>
                <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>
                  {money.format(totalsCurrent.expense)}
                </Text>
              </View>
            </View>
            {period === "all" ? (
              <Text style={styles.summaryComparisonNeutral}>All-time total</Text>
            ) : expenseDeltaPct == null ? (
              <Text style={styles.summaryComparisonNeutral}>No prior-period baseline</Text>
            ) : (
              <View style={styles.summaryComparisonRow}>
                <MaterialCommunityIcons
                  name={expenseDeltaPct >= 0 ? "arrow-up" : "arrow-down"}
                  size={13}
                  color={expenseDeltaPct <= 0 ? colors.primaryDark : colors.error}
                />
                <Text
                  style={[
                    styles.summaryComparison,
                    expenseDeltaPct > 0 && styles.summaryComparisonNegative,
                  ]}
                >
                  {Math.abs(expenseDeltaPct).toFixed(1)}% vs last {period === "month" ? "month" : "week"}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.periodSection}>
          <View style={styles.periodRow}>
            {periodOptions.map((option) => {
              const selected = period === option.value
              return (
                <AnimatedPressable
                  key={option.value}
                  onPress={() => setPeriod(option.value)}
                  style={[styles.periodButton, selected && styles.periodButtonSelected]}
                  scaleTo={0.96}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.periodButtonText, selected && styles.periodButtonTextSelected]}>
                    {option.label}
                  </Text>
                </AnimatedPressable>
              )
            })}
          </View>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            mode="outlined"
            placeholder="Search transactions"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            outlineStyle={styles.searchOutline}
            contentStyle={styles.searchContent}
            left={<TextInput.Icon icon="magnify" />}
            right={
              searchQuery.length > 0 ? (
                <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} />
              ) : undefined
            }
          />
        </View>

        {canManageFinance && pendingApprovals.length > 0 && (
          <View style={styles.approvalsSection}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeading}>Pending approvals</Text>
              <View style={styles.entryCountPill}>
                <Text style={styles.entryCountText}>{pendingApprovals.length}</Text>
              </View>
            </View>
            {pendingApprovals.map((req) => {
              const requester = members.find((m) => m.user_id === req.requested_by)
              return (
                <Card key={req.id} style={styles.approvalCard} mode="contained">
                  <Card.Content style={styles.approvalCardContent}>
                    <View style={styles.approvalCopy}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {req.payload.kind === "expense" ? "−" : "+"}
                        {money.format(req.payload.amount)} • {req.payload.category}
                      </Text>
                      <Text style={styles.itemDescription} numberOfLines={1}>
                        {requester?.display_name ?? "Team member"} • {formatShortDate(req.payload.occurred_on)}
                        {req.payload.notes ? ` • ${req.payload.notes}` : ""}
                      </Text>
                    </View>
                    <View style={styles.approvalActions}>
                      <Button
                        mode="contained"
                        compact
                        loading={decidingId === req.id}
                        disabled={decidingId !== null}
                        onPress={() => handleDecide(req.id, "approved")}
                        style={styles.approveButton}
                      >
                        Approve
                      </Button>
                      <Button
                        mode="outlined"
                        compact
                        disabled={decidingId !== null}
                        onPress={() => handleDecide(req.id, "rejected")}
                        textColor={colors.error}
                      >
                        Reject
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              )
            })}
          </View>
        )}

        {!canManageFinance && myRequests.length > 0 && (
          <View style={styles.approvalsSection}>
            <View style={styles.listHeader}>
              <Text style={styles.listHeading}>My requests</Text>
            </View>
            {myRequests.slice(0, 3).map((req) => (
              <Card key={req.id} style={styles.approvalCard} mode="contained">
                <Card.Content style={styles.approvalCardContent}>
                  <View style={styles.approvalCopy}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {req.payload.kind === "expense" ? "−" : "+"}
                      {money.format(req.payload.amount)} • {req.payload.category}
                    </Text>
                    <Text style={styles.itemDescription}>{formatShortDate(req.payload.occurred_on)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.requestStatusText,
                      req.status === "approved" && { color: colors.primaryDark },
                      req.status === "rejected" && { color: colors.error },
                    ]}
                  >
                    {req.status}
                  </Text>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.listHeader}>
          <Text style={styles.listHeading}>Recent transactions</Text>
          <View style={styles.entryCountPill}>
            <Text style={styles.entryCountText}>{filteredEntries.length}</Text>
          </View>
        </View>

        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="receipt-text-outline" size={24} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>No transactions yet</Text>
            <Text style={styles.emptySubtext}>Tap Add to log revenue or an expense</Text>
          </View>
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="magnify" size={25} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>No matching transactions</Text>
            <Text style={styles.emptySubtext}>Try another search or clear the filter</Text>
          </View>
        ) : (
          filteredEntries.map((item) => (
            <Card key={item.id} style={styles.card} mode="contained">
              <Card.Content style={styles.cardContent}>
                <View
                  style={[
                    styles.categoryIcon,
                    item.kind === "revenue" ? styles.categoryIconRevenue : styles.categoryIconExpense,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={getCategoryIcon(item.category, item.kind)}
                    size={24}
                    color={item.kind === "revenue" ? colors.primaryDark : colors.error}
                  />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.category}
                  </Text>
                  {item.notes ? (
                    <Text style={styles.itemDescription} numberOfLines={1}>
                      {item.notes}
                    </Text>
                  ) : null}
                  <View style={styles.transactionMetaRow}>
                    <Text style={styles.itemDate}>{formatShortDate(item.occurred_on)}</Text>
                  </View>
                </View>
                <View style={styles.amountColumn}>
                  <Text
                    style={[
                      styles.amountText,
                      item.kind === "expense" ? styles.amountExpense : styles.amountRevenue,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {item.kind === "expense" ? "−" : "+"}
                    {money.format(item.amount)}
                  </Text>
                  {canManageFinance && (
                    <View style={styles.transactionActions}>
                      <AnimatedPressable
                        onPress={() => openEditModal(item)}
                        style={styles.transactionAction}
                        scaleTo={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${item.category} transaction`}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={17} color={colors.textSecondary} />
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => confirmDelete(item)}
                        style={styles.transactionAction}
                        scaleTo={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${item.category} transaction`}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.error} />
                      </AnimatedPressable>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <View style={[styles.bottomActionBar, { paddingHorizontal: horizontal }]}>
        <Button
          mode="contained"
          onPress={openAddModal}
          style={styles.bottomAddButton}
          contentStyle={styles.bottomAddButtonContent}
          labelStyle={styles.bottomAddButtonLabel}
          icon="plus"
        >
          {canManageFinance ? "Add transaction" : "Request transaction"}
        </Button>
      </View>

      <Sheet visible={modalVisible} onDismiss={closeModal}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIcon}>
              <MaterialCommunityIcons
                name={editingItem ? "pencil-outline" : "cash-plus"}
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.modalHeaderCopy}>
              <Text style={styles.modalTitle}>{editingItem ? "Edit transaction" : "Add transaction"}</Text>
              <Text style={styles.modalSubtitle}>Keep your daily cash flow up to date</Text>
            </View>
          </View>
          {saveError ? <Text style={styles.saveErrorText}>{saveError}</Text> : null}

          <Text style={styles.fieldLabel}>Transaction type</Text>
          <View style={styles.kindRow}>
            <AnimatedPressable
              onPress={() => setFormKind("revenue")}
              style={[styles.kindChoice, formKind === "revenue" && styles.kindChoiceActive]}
              scaleTo={0.97}
            >
              <MaterialCommunityIcons
                name="arrow-down-left"
                size={18}
                color={formKind === "revenue" ? "#FFFFFF" : colors.primaryDark}
              />
              <Text style={[styles.kindChoiceText, formKind === "revenue" && styles.kindChoiceTextActive]}>
                Revenue
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => setFormKind("expense")}
              style={[styles.kindChoice, formKind === "expense" && styles.kindChoiceActiveExpense]}
              scaleTo={0.97}
            >
              <MaterialCommunityIcons
                name="arrow-up-right"
                size={18}
                color={formKind === "expense" ? "#FFFFFF" : colors.error}
              />
              <Text style={[styles.kindChoiceText, formKind === "expense" && styles.kindChoiceTextActive]}>
                Expense
              </Text>
            </AnimatedPressable>
          </View>

          <TextInput
            label="Amount"
            value={formAmount}
            onChangeText={setFormAmount}
            mode="outlined"
            keyboardType="decimal-pad"
            style={styles.modalInput}
            outlineStyle={styles.modalInputOutline}
          />
          <TextInput
            label="Category"
            value={formCategory}
            onChangeText={setFormCategory}
            mode="outlined"
            style={styles.modalInput}
            outlineStyle={styles.modalInputOutline}
            placeholder="e.g. Sales, Payroll, Utilities"
          />
          <TextInput
            label="Notes (optional)"
            value={formNotes}
            onChangeText={setFormNotes}
            mode="outlined"
            style={[styles.modalInput, styles.notesInput]}
            outlineStyle={styles.modalInputOutline}
            multiline
          />
          <PickerField
            label="Date"
            mode="date"
            value={new Date(`${formDate}T00:00:00`)}
            onChange={(d) => setFormDate(toYMD(d))}
          />

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={closeModal} style={styles.modalButton}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={() => void handleSave()}
              style={[styles.modalButton, styles.modalSaveButton]}
              contentStyle={styles.modalButtonContent}
            >
              {editingItem ? "Save changes" : "Add transaction"}
            </Button>
          </View>
        </ScrollView>
      </Sheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topContent: {
    paddingTop: 13,
    paddingBottom: 7,
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 29,
    lineHeight: 35,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 5,
  },
  netCard: {
    minHeight: 132,
    paddingVertical: 17,
    paddingLeft: 20,
    paddingRight: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 17,
    borderCurve: "continuous",
    backgroundColor: colors.primary,
    boxShadow: "0 4px 12px rgba(25, 95, 61, 0.18)",
  },
  netCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  netLabel: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  netValue: {
    paddingTop: 2,
    fontSize: 32,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -0.7,
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  netComparisonRow: {
    minHeight: 20,
    paddingTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  netCompare: {
    fontSize: 11,
    lineHeight: 16,
    color: "rgba(255,255,255,0.78)",
    fontVariant: ["tabular-nums"],
  },
  netCompareDot: {
    paddingHorizontal: 1,
    fontSize: 10,
    lineHeight: 15,
    color: "rgba(255,255,255,0.58)",
  },
  netDelta: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    fontVariant: ["tabular-nums"],
  },
  netChart: {
    width: 78,
    height: 84,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.96,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRadius: 15,
    borderCurve: "continuous",
    borderWidth: 1,
    backgroundColor: colors.surface,
    boxShadow: "0 1px 3px rgba(31, 41, 35, 0.06)",
  },
  summaryRevenue: {
    borderColor: colors.statStockBorder,
  },
  summaryExpense: {
    borderColor: "rgba(201, 90, 82, 0.24)",
  },
  summaryTopRow: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  summaryRevenueIcon: {
    backgroundColor: colors.primary,
  },
  summaryExpenseIcon: {
    backgroundColor: "#E96919",
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  summaryLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  summaryValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.25,
    fontVariant: ["tabular-nums"],
  },
  summaryComparisonRow: {
    minHeight: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  summaryComparison: {
    flexShrink: 1,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "700",
    color: colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
  summaryComparisonNegative: {
    color: colors.error,
  },
  summaryComparisonNeutral: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    color: colors.textMuted,
  },
  periodSection: {
    marginBottom: 10,
  },
  periodRow: {
    flexDirection: "row",
    gap: 9,
  },
  periodButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  periodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  periodButtonText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  periodButtonTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  searchWrap: {
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: colors.surface,
    fontSize: 14,
  },
  searchOutline: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchContent: {
    minHeight: 44,
  },
  listHeader: {
    minHeight: 28,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  approvalsSection: {
    marginBottom: 16,
  },
  approvalCard: {
    marginBottom: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.statLogsBorder,
  },
  approvalCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  approvalCopy: {
    flex: 1,
    minWidth: 0,
  },
  approvalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  approveButton: {
    backgroundColor: colors.primary,
  },
  requestStatusText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.textMuted,
    flexShrink: 0,
  },
  listHeading: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.25,
  },
  entryCountPill: {
    minWidth: 27,
    minHeight: 23,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: colors.surfaceWarm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entryCountText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    color: colors.primaryDark,
    fontVariant: ["tabular-nums"],
  },
  card: {
    marginBottom: 8,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 4px rgba(26, 45, 34, 0.05)",
    overflow: "hidden",
  },
  skeletonCard: {
    minHeight: 82,
    borderWidth: 0,
  },
  cardContent: {
    minHeight: 82,
    paddingVertical: 10,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryIconRevenue: {
    backgroundColor: colors.statStockBg,
  },
  categoryIconExpense: {
    backgroundColor: "#FFF1EF",
  },
  transactionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  itemTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  itemDescription: {
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  transactionMetaRow: {
    paddingTop: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  itemDate: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  amountColumn: {
    minWidth: 78,
    maxWidth: 132,
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "space-between",
    flexShrink: 1,
  },
  amountText: {
    maxWidth: "100%",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  amountRevenue: {
    color: colors.primary,
  },
  amountExpense: {
    color: colors.error,
  },
  transactionActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  transactionAction: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 42,
    paddingHorizontal: 24,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    marginBottom: 12,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
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
  bottomActionBar: {
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomAddButton: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: colors.primary,
    boxShadow: "0 3px 9px rgba(24, 107, 67, 0.18)",
  },
  bottomAddButtonContent: {
    minHeight: 50,
  },
  bottomAddButtonLabel: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
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
  errorHint: {
    paddingTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  modalHeader: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  modalHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  modalTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  kindRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  kindChoice: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  kindChoiceActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  kindChoiceActiveExpense: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  kindChoiceText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  kindChoiceTextActive: {
    color: "#FFFFFF",
  },
  saveErrorText: {
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: colors.error,
    backgroundColor: "#FFF1EF",
    borderWidth: 1,
    borderColor: "rgba(201, 90, 82, 0.24)",
  },
  modalInput: {
    marginBottom: 11,
    backgroundColor: colors.surface,
  },
  modalInputOutline: {
    borderRadius: 13,
    borderWidth: 1,
  },
  notesInput: {
    minHeight: 66,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 7,
  },
  modalButton: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
  },
  modalSaveButton: {
    flex: 1.35,
    backgroundColor: colors.primary,
  },
  modalButtonContent: {
    minHeight: 48,
  },
})
