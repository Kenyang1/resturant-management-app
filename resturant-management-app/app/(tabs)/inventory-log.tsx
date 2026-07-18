/**
 * Inventory Log tab — CRUD for stock items (name, quantity, location, cost per unit).
 * Search filters the loaded list (name, location, stock, cost) without extra server calls.
 * Data: Supabase table `inventory_log`.
 */
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { AnimatedPressable } from "@/components/AnimatedPressable"
import { EmptyState } from "@/components/EmptyState"
import { FormSheet } from "@/components/FormSheet"
import { MisoCallout } from "@/components/MisoCallout"
import { ScreenHeader } from "@/components/ScreenHeader"
import { SearchField } from "@/components/SearchField"
import { SegmentedControl } from "@/components/SegmentedControl"
import { Skeleton } from "@/components/Skeleton"
import { StatusChip, type Status } from "@/components/StatusChip"
import { confirmAction } from "@/lib/alert"
import { InventoryLogItem, useInventoryLog } from "@/lib/hooks/useInventoryLog"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"
import { useMobileLayout } from "@/lib/layout"
import { dispatchPushEvent } from "@/lib/notifications"
import { mascotImages } from "@/lib/mascotImages"
import { colors, radii } from "@/lib/theme"
import { useMemo, useState } from "react"
import { StyleSheet, View, ScrollView, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Text, TextInput } from "react-native-paper"

type StockStatus = "out" | "low" | "good"
type StockFilter = "all" | "low" | "out"

/** Out at 0, low under 10 (same threshold used on the Home dashboard / Profile help text), otherwise good. */
function getStockStatus(item: InventoryLogItem): StockStatus {
  if (item.stock_quantity <= 0) return "out"
  if (item.stock_quantity < 10) return "low"
  return "good"
}

type InventoryIconName = keyof typeof MaterialCommunityIcons.glyphMap

const FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out" },
]

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

