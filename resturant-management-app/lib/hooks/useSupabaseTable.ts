/**
 * Generic Supabase table hook: fetch, insert, update, delete, all wired to a
 * single `data`/`loading`/`error` state and a shared refetch-after-mutation flow.
 * Table screens (inventory, management, finance) each wrap this with their own
 * column selection and row mapping — see lib/hooks/useInventoryLog.ts etc.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message
  }
  return "Something went wrong"
}

type UseSupabaseTableOptions<Row, T> = {
  table: string
  select: string
  /** Comma-separated "column:asc" or "column:desc" pairs, applied in order. */
  orderBy: string
  mapRow: (row: Row) => T
}

export function useSupabaseTable<Row, T extends { id: number }>(
  options: UseSupabaseTableOptions<Row, T>
) {
  const { table, select, orderBy } = options
  // mapRow is often an inline arrow function that's a new reference every render;
  // keeping it in a ref (instead of a useCallback dep) avoids refiring the fetch effect.
  const mapRowRef = useRef(options.mapRow)
  mapRowRef.current = options.mapRow

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from(table).select(select)
      for (const clause of orderBy.split(",")) {
        const [column, direction] = clause.split(":")
        query = query.order(column, { ascending: direction !== "desc" })
      }
      const { data: rows, error: qErr } = await query
      if (qErr) throw qErr
      setData((rows ?? []).map((row) => mapRowRef.current(row as Row)))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [table, select, orderBy])

  useEffect(() => {
    refetch()
  }, [refetch])

  const insert = useCallback(
    async (payload: Record<string, unknown>) => {
      const { error: err } = await supabase.from(table).insert(payload)
      if (err) throw err
      await refetch()
    },
    [table, refetch]
  )

  const update = useCallback(
    async (id: number, payload: Record<string, unknown>) => {
      const { error: err } = await supabase.from(table).update(payload).eq("id", id)
      if (err) throw err
      await refetch()
    },
    [table, refetch]
  )

  const remove = useCallback(
    async (id: number) => {
      const { error: err } = await supabase.from(table).delete().eq("id", id)
      if (err) throw err
      await refetch()
    },
    [table, refetch]
  )

  return { data, loading, error, refetch, insert, update, remove }
}
