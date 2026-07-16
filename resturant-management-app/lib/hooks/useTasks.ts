import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"

export type TaskStatus = "pending" | "completed"

/** Row shape from Supabase `tasks`. assigned_to/created_by are auth.users ids —
 * join against useRestaurantMembers() client-side to show a name/avatar.
 * checklist_source is set when a task was bulk-created by "starting" a checklist
 * template (see useChecklistTemplates) — null for a plain, individually-added task. */
export type Task = {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  due_at: string | null
  status: TaskStatus
  completed_at: string | null
  completed_by: string | null
  checklist_source: string | null
  created_by: string
  created_at: string
}

export function useTasks() {
  return useSupabaseTable<Task, Task>({
    table: "tasks",
    select:
      "id, title, description, assigned_to, due_at, status, completed_at, completed_by, checklist_source, created_by, created_at",
    orderBy: "created_at:desc",
    mapRow: (row) => row,
  })
}
