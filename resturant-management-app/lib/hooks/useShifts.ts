import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

/** Row shape from Supabase `shifts`. Only owners/managers can insert/update/delete
 * (RLS-enforced) — staff can view the schedule but not assign shifts. */
export type Shift = {
  id: string
  user_id: string
  label: string | null
  starts_at: string
  ends_at: string
  created_by: string
  created_at: string
}

export function useShifts() {
  return useSupabaseTable<Shift, Shift>({
    table: "shifts",
    select: "id, user_id, label, starts_at, ends_at, created_by, created_at",
    orderBy: "starts_at:asc",
    mapRow: (row) => row,
  })
}
