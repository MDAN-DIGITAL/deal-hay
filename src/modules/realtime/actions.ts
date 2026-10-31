import { z } from "zod"
import { apiFetch } from "@/api/client"
import { getRealtimeConfig } from "@/api/chats/queries"
import type { RealtimeConfig } from "@/api/chats/types"

export async function loadRealtimeConfigAction(): Promise<RealtimeConfig | null> {
  try {
    return await getRealtimeConfig()
  } catch {
    return null
  }
}

export async function loadSocketSessionAction() {
  const session = z
    .object({
      token: z.string().min(1).max(4096),
      url: z.url(),
      expires_at: z.number().int().positive(),
    })
    .parse(
      await apiFetch({
        method: "POST",
        path: "/private/realtime/socket-session",
      })
    )
  const url = new URL(session.url)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error("Invalid realtime service URL")
  }
  return session
}
