import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/hooks/useSupabaseTable"

export type RestaurantRole = "owner" | "manager" | "staff"

/** Row shape from Supabase `restaurant_members`. Mostly read-only from the client — rows are only
 * ever created via the accept_restaurant_invite() RPC — except avatar_url/display_name, which a
 * member can update on their own row (see updateOwnAvatar below). */
export type RestaurantMember = {
  id: string
  user_id: string
  role: RestaurantRole
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export function useRestaurantMembers() {
  const [data, setData] = useState<RestaurantMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: rows, error: qErr } = await supabase
        .from("restaurant_members")
        .select("id, user_id, role, display_name, avatar_url, created_at")
        .order("created_at", { ascending: true })
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

  // Updates every restaurant_members row belonging to this user (usually just one) so the
  // avatar stays consistent if they're ever a member of more than one restaurant.
  const updateOwnAvatar = useCallback(
    async (userId: string, avatarUrl: string) => {
      const { error: err } = await supabase
        .from("restaurant_members")
        .update({ avatar_url: avatarUrl })
        .eq("user_id", userId)
      if (err) throw err
      await refetch()
    },
    [refetch]
  )

  return { data, loading, error, refetch, updateOwnAvatar }
}