/** Category accent so icon tiles vary by item type, matching the pattern used on Finance/Logs. */
function getInventoryAccent(itemName: string): string {
  const name = itemName.toLowerCase()
  if (/chicken|beef|pork|steak|meat|turkey|fish/.test(name)) return colors.errorDark
  if (/oil|vinegar|sauce|syrup|bottle/.test(name)) return colors.finance
  if (/tomato|apple|orange|lemon|lime|fruit|vegetable|produce/.test(name)) return colors.primary
  if (/flour|rice|grain|bread|pasta|sugar|salt/.test(name)) return colors.management
  return colors.settings
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
  const { horizontal, scrollBottomPad, desktopFrameStyle } = useMobileLayout()
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
      let itemId: number
      if (editingItem) {
        await update(editingItem.id, payload)
        itemId = editingItem.id
      } else {
        const created = await insert(payload)
        itemId = created.id
      }
      // Alert managers only when stock CROSSES below the threshold, so
      // re-saving an already-low item doesn't ping them again.
      const prevQty = editingItem ? editingItem.stock_quantity : Number.POSITIVE_INFINITY
      if (stockQty < 10 && prevQty >= 10) {
        dispatchPushEvent({ type: "low_stock", item_id: itemId })
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
          <View style={{ paddingHorizontal: horizontal }}>
            <ScreenHeader title="Inventory" />
          </View>
          <View style={[styles.scrollContent, { paddingHorizontal: horizontal }]}>
            <Skeleton style={[styles.card, styles.skeletonCard]} />
            <Skeleton style={[styles.card, styles.skeletonCard]} />
            <Skeleton style={[styles.card, styles.skeletonCard]} />
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
        <View style={{ paddingHorizontal: horizontal }}>
          <ScreenHeader
            title="Inventory"
            subtitle={`${inventoryLog.length} ${inventoryLog.length === 1 ? "item" : "items"}`}
            right={
              <AnimatedPressable
                accessibilityRole="button"
                accessibilityLabel="Add inventory item"
                onPress={openAddModal}
                style={styles.addIconButton}
                scaleTo={0.93}
              >
                <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
              </AnimatedPressable>
            }
          />
        </View>

        <View style={{ paddingHorizontal: horizontal, paddingBottom: 14 }}>
          <SearchField value={searchQuery} onChangeText={setSearchQuery} placeholder="Search inventory" />
        </View>

        <View style={{ paddingHorizontal: horizontal, paddingBottom: 16 }}>
          <SegmentedControl options={FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: horizontal, paddingBottom: scrollBottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
        >
          {inventoryLog.length > 0 &&
            (lowStockCount > 0 ? (
              <MisoCallout
                image={mascotImages.lowStock}
                title={`${lowStockCount} low-stock ${lowStockCount === 1 ? "item" : "items"}`}
                actionLabel="Review"
                actionIcon="alert"
                onPress={() => setStatusFilter("low")}
              />
            ) : (
              <MisoCallout image={mascotImages.stockGood} title="Stock levels look good" />
            ))}

          {inventoryLog.length === 0 ? (
            <EmptyState
              icon={<MaterialCommunityIcons name="package-variant" size={24} color={colors.primary} />}
              title="No inventory items yet"
              subtitle="Add your first item to start tracking stock."
              actionLabel="Add item"
              onAction={openAddModal}
            />
          ) : filteredLog.length === 0 ? (
            <EmptyState
              image={statusFilter === "out" ? mascotImages.outOfStock : undefined}
              icon={
                statusFilter === "out" ? undefined : (
                  <MaterialCommunityIcons name="magnify" size={25} color={colors.primary} />
                )
              }
              title={statusFilter === "out" ? "Nothing is out of stock" : "No matching items"}
              subtitle={
                statusFilter === "out"
                  ? "Every item currently has some stock on hand."
                  : "Try a different search or clear the filter"
              }
            />
          ) : (
            filteredLog.map((item) => {
              const status: Status = getStockStatus(item)
              const accent = getInventoryAccent(item.item_name)
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardContent}>
                    <View style={[styles.itemIconTile, { backgroundColor: `${accent}18` }]}>
                      <MaterialCommunityIcons
                        name={getInventoryIcon(item.item_name)}
                        size={34}
                        color={accent}
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
                      <StatusChip status={status} />
                    </View>
                  </View>
                  <View style={styles.cardActions}>
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
                  </View>
                </View>
              )
            })
          )}
        </ScrollView>
      </View>

      <FormSheet
        visible={modalVisible}
        onDismiss={closeModal}
        icon={editingItem ? "pencil-outline" : "add"}
        title={editingItem ? "Edit item" : "Add item"}
      >
        {saveError && <Text style={styles.saveErrorText}>{saveError}</Text>}
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
          <Button mode="contained" onPress={handleSave} style={styles.modalButton} buttonColor={colors.primary}>
            Save
          </Button>
        </View>
      </FormSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  addIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    backgroundColor: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 2,
    gap: 12,
  },
  card: {
    borderRadius: radii.lg,
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
    borderRadius: radii.sm,
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
    fontFamily: "Nunito_700Bold",
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
    fontFamily: "Nunito_600SemiBold",
    color: colors.textSecondary,
  },
  itemCost: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Nunito_600SemiBold",
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  itemStatusColumn: {
    alignSelf: "stretch",
    minWidth: 64,
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingVertical: 2,
    flexShrink: 0,
  },
  stockCount: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_700Bold",
    color: colors.textPrimary,
    fontVariant: ["tabular-nums"],
  },
  cardActions: {
    minHeight: 39,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    justifyContent: "flex-end",
  },
  cardActionLabel: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: 20,
    backgroundColor: colors.border,
  },
  skeletonCard: {
    minHeight: 104,
    borderWidth: 0,
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
  saveErrorText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    color: colors.error,
    marginBottom: 16,
    backgroundColor: "#FBE7E5",
    padding: 12,
    borderRadius: radii.sm,
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
    borderRadius: radii.sm,
  },
})
