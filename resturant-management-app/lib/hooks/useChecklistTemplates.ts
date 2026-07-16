import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"

export type ChecklistCategory = "opening" | "closing" | "food_safety" | "other"

export type ChecklistTemplateItem = {
  id: string
  label: string
  position: number
}

/** Row shape from Supabase `checklist_templates`, with its items embedded via the
 * checklist_template_items foreign key relationship (one PostgREST query, no separate fetch). */
export type ChecklistTemplate = {
  id: string
  name: string
  category: ChecklistCategory
  checklist_template_items: ChecklistTemplateItem[]
}

const SELECT = "id, name, category, checklist_template_items(id, label, position)"

export function useChecklistTemplates() {
  const [data, setData] = useState<ChecklistTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: qErr } = await supabase
        .from("checklist_templates")
        .select(SELECT)
        .order("category", { ascending: true })
      if (qErr) throw qErr
      const sorted = (rows ?? []).map((t) => ({
        ...t,
        checklist_template_items: [...t.checklist_template_items].sort((a, b) => a.position - b.position),
      }))
      setData(sorted as ChecklistTemplate[])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Bulk-creates one `tasks` row per template item, tagged with checklist_source
  // so the Tasks screen can group/filter them — reuses the whole Tasks UI for free.
  const startChecklist = useCallback(async (template: ChecklistTemplate, assignedTo: string | null) => {
    if (template.checklist_template_items.length === 0) return
    const payload = template.checklist_template_items.map((item) => ({
      title: item.label,
      assigned_to: assignedTo,
      checklist_source: template.name,
    }))
    const { error: err } = await supabase.from("tasks").insert(payload)
    if (err) throw err
  }, [])

  return { data, loading, error, refetch, startChecklist }
}
