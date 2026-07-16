import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"

/** Row shape from Supabase `activity_log`. Read-only — rows are written exclusively by
 * database triggers on inventory_log/management_log/finance_entries; there is no client
 * write path (and no RLS policy that would allow one). */
export type ActivityEntry = {
  id: string
  actor_id: string | null
  table_name: string
  action: "insert" | "update" | "delete"
  record_summary: string
  created_at: string
}

const PAGE_SIZE = 30

export function useActivityLog() {
  const [data, setData] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: qErr } = await supabase
        .from("activity_log")
        .select("id, actor_id, table_name, action, record_summary, created_at")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE)
      if (qErr) throw qErr
      setData(rows ?? [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
