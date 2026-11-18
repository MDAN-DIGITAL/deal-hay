import { z } from "zod"
import { apiFetch } from "@/api/client"
import { getSessionId } from "@/lib/session"

const sessionSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.url(),
  expires_at: z.number().int().positive(),
})
export type WssSession = z.infer<typeof sessionSchema>
let cached: { owner: string; session: WssSession } | undefined
let pending: { owner: string; request: Promise<WssSession> } | undefined

function validateSession(value: unknown): WssSession {
  const session = sessionSchema.parse(value)
  const url = new URL(session.url)
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
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
        local
      )) ||
    session.expires_at <= Date.now() / 1000 ||
    session.expires_at > Date.now() / 1000 + 86410
  )
    throw new Error("Phiên realtime không hợp lệ hoặc đã hết hạn.")
  return { ...session, url: url.origin }
}

export function clearWssSession(expectedToken?: string): void {
  if (!expectedToken || cached?.session.token === expectedToken)
    cached = undefined
}

export function cachedWssSession(): WssSession | null {
  if (
    !cached ||
    cached.owner !== getSessionId() ||
    cached.session.expires_at * 1000 <= Date.now()
  ) {
    cached = undefined
    return null
  }
  return cached.session
}

export async function getWssSession(force = false): Promise<WssSession> {
  const owner = getSessionId()
  if (!owner) throw new Error("Vui lòng đăng nhập lại.")
  const current = force ? null : cachedWssSession()
  if (force) clearWssSession()
  if (current && current.expires_at * 1000 > Date.now() + 15_000) return current
  if (pending?.owner === owner) return pending.request
  const request = (async () => {
    try {
      const session = validateSession(
        await apiFetch({
          method: "POST",
          path: "/private/realtime/socket-session",
          signal: AbortSignal.timeout(30_000),
        })
      )
      if (getSessionId() !== owner)
        throw new Error("Phiên đăng nhập đã thay đổi.")
      cached = { owner, session }
      return session
    } catch (error) {
      if (current && getSessionId() === owner) {
        const fallback = cachedWssSession()
        if (fallback) return fallback
      }
      throw error
    } finally {
      if (pending?.owner === owner) pending = undefined
    }
  })()
  pending = { owner, request }
  return request
}
