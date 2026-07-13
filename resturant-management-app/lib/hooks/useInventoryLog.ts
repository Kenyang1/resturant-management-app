import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

/** Row shape from Supabase `inventory_log`. */
export type InventoryLogItem = {
  id: number
  item_name: string
  stock_quantity: number
  storage_location: string
  cost_per_unit: number
}

export function useInventoryLog() {
  return useSupabaseTable<InventoryLogItem, InventoryLogItem>({
    table: "inventory_log",
    select: "id, item_name, stock_quantity, storage_location, cost_per_unit",
    orderBy: "id:desc",
    mapRow: (row) => ({
      id: row.id,
      item_name: row.item_name,
      stock_quantity: row.stock_quantity,
      storage_location: row.storage_location,
      cost_per_unit: row.cost_per_unit,
    }),
  })
}
