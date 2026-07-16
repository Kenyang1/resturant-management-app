import { supabase } from "@/lib/supabase"
import { useSupabaseTable } from "@/lib/hooks/useSupabaseTable"
import { RestaurantRole } from "@/lib/hooks/useRestaurantMembers"

/** Row shape from Supabase `restaurant_invites`. Only owners/managers can insert (RLS-enforced) —
 * accepting one happens via the accept_restaurant_invite() RPC, not a client-side update/delete. */
export type RestaurantInvite = {
  id: string
  email: string
  role: RestaurantRole
  token: string
  status: "pending" | "accepted" | "revoked"
  created_at: string
  expires_at: string
}

const SELECT_COLUMNS = "id, email, role, token, status, created_at, expires_at"

export function useRestaurantInvites() {
  const table = useSupabaseTable<RestaurantInvite, RestaurantInvite>({
    table: "restaurant_invites",
    select: SELECT_COLUMNS,
    orderBy: "created_at:desc",
    mapRow: (row) => row,
  })

  // Bespoke create (rather than the base hook's insert) because the caller needs the
  // new row's token immediately, to build and share the invite link.
  async function createInvite(
    email: string,
    role: Exclude<RestaurantRole, "owner">
  ): Promise<RestaurantInvite> {
    const { data, error } = await supabase
      .from("restaurant_invites")
      .insert({ email, role })
      .select(SELECT_COLUMNS)
      .single()
    if (error) throw error
    await table.refetch()
    return data as RestaurantInvite
  }

  return { ...table, createInvite }
}
