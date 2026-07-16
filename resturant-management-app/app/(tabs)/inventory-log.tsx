/**
 * Inventory Log tab — CRUD for stock items (name, quantity, location, cost per unit).
 * Search filters the loaded list (name, location, stock, cost) without extra server calls.
 * Data: Supabase table `inventory_log`.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { confirmAction } from "@/lib/alert"
import { InventoryLogItem, useInventoryLog } from "@/lib/hooks/useInventoryLog"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { colors } from "@/lib/theme"
import { useMemo, useState } from "react"
import { StyleSheet, View, ScrollView, Modal, TouchableWithoutFeedback, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, SegmentedButtons, Text, TextInput } from "react-native-paper"

type StockStatus = "out" | "low" | "good"
type StockFilter = "all" | "low" | "out"

/** Out at 0, low under 10 (same threshold used on the Home dashboard / Profile help text), otherwise good. */
function getStockStatus(item: InventoryLogItem): StockStatus {
  if (item.stock_quantity <= 0) return "out"
  if (item.stock_quantity < 10) return "low"
  return "good"
}

const STATUS_LABEL: Record<StockStatus, string> = { out: "Out", low: "Low", good: "Good" }
const STATUS_COLOR: Record<StockStatus, string> = { out: colors.error, low: colors.lowStock, good: colors.primary }

type InventoryIconName = keyof typeof MaterialCommunityIcons.glyphMap

/** A lightweight visual placeholder until inventory items have their own image field. */
function getInventoryIcon(itemName: string): InventoryIconName {
  const name = itemName.toLowerCase()
  if (/chicken|beef|pork|steak|meat|turkey|fish/.test(name)) return "food-drumstick-outline"
  if (/oil|vinegar|sauce|syrup|bottle/.test(name)) return "bottle-tonic-outline"
  if (/tomato|apple|orange|lemon|lime|fruit|vegetable|produce/.test(name)) {
    return "food-apple-outline"
  }
  if (/flour|rice|grain|bread|pasta|sugar|salt/.test(name)) return "food-outline"
  return "package-variant-closed"
}

/** Client-side filter: name, location, stock count, or cost (partial match on displayed values). */
function matchesSearch(item: InventoryLogItem, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = (item.item_name ?? "").toLowerCase()
  const location = (item.storage_location ?? "").toLowerCase()
  const stock = String(item.stock_quantity)
  const costFixed = item.cost_per_unit.toFixed(2)
  const costRaw = String(item.cost_per_unit)
  return (
    name.includes(q) ||
    location.includes(q) ||
    stock.includes(q) ||
    costFixed.includes(q) ||
    costRaw.toLowerCase().includes(q)
  )
}

function matchesStatusFilter(item: InventoryLogItem, filter: StockFilter) {
  if (filter === "all") return true
  return getStockStatus(item) === filter
}

