// push-dispatch — Supabase Edge Function (Deno).
//
// Sends Expo push notifications for app events. The client fires an event
// after an action (assigning a task, requesting/deciding an expense approval,
// stock dropping below the threshold); this function then:
//
//   1. Re-reads the referenced row under the CALLER'S OWN JWT — if their RLS
//      can't see it, no notification happens. The client's claim is never
//      trusted; titles/amounts come from the database, not the request body.
//   2. Works out the recipients (assignee, owners/managers, or requester),
//      always excluding the caller themselves.
//   3. Looks up recipients' device tokens with the service-role key — the one
//      elevated step, since push_tokens RLS only lets users see their own —
//      and posts to Expo's push API, pruning tokens Expo reports as dead.
//
// Deploy: supabase functions deploy push-dispatch
// (No extra secrets needed — SUPABASE_SERVICE_ROLE_KEY is provided by the platform.)

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Keep in sync with the low-stock threshold in app/(tabs)/inventory-log.tsx.
const LOW_STOCK_THRESHOLD = 10

type PushEvent =
  | { type: "task_assigned"; task_id: string }
  | { type: "approval_requested"; request_id: string }
  | { type: "approval_decided"; request_id: string }
  | { type: "low_stock"; item_id: number }

type Notification = {
  recipientIds: string[]
  title: string
  body: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Owner/manager user ids for a restaurant, read under the caller's RLS
 * (members can list their own restaurant's members). */
async function managersOf(rls: SupabaseClient, restaurantId: string): Promise<string[]> {
  const { data, error } = await rls
    .from("restaurant_members")
    .select("user_id, role")
    .eq("restaurant_id", restaurantId)
    .in("role", ["owner", "manager"])
  if (error) throw error
  return (data ?? []).map((m) => m.user_id)
}

/** Resolve an event into recipients + message, or null if the referenced row
 * isn't visible to the caller / the event doesn't warrant a notification. */
async function buildNotification(
  rls: SupabaseClient,
  event: PushEvent
): Promise<Notification | null> {
  switch (event.type) {
    case "task_assigned": {
      const { data: task } = await rls
        .from("tasks")
        .select("title, assigned_to, restaurant_id, due_at")
        .eq("id", event.task_id)
        .maybeSingle()
      if (!task?.assigned_to) return null
      return {
        recipientIds: [task.assigned_to],
        title: "New task for you",
        body: task.due_at
          ? `${task.title} — due ${new Date(task.due_at).toLocaleDateString()}`
          : task.title,
      }
    }
    case "approval_requested": {
      const { data: req } = await rls
        .from("approval_requests")
        .select("payload, restaurant_id, status")
        .eq("id", event.request_id)
        .maybeSingle()
      if (!req || req.status !== "pending") return null
      const p = req.payload ?? {}
      return {
        recipientIds: await managersOf(rls, req.restaurant_id),
        title: "Expense approval needed",
        body: `$${Number(p.amount ?? 0).toFixed(2)} — ${p.category ?? "General"}`,
      }
    }
    case "approval_decided": {
      const { data: req } = await rls
        .from("approval_requests")
        .select("payload, requested_by, status")
        .eq("id", event.request_id)
        .maybeSingle()
      if (!req || req.status === "pending") return null
      const p = req.payload ?? {}
      return {
        recipientIds: [req.requested_by],
        title: req.status === "approved" ? "Expense approved" : "Expense rejected",
        body: `$${Number(p.amount ?? 0).toFixed(2)} — ${p.category ?? "General"}`,
      }
    }
    case "low_stock": {
      const { data: item } = await rls
        .from("inventory_log")
        .select("item_name, stock_quantity, restaurant_id")
        .eq("id", event.item_id)
        .maybeSingle()
      // Re-checked server-side so a client can't fire alerts for healthy stock.
      if (!item || item.stock_quantity >= LOW_STOCK_THRESHOLD) return null
      return {
        recipientIds: await managersOf(rls, item.restaurant_id),
        title: item.stock_quantity <= 0 ? "Out of stock" : "Low stock",
        body:
          item.stock_quantity <= 0
            ? `${item.item_name} is out of stock`
            : `${item.item_name}: ${item.stock_quantity} left`,
      }
    }
    default:
      return null
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let event: PushEvent
  try {
    event = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const rls = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  )

  const {
    data: { user },
  } = await rls.auth.getUser()
  if (!user) return json({ error: "Not signed in" }, 401)

  let notification: Notification | null
  try {
    notification = await buildNotification(rls, event)
  } catch (err) {
    console.error("Event verification failed:", err)
    return json({ error: "Could not verify event" }, 500)
  }

  const recipientIds = [
    ...new Set((notification?.recipientIds ?? []).filter((id) => id !== user.id)),
  ]
  if (!notification || recipientIds.length === 0) {
    return json({ sent: 0 })
  }

  // Service role from here down: reading other users' device tokens is the
  // one thing the caller's own JWT rightly cannot do.
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const { data: tokens, error: tokenErr } = await admin
    .from("push_tokens")
    .select("token")
    .in("user_id", recipientIds)
  if (tokenErr) {
    console.error("Token lookup failed:", tokenErr.message)
    return json({ error: "Token lookup failed" }, 500)
  }
  if (!tokens || tokens.length === 0) return json({ sent: 0 })

  const messages = tokens.map((t) => ({
    to: t.token,
    title: notification.title,
    body: notification.body,
    sound: "default",
    data: { event: event.type },
  }))

  // Expo accepts up to 100 messages per request.
  const deadTokens: string[] = []
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    })
    if (!res.ok) {
      console.error("Expo push API error:", res.status, await res.text())
      continue
    }
    const { data: tickets } = await res.json()
    for (let j = 0; j < (tickets ?? []).length; j++) {
      if (tickets[j]?.details?.error === "DeviceNotRegistered") {
        deadTokens.push(chunk[j].to)
      }
    }
  }

  if (deadTokens.length > 0) {
    await admin.from("push_tokens").delete().in("token", deadTokens)
  }

  return json({ sent: messages.length - deadTokens.length })
})
