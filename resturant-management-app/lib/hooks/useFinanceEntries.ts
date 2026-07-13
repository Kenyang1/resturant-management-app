import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

export type FinanceKind = "revenue" | "expense"

/** Row shape used by the Finance screen (after mapping Supabase's raw row). */
export type FinanceEntry = {
  id: number
  kind: FinanceKind
  amount: number
  category: string
  notes: string | null
  occurred_on: string
  created_at: string | null
}

/** Raw row shape from Supabase `finance_entries` (amount may come back as a numeric string). */
type FinanceEntryRow = {
  id: number
  kind: string
  amount: number | string
  category: string | null
  notes: string | null
  occurred_on: string
  created_at: string | null
}

export function useFinanceEntries() {
  return useSupabaseTable<FinanceEntryRow, FinanceEntry>({
    table: "finance_entries",
    select: "id, kind, amount, category, notes, occurred_on, created_at",
    orderBy: "occurred_on:desc,id:desc",
    mapRow: (row) => ({
      id: row.id,
      kind: row.kind as FinanceKind,
      amount: typeof row.amount === "string" ? parseFloat(row.amount) : Number(row.amount),
      category: row.category ?? "General",
      notes: row.notes,
      occurred_on: row.occurred_on,
      created_at: row.created_at,
    }),
  })
}