export default function InventoryLog() {
  const { horizontal, scrollBottomPad } = useMobileLayout()
  const { data: inventoryLog, loading, error, insert, update, remove } = useInventoryLog()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryLogItem | null>(null)
  const [formItemName, setFormItemName] = useState("")
  const [formStockQuantity, setFormStockQuantity] = useState("")
  const [formStorageLocation, setFormStorageLocation] = useState("")
  const [formCostPerUnit, setFormCostPerUnit] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StockFilter>("all")

  const filteredLog = useMemo(
    () =>
      inventoryLog.filter(
        (item) => matchesSearch(item, searchQuery) && matchesStatusFilter(item, statusFilter)
      ),
    [inventoryLog, searchQuery, statusFilter]
  )

  const lowStockCount = useMemo(
    () => inventoryLog.filter((item) => getStockStatus(item) === "low").length,
    [inventoryLog]
  )

  function confirmDelete(item: InventoryLogItem) {
    confirmAction(
      "Delete Entry",
      `Are you sure you want to delete "${item.item_name}"? This cannot be undone.`,
      "Delete",
      () => remove(item.id)
    )
  }

  function openAddModal() {
    setEditingItem(null)
    setFormItemName("")
    setFormStockQuantity("")
    setFormStorageLocation("")
    setFormCostPerUnit("")
    setSaveError(null)
    setModalVisible(true)
  }

  function openEditModal(item: InventoryLogItem) {
    setEditingItem(item)
    setFormItemName(item.item_name)
    setFormStockQuantity(String(item.stock_quantity))
    setFormStorageLocation(item.storage_location)
    setFormCostPerUnit(String(item.cost_per_unit))
    setSaveError(null)
    setModalVisible(true)
  }

  function closeModal() {
    Keyboard.dismiss()
    setModalVisible(false)
    setEditingItem(null)
    setFormItemName("")
    setFormStockQuantity("")
    setFormStorageLocation("")
    setFormCostPerUnit("")
    setSaveError(null)
  }

  async function handleSave() {
    if (!formItemName.trim()) return
    const stockQty = parseInt(formStockQuantity, 10)
    const costPerUnit = parseFloat(formCostPerUnit)
    // Basic validation before sending numbers to Supabase
    if (isNaN(stockQty) || stockQty < 0 || isNaN(costPerUnit) || costPerUnit < 0) {
      setSaveError("Please enter valid stock quantity and cost per unit")
      return
    }
    const payload = {
      item_name: formItemName.trim(),
      stock_quantity: stockQty,
      storage_location: formStorageLocation.trim(),
      cost_per_unit: costPerUnit,
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
        <Text style={styles.loadingText}>Loading inventory...</Text>
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
      <View style={[styles.header, { paddingHorizontal: horizontal }]}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>
          {inventoryLog.length} {inventoryLog.length === 1 ? "item" : "items"}
        </Text>
      </View>

      <View style={[styles.searchWrap, { paddingHorizontal: horizontal }]}>
        <TextInput
          mode="outlined"
          placeholder="Search inventory"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          outlineStyle={styles.searchOutline}
          contentStyle={styles.searchContent}
          left={<TextInput.Icon icon="magnify" />}
          right={
            searchQuery.length > 0 ? (
              <TextInput.Icon icon="close" onPress={() => setSearchQuery("")} />
            ) : (
              <TextInput.Icon icon="tune-variant" />
            )
          }
          theme={{ colors: { primary: colors.primary, outline: colors.border } }}
        />
      </View>

      <View style={[styles.filterWrap, { paddingHorizontal: horizontal }]}>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StockFilter)}
          buttons={[
            {
              value: "all",
              label: "All",
              checkedColor: colors.surface,
              uncheckedColor: colors.textSecondary,
              showSelectedCheck: false,
              style: [styles.filterButton, statusFilter === "all" && styles.filterButtonActive],
              labelStyle: styles.filterButtonLabel,
            },
            {
              value: "low",
              label: "Low stock",
              checkedColor: colors.surface,
              uncheckedColor: colors.textSecondary,
              showSelectedCheck: false,
              style: [styles.filterButton, statusFilter === "low" && styles.filterButtonActive],
              labelStyle: styles.filterButtonLabel,
            },
            {
              value: "out",
              label: "Out",
              checkedColor: colors.surface,
              uncheckedColor: colors.textSecondary,
              showSelectedCheck: false,
              style: [styles.filterButton, statusFilter === "out" && styles.filterButtonActive],
              labelStyle: styles.filterButtonLabel,
            },
          ]}
          density="small"
          style={styles.filterGroup}
          theme={{ colors: { secondaryContainer: colors.primary, outline: colors.border } }}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad + 84 },
        ]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        {inventoryLog.length > 0 && (
          <View
            style={[
              styles.stockSummary,
              lowStockCount === 0 && styles.stockSummaryGood,
            ]}
          >
            <View
              style={[
                styles.stockSummaryIcon,
                lowStockCount === 0 && styles.stockSummaryIconGood,
              ]}
            >
              <MaterialCommunityIcons
                name={lowStockCount === 0 ? "check" : "package-variant"}
                size={24}
                color={lowStockCount === 0 ? colors.primary : colors.surface}
              />
            </View>
            <Text style={styles.stockSummaryText} numberOfLines={2}>
              {lowStockCount === 0
                ? "Stock levels look good"
                : `${lowStockCount} low-stock ${lowStockCount === 1 ? "item" : "items"}`}
            </Text>
            {lowStockCount > 0 && (
              <Button
                mode="contained"
                compact
                onPress={() => setStatusFilter("low")}
                style={styles.reviewButton}
                contentStyle={styles.reviewButtonContent}
                labelStyle={styles.reviewButtonLabel}
                buttonColor={colors.lowStock}
              >
                Review
              </Button>
            )}
          </View>
        )}

        {inventoryLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No inventory items yet</Text>
            <Text style={styles.emptySubtext}>Tap Add item to create one</Text>
          </View>
        ) : filteredLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching items</Text>
            <Text style={styles.emptySubtext}>Try a different search or clear the filter</Text>
          </View>
        ) : (
          filteredLog.map((item) => {
            const status = getStockStatus(item)
            return (
              <Card key={item.id} style={styles.card} mode="outlined">
                <Card.Content style={styles.cardContent}>
                  <View style={styles.itemIconTile}>
                    <MaterialCommunityIcons
                      name={getInventoryIcon(item.item_name)}
                      size={34}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {item.item_name}
                    </Text>
                    <View style={styles.locationRow}>
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={17}
                        color={colors.textMuted}
                      />
                      <Text style={styles.itemLocation} numberOfLines={1}>
                        {item.storage_location || "Location not set"}
                      </Text>
                    </View>
                    <Text style={styles.itemCost}>${item.cost_per_unit.toFixed(2)} per unit</Text>
                  </View>
                  <View style={styles.itemStatusColumn}>
                    <Text style={styles.stockCount}>{item.stock_quantity} left</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: `${STATUS_COLOR[status]}14`,
                          borderColor: STATUS_COLOR[status],
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[status] }]}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
                <Card.Actions style={styles.cardActions}>
                  <Button
                    mode="text"
                    compact
                    icon="pencil-outline"
                    onPress={() => openEditModal(item)}
                    textColor={colors.primary}
                    labelStyle={styles.cardActionLabel}
                  >
                    Edit
                  </Button>
                  <View style={styles.actionDivider} />
                  <Button
                    mode="text"
                    compact
                    icon="trash-can-outline"
                    onPress={() => confirmDelete(item)}
                    textColor={colors.error}
                    labelStyle={styles.cardActionLabel}
                  >
                    Delete
                  </Button>
                </Card.Actions>
              </Card>
            )
          })
        )}

      </ScrollView>

      <View style={styles.addButtonWrap} pointerEvents="box-none">
        <Button
          mode="contained"
          onPress={openAddModal}
          style={styles.addButton}
          contentStyle={styles.addButtonContent}
          labelStyle={styles.addButtonLabel}
          icon="plus"
          buttonColor={colors.primary}
        >
          Add item
        </Button>
      </View>

      {/* Tap dimmed area to dismiss; inner wrapper prevents the form from closing when editing fields */}
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
                {editingItem ? "Edit item" : "Add item"}
              </Text>
              {saveError && (
                <Text style={styles.saveErrorText}>{saveError}</Text>
              )}
              <TextInput
                label="Item Name"
                value={formItemName}
                onChangeText={setFormItemName}
                mode="outlined"
                style={styles.modalInput}
                autoFocus
              />
              <TextInput
                label="Stock Quantity"
                value={formStockQuantity}
                onChangeText={setFormStockQuantity}
                mode="outlined"
                keyboardType="numeric"
                style={styles.modalInput}
              />
              <TextInput
                label="Storage Location"
                value={formStorageLocation}
                onChangeText={setFormStorageLocation}
                mode="outlined"
                style={styles.modalInput}
              />
              <TextInput
                label="Cost Per Unit"
                value={formCostPerUnit}
                onChangeText={setFormCostPerUnit}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.modalInput}
              />
              <View style={styles.modalActions}>
                <Button mode="outlined" onPress={closeModal} style={styles.modalButton}>
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={styles.modalButton}
                  buttonColor={colors.primary}
                >
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
  header: {
    paddingTop: 14,
    paddingBottom: 18,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    paddingTop: 1,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  searchWrap: {
    paddingBottom: 14,
  },
  searchInput: {
    height: 56,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
  searchOutline: {
    borderRadius: 16,
    borderWidth: 1,
  },
  searchContent: {
    minHeight: 56,
  },
  filterWrap: {
    paddingBottom: 18,
  },
  filterGroup: {
    gap: 10,
  },
  filterButton: {
    minWidth: 76,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterButtonLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  stockSummary: {
    minHeight: 72,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.lowStock,
    backgroundColor: colors.statFinanceBg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stockSummaryGood: {
    borderColor: colors.statStockBorder,
    backgroundColor: colors.statStockBg,
  },
  stockSummaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lowStock,
    flexShrink: 0,
  },
  stockSummaryIconGood: {
    backgroundColor: colors.surface,
  },
  stockSummaryText: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reviewButton: {
    borderRadius: 10,
    flexShrink: 0,
  },
  reviewButtonContent: {
    minHeight: 40,
    paddingHorizontal: 4,
  },
  reviewButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  addButton: {
    minWidth: 204,
    borderRadius: 999,
    boxShadow: "0 3px 8px rgba(24, 107, 67, 0.18)",
  },
  addButtonContent: {
    paddingHorizontal: 22,
    minHeight: 56,
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  addButtonWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 2,
  },
  card: {
    marginBottom: 12,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 1px 3px rgba(31, 41, 35, 0.07)",
    overflow: "hidden",
  },
  cardContent: {
    minHeight: 104,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  itemIconTile: {
    width: 66,
    height: 72,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
    flexShrink: 0,
  },
  itemDetails: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  itemTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  itemLocation: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  itemCost: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  itemStatusColumn: {
    alignSelf: "stretch",
    minWidth: 58,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 2,
    flexShrink: 0,
  },
  stockCount: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  cardActions: {
    minHeight: 39,
    paddingHorizontal: 8,
    paddingVertical: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    justifyContent: "flex-end",
    gap: 0,
  },
  cardActionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.border,
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
    backgroundColor: "rgba(24, 32, 27, 0.38)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    boxShadow: "0 14px 36px rgba(20, 38, 28, 0.18)",
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: 18,
  },
  saveErrorText: {
    fontSize: 14,
    color: colors.error,
    marginBottom: 16,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
  },
  modalInput: {
    marginBottom: 12,
    backgroundColor: colors.surface,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  modalButton: {
    minWidth: 100,
    borderRadius: 12,
  },
})
