import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

/** Row shape from Supabase `shift_handoffs`. Any restaurant member can read/write, same
 * permission pattern as tasks — this is meant to be a quick shared note feed, not gated. */
export type ShiftHandoff = {
  id: string
  author_id: string
  note: string
  resolved: boolean
  created_at: string
}

export function useShiftHandoffs() {
  return useSupabaseTable<ShiftHandoff, ShiftHandoff>({
    table: "shift_handoffs",
    select: "id, author_id, note, resolved, created_at",
    orderBy: "created_at:desc",
    mapRow: (row) => row,
  })
}
