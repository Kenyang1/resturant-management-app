/**
 * Inventory Log tab — CRUD for stock items (name, quantity, location, cost per unit).
 * Search filters the loaded list (name, location, stock, cost) without extra server calls.
 * Data: Supabase table `inventory_log`.
 */
import { MascotBanner } from "@/components/MascotBanner"
import { useMobileLayout } from "@/lib/layout"
import { mascotImages } from "@/lib/mascotImages"
import { supabase } from "@/lib/supabase"
import { colors } from "@/lib/theme"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, StyleSheet, View, ScrollView, Modal, TouchableWithoutFeedback, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Button, Card, Text, TextInput } from "react-native-paper"

/** Row shape from Supabase `inventory_log`. */
type InventoryLogItem = {
  id: number
  item_name: string
  stock_quantity: number
  storage_location: string
  cost_per_unit: number
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

export default function InventoryLog() {
  const { horizontal, scrollBottomPad, tabMascotHeight } = useMobileLayout()
  const [inventoryLog, setInventoryLog] = useState<InventoryLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryLogItem | null>(null)
  const [formItemName, setFormItemName] = useState("")
  const [formStockQuantity, setFormStockQuantity] = useState("")
  const [formStorageLocation, setFormStorageLocation] = useState("")
  const [formCostPerUnit, setFormCostPerUnit] = useState("")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchInventoryLog = useCallback(async () => {
    // Newest rows first; refetch after any insert/update/delete.
    try {
      const { data, error } = await supabase
        .from("inventory_log")
        .select("id, item_name, stock_quantity, storage_location, cost_per_unit")
        .order("id", { ascending: false })

      if (error) throw error
      setInventoryLog(
        data?.map((item) => ({
          id: item.id,
          item_name: item.item_name,
          stock_quantity: item.stock_quantity,
          storage_location: item.storage_location,
          cost_per_unit: item.cost_per_unit,
        })) ?? []
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInventoryLog()
  }, [fetchInventoryLog])

  const filteredLog = useMemo(
    () => inventoryLog.filter((item) => matchesSearch(item, searchQuery)),
    [inventoryLog, searchQuery]
  )

  async function addInventoryLog(
    item_name: string,
    stock_quantity: number,
    storage_location: string,
    cost_per_unit: number
  ) {
    const { error } = await supabase
      .from("inventory_log")
      .insert({ item_name, stock_quantity, storage_location, cost_per_unit })
    if (error) throw error
    await fetchInventoryLog()
  }

  async function updateInventoryLog(
    id: number,
    item_name: string,
    stock_quantity: number,
    storage_location: string,
    cost_per_unit: number
  ) {
    const { error } = await supabase
      .from("inventory_log")
      .update({ item_name, stock_quantity, storage_location, cost_per_unit })
      .eq("id", id)
    if (error) throw error
    await fetchInventoryLog()
  }

  async function deleteInventoryLog(id: number) {
    const { error } = await supabase.from("inventory_log").delete().eq("id", id)
    if (error) throw error
    await fetchInventoryLog()
  }

  function confirmDelete(item: InventoryLogItem) {
    Alert.alert(
      "Delete Entry",
      `Are you sure you want to delete "${item.item_name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteInventoryLog(item.id) },
      ]
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

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
      return (err as { message: string }).message
    }
    return "Failed to save"
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
    try {
      setSaveError(null)
      if (editingItem) {
        await updateInventoryLog(
          editingItem.id,
          formItemName.trim(),
          stockQty,
          formStorageLocation.trim(),
          costPerUnit
        )
      } else {
        await addInventoryLog(
          formItemName.trim(),
          stockQty,
          formStorageLocation.trim(),
          costPerUnit
        )
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
      <View style={[styles.mascotSection, { paddingHorizontal: horizontal }]}>
        <MascotBanner
          source={mascotImages.inventory}
          height={tabMascotHeight}
          accessibilityLabel="Chef cat mascot with kitchen inventory"
        />
      </View>
      <View style={[styles.header, { paddingHorizontal: horizontal }]}>
        <Text style={styles.title} numberOfLines={1}>
          Inventory Log
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
          placeholder="Search name, location, stock, or cost"
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
        {inventoryLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No inventory items yet</Text>
            <Text style={styles.emptySubtext}>Tap "Add Entry" to create one</Text>
          </View>
        ) : filteredLog.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No matching items</Text>
            <Text style={styles.emptySubtext}>Try a different search or clear the filter</Text>
          </View>
        ) : (
          filteredLog.map((item) => (
            <Card key={item.id} style={styles.card} mode="elevated">
              <Card.Content style={styles.cardContent}>
                <Text style={styles.itemTitle}>{item.item_name}</Text>
                <Text style={styles.itemDescription}>
                  Stock: {item.stock_quantity} • Location: {item.storage_location}
                </Text>
                <Text style={styles.itemDate}>${item.cost_per_unit.toFixed(2)} per unit</Text>
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
                {editingItem ? "Edit Entry" : "Add Entry"}
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
    backgroundColor: colors.inventory,
    borderBottomWidth: 4,
    borderBottomColor: colors.inventoryDark,
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
})
