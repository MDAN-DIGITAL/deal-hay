import { saveAccessToken, clearAccessToken } from "@/lib/session"
import type { AuthPayload } from "@/types/auth"
export async function setAuthSession(
  payload: AuthPayload,
  remember = true
): Promise<void> {
  saveAccessToken(payload.token, remember)
}
export async function clearAuthSession(
  expectedToken?: string | null
): Promise<void> {
  clearAccessToken(expectedToken)
}
