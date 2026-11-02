import { z } from "zod"

import { ApiError, apiFetch } from "@/api/client"
import { wssFetch } from "@/api/wss-client"
import type { ServerResources } from "@/types/server-resources"
import type { SpeedtestTarget } from "@/types/speedtest"

const metric = z.number().finite().nonnegative().nullable()
const text = z.string().max(512).nullable()
const scope = z.enum(["container", "host", "unavailable"])
export const serverResourcesSchema = z.object({
  sampled_at: z.iso.datetime({ offset: true }),
  sample_window_ms: metric,
  instance_id: z.string().min(1).max(256),
  cpu: z.object({
    percent: metric,
    allocated_cores: metric,
    visible_logical_cores: metric,
    model: text,
    scope,
    source: z.string().max(128),
  }),
  memory: z.object({
    used_bytes: metric,
    limit_bytes: metric,
    available_bytes: metric,
    percent: metric,
    scope,
    source: z.string().max(128),
  }),
  disk: z.object({
    used_bytes: metric,
    total_bytes: metric,
    available_bytes: metric,
    percent: metric,
    allocated_bytes: metric,
    scope: z.enum(["filesystem", "unavailable"]),
    source: z.string().max(128),
  }),
  os: z.object({
    name: text,
    platform: z.string().max(128),
    release: text,
    architecture: text,
  }),
  process: z.object({ rss_bytes: metric, uptime_seconds: metric }),
})

export async function loadServerResources(
  target: SpeedtestTarget,
  signal: AbortSignal
): Promise<ServerResources> {
  try {
    signal.throwIfAborted()
    // Credential bootstrap can outlive a screen's deadline. Polling must still
    // settle promptly when the caller aborts, even before a WSS request starts.
    const response = await new Promise<unknown>((resolve, reject) => {
      const abort = () =>
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"))
      signal.addEventListener("abort", abort, { once: true })
      Promise.resolve()
        .then(() => {
          signal.throwIfAborted()
          return target === "backend"
            ? apiFetch({ path: "/diagnostics/resources", signal })
            : wssFetch({ path: "/diagnostics/resources", signal })
        })
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", abort))
    })
    return serverResourcesSchema.parse(response)
  } catch (error) {
    if (signal.aborted) throw error
    if (error instanceof ApiError) {
      if (error.status === 404)
        throw new Error("Máy chủ chưa cập nhật tính năng theo dõi tài nguyên.")
      if (error.status === 401)
        throw new Error(
          "Phiên xác thực máy chủ đã hết hạn. Vui lòng kết nối lại."
        )
      if (error.status === 403)
        throw new Error("Máy chủ chỉ cho phép quản trị viên xem tài nguyên.")
      if (error.status === 429)
        throw new Error("Đã đạt giới hạn làm mới. Vui lòng đợi một lúc.")
    }
    throw new Error(
      "Không lấy được số liệu tài nguyên từ máy chủ. Đang giữ lại mẫu gần nhất nếu có."
    )
  }
}
