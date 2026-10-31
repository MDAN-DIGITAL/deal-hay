import { getAccessToken } from "@/lib/session"
import { z } from "zod"
import { env } from "@/config/env"
import { ApiError, apiFetch } from "@/api/client"
import { clearAuthSession } from "@/lib/auth"
import { getAuthPageHref } from "@/lib/auth-redirect"
import type { SpeedtestSessionResult } from "@/types/speedtest"

const grantSchema = z.object({
  token: z.string().regex(/^[a-zA-Z0-9]{64}$/),
  expires_at: z.iso.datetime({ offset: true }),
  endpoint_path: z.literal("/diagnostics/speedtest"),
  limits: z.object({
    max_download_bytes: z.number().int().positive(),
    max_upload_bytes: z.number().int().positive(),
    max_session_bytes: z.number().int().positive(),
    max_requests: z.number().int().positive(),
  }),
})

export async function startSpeedtestAction(): Promise<SpeedtestSessionResult> {
  const token = getAccessToken()
  const signInHref = getAuthPageHref("/sign-in", "/diagnostics")
  if (!token) {
    window.location.assign(signInHref)
    return { success: false, message: "Vui lòng đăng nhập lại." }
  }
  try {
    const response = grantSchema.parse(
      await apiFetch({
        method: "POST",
        path: "/diagnostics/speedtest/session",
        token,
      })
    )
    return {
      success: true,
      data: {
        token: response.token,
        endpointUrl: `${env.API_URL}/diagnostics/speedtest`,
        expiresAt: response.expires_at,
        limits: response.limits,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const currentToken = getAccessToken()
      if (currentToken && currentToken !== token) {
        return {
          success: false,
          message: "Phiên đăng nhập đã thay đổi. Vui lòng bắt đầu đo lại.",
        }
      }
      if (currentToken === token) await clearAuthSession()
      window.location.assign(signInHref)
      return { success: false, message: "Vui lòng đăng nhập lại." }
    }
    return {
      success: false,
      message:
        error instanceof ApiError && error.status === 429
          ? "Bạn đã bắt đầu nhiều lượt đo. Vui lòng đợi một phút rồi đo lại."
          : "Không thể bắt đầu đo kết nối đến máy chủ. Vui lòng thử lại.",
    }
  }
}
