import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"

export type ApprovalStatus = "pending" | "approved" | "rejected"

/** Payload for an expense approval request — mirrors the columns of finance_entries
 * that the decide_approval_request() RPC copies over on approval. */
export type ExpenseRequestPayload = {
  kind: "revenue" | "expense"
  amount: number
  category: string
  notes: string | null
  occurred_on: string
}

/** Row shape from Supabase `approval_requests`. Inserted by any member (their own
 * requests only); decided exclusively through the decide_approval_request() RPC —
 * there is no client-side update path. */
export type ApprovalRequest = {
  id: string
  requested_by: string
  kind: "expense" | "stock_adjustment"
  payload: ExpenseRequestPayload
  status: ApprovalStatus
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

export function useApprovalRequests() {
  const [data, setData] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: qErr } = await supabase
        .from("approval_requests")
        .select("id, requested_by, kind, payload, status, decided_by, decided_at, created_at")
        .order("created_at", { ascending: false })
      if (qErr) throw qErr
      setData((rows ?? []) as ApprovalRequest[])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const submitExpenseRequest = useCallback(
    async (payload: ExpenseRequestPayload) => {
      const { error: err } = await supabase
        .from("approval_requests")
        .insert({ kind: "expense", payload })
      if (err) throw err
      await refetch()
    },
    [refetch]
  )

  const decide = useCallback(
    async (requestId: string, decision: "approved" | "rejected") => {
      const { error: err } = await supabase.rpc("decide_approval_request", {
        request_id: requestId,
        decision,
      })
      if (err) throw err
      await refetch()
    },
    [refetch]
  )

  return { data, loading, error, refetch, submitExpenseRequest, decide }
}
