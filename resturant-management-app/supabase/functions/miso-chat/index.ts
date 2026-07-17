// Miso chat — Supabase Edge Function (Deno).
//
// Answers questions about the caller's restaurant by fetching their data
// under their own JWT (so row-level security decides what Miso can see) and
// passing it as context to Claude. Deploy with:
//
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy miso-chat
//
// JWT verification is left ON (the default), so only signed-in app users can
// call this function.

import Anthropic from "npm:@anthropic-ai/sdk"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

type ChatTurn = { role: "user" | "assistant"; content: string }

const MAX_TURNS = 20
const MAX_TURN_CHARS = 2000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  let turns: ChatTurn[]
  try {
    const body = await req.json()
    turns = (body.messages ?? []).filter(
      (t: ChatTurn) =>
        (t.role === "user" || t.role === "assistant") && typeof t.content === "string"
    )
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  if (turns.length === 0 || turns[turns.length - 1].role !== "user") {
    return json({ error: "messages must end with a user turn" }, 400)
  }
  turns = turns
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_TURN_CHARS) }))
  // The API requires the first turn to be from the user; trimming history can
  // leave an assistant turn first, so drop any leading assistant turns.
  while (turns.length > 0 && turns[0].role !== "user") turns.shift()

  // A client scoped to the caller's JWT: every query below runs under RLS,
  // so Miso can only read what this signed-in member can read.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return json({ error: "Not signed in" }, 401)

  const [inventory, management, finance, tasks, members] = await Promise.all([
    supabase
      .from("inventory_log")
      .select("item_name, stock_quantity, storage_location, cost_per_unit")
      .order("id", { ascending: false })
      .limit(100),
    supabase
      .from("management_log")
      .select("title, description, created_at")
      .order("id", { ascending: false })
      .limit(40),
    supabase
      .from("finance_entries")
      .select("kind, amount, category, notes, occurred_on")
      .order("occurred_on", { ascending: false })
      .limit(120),
    supabase
      .from("tasks")
      .select("title, description, assigned_to, due_at, status, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("restaurant_members").select("user_id, role, display_name"),
  ])

  const queryError =
    inventory.error ?? management.error ?? finance.error ?? tasks.error ?? members.error
  if (queryError) {
    console.error("Data fetch failed:", queryError.message)
    return json({ error: "Could not load restaurant data" }, 500)
  }

  // Replace member ids with display names so the model never sees raw UUIDs.
  const nameById = new Map(
    (members.data ?? []).map((m) => [m.user_id, m.display_name ?? "Unknown"])
  )
  const tasksForModel = (tasks.data ?? []).map((t) => ({
    ...t,
    assigned_to: t.assigned_to ? (nameById.get(t.assigned_to) ?? "Unknown") : null,
  }))

  const system = `You are Miso, the friendly in-app assistant for a small restaurant's management app.
Answer the team member's questions using ONLY the restaurant data provided below.
Be concise and concrete — a short paragraph or a few bullet points, no headers.
Amounts are in dollars. When totalling or comparing numbers, compute carefully.
If the data doesn't contain the answer, say so plainly rather than guessing.

Today's date: ${new Date().toISOString().slice(0, 10)}

INVENTORY (current stock):
${JSON.stringify(inventory.data)}

MANAGEMENT LOG (recent notes, incidents, maintenance):
${JSON.stringify(management.data)}

FINANCE ENTRIES (recent revenue and expenses):
${JSON.stringify(finance.data)}

TASKS (recent, includes pending and completed):
${JSON.stringify(tasksForModel)}

TEAM: ${JSON.stringify((members.data ?? []).map((m) => ({ name: m.display_name, role: m.role })))}`

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! })

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-4-8",
      // Chat-bubble answers are deliberately short; adaptive thinking at low
      // effort keeps replies snappy while still handling "total my expenses"
      // style arithmetic.
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system,
      messages: turns,
    })

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim()

    if (!reply) return json({ error: "Miso couldn't answer that one" }, 502)
    return json({ reply })
  } catch (err) {
    console.error("Claude request failed:", err)
    return json({ error: "Miso is unavailable right now" }, 502)
  }
})
