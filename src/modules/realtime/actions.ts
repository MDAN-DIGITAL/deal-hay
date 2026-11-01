import { getRealtimeConfig } from "@/api/chats/queries"
import { getWssSession } from "@/lib/wss-session"
import type { RealtimeConfig } from "@/api/chats/types"

export async function loadRealtimeConfigAction(): Promise<RealtimeConfig | null> {
  try {
    return await getRealtimeConfig()
  } catch {
    return null
  }
}

export async function loadSocketSessionAction(force = false) {
  return getWssSession(force)
}
