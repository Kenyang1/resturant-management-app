import { supabase } from "@/lib/supabase"

/** Events the push-dispatch Edge Function knows how to verify and fan out.
 * Mirrors the PushEvent union in supabase/functions/push-dispatch/index.ts. */
export type PushEvent =
  | { type: "task_assigned"; task_id: string }
  | { type: "approval_requested"; request_id: string }
  | { type: "approval_decided"; request_id: string }
  | { type: "low_stock"; item_id: number }

/** Fire-and-forget: the action that triggered the event has already succeeded,
 * so a failed notification should never surface as an error to the user. */
export function dispatchPushEvent(event: PushEvent) {
  supabase.functions
    .invoke("push-dispatch", { body: event })
    .then(({ error }) => {
      if (error) console.warn(`Push dispatch (${event.type}) failed:`, error.message)
    })
    .catch((err) => console.warn(`Push dispatch (${event.type}) failed:`, err))
}
