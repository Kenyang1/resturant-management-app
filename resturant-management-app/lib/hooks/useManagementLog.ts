import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

/** Row shape from Supabase `management_log`. */
export type ManagementLogItem = {
  id: number
  title: string
  description: string
  created_at: string | null
}

export function useManagementLog() {
  return useSupabaseTable<ManagementLogItem, ManagementLogItem>({
    table: "management_log",
    select: "id, title, description, created_at",
    orderBy: "id:desc",
    mapRow: (row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      created_at: row.created_at,
    }),
  })
}
