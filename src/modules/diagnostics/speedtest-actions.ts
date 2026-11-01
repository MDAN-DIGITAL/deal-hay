import { getAccessToken } from "@/lib/session"
import { z } from "zod"
import { env } from "@/config/env"
import { ApiError, apiFetch } from "@/api/client"
import { wssFetch } from "@/api/wss-client"
import { clearAuthSession } from "@/lib/auth"
import { getAuthPageHref } from "@/lib/auth-redirect"
import { speedtestEndpointUrl } from "@/modules/diagnostics/lib/speedtest"
import type { SpeedtestSessionResult, SpeedtestTarget } from "@/types/speedtest"

const targetSchema = z.enum(["backend", "wss"])
const grantSchema = z.object({
  target: targetSchema.optional(),
  token: z.string().regex(/^[a-zA-Z0-9]{64}$/),
  expires_at: z.iso.datetime({ offset: true }),
  endpoint_path: z.literal("/diagnostics/speedtest"),
  endpoint_url: z.url().optional(),
  limits: z.object({
    max_download_bytes: z.number().int().positive(),
    max_upload_bytes: z.number().int().positive(),
    max_session_bytes: z.number().int().positive(),
    max_requests: z.number().int().positive(),
  }),
})

export async function startSpeedtestAction(
  target: SpeedtestTarget = "backend"
): Promise<SpeedtestSessionResult> {
  if (!targetSchema.safeParse(target).success)
    return { success: false, message: "Máy chủ đo không hợp lệ." }
  const token = getAccessToken()
  const signInHref = getAuthPageHref("/sign-in", "/diagnostics")
  if (!token) {
    window.location.assign(signInHref)
    return { success: false, message: "Vui lòng đăng nhập lại." }
  }
  try {
    const response = grantSchema.parse(
      await (target === "wss"
        ? wssFetch({
            method: "POST",
            path: "/diagnostics/speedtest/session",
          })
        : apiFetch({
            method: "POST",
            path: "/diagnostics/speedtest/session",
            body: { target },
            token,
            signal: AbortSignal.timeout(10_000),
          }))
    )
    if (
      (response.target !== undefined && response.target !== target) ||
      (target === "wss" && response.target !== "wss")
    )
      throw new Error("Mismatched speedtest target")
    const endpointUrl = speedtestEndpointUrl(
      target,
      target === "backend"
        ? (response.endpoint_url ?? `${env.API_URL}/diagnostics/speedtest`)
        : (response.endpoint_url ?? "")
    )
    return {
      success: true,
      data: {
        target,
        token: response.token,
        endpointUrl,
        expiresAt: response.expires_at,
        limits: response.limits,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (target === "wss")
        return {
          success: false,
          message:
            "Phiên WSS đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại rồi đo lại.",
        }
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
