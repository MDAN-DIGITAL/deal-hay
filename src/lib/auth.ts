import { saveAccessToken, clearAccessToken } from "@/lib/session"
import type { AuthPayload } from "@/types/auth"
export async function setAuthSession(payload: AuthPayload): Promise<void> {
  saveAccessToken(payload.token)
}
export async function clearAuthSession(): Promise<void> {
  clearAccessToken()
}
