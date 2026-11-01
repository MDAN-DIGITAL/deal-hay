import { z } from "zod"
import { apiFetch } from "@/api/client"
import { getAccessToken } from "@/lib/session"

const STORAGE_KEY = "dealhay_wss_session"
const sessionSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.url(),
  expires_at: z.number().int().positive(),
})
export type WssSession = z.infer<typeof sessionSchema>
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

async function ownerFingerprint(token: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  )
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

export function clearWssSession(expectedToken?: string): void {
  if (typeof window === "undefined") return
  if (expectedToken) {
    try {
      if (
        JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null")
          ?.session?.token !== expectedToken
      )
        return
    } catch {
      return
    }
  }
  window.sessionStorage.removeItem(STORAGE_KEY)
}

/** The cache contains only a scoped WSS credential, bound to the current account session. */
export async function cachedWssSession(): Promise<WssSession | null> {
  const account = getAccessToken()
  if (!account || typeof window === "undefined") return null
  try {
    const record = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "null"
    )
    const owner = await ownerFingerprint(account)
    if (getAccessToken() !== account || record?.owner !== owner) return null
    return validateSession(record.session)
  } catch {
    return null
  }
}

export async function getWssSession(force = false): Promise<WssSession> {
  const account = getAccessToken()
  if (!account) throw new Error("Vui lòng đăng nhập lại.")
  const cached = force ? null : await cachedWssSession()
  if (force) clearWssSession()
  if (cached && cached.expires_at * 1000 > Date.now() + 15_000) return cached
  if (pending?.owner === account) return pending.request
  const request = (async () => {
    try {
      const session = validateSession(
        await apiFetch({
          method: "POST",
          path: "/private/realtime/socket-session",
          token: account,
        })
      )
      const owner = await ownerFingerprint(account)
      if (getAccessToken() !== account)
        throw new Error("Phiên đăng nhập đã thay đổi.")
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ owner, session })
      )
      return session
    } catch (error) {
      // A temporary API outage does not invalidate a WSS-owned session.
      if (
        cached &&
        getAccessToken() === account &&
        cached.expires_at * 1000 > Date.now()
      )
        return cached
      throw error
    } finally {
      if (pending?.owner === account) pending = undefined
    }
  })()
  pending = { owner: account, request }
  return request
}

export async function revokeWssSession(): Promise<void> {
  const session = await cachedWssSession()
  if (!session) return
  try {
    await fetch(`${session.url}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    })
  } finally {
    clearWssSession(session.token)
  }
}
