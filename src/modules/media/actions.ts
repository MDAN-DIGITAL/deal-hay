import { z } from "zod"

import { apiFetch, ApiError } from "@/api/client"
import { wssFetch } from "@/api/wss-client"
import { storageUploadUrl } from "@/lib/storage-upload"
import type { ImagePurpose, ImageUploadSession } from "@/types/media"
import type { ActionState } from "@/types/forms"

const sessionSchema = z.object({
  token: z.string().min(1).max(2048),
  url: z.url(),
  headers: z.preprocess(
    // Older API responses encoded an empty PHP header map as [] instead of {}.
    (value) => (Array.isArray(value) && value.length === 0 ? {} : value),
    z.record(z.string(), z.string())
  ),
  asset_url: z.url().max(2048),
  expires_at: z.string().optional(),
})

export async function discardProductImageUploadsAction(
  tokens: string[],
  purpose: ImagePurpose = "product"
) {
  const parsed = z.array(z.string().min(1).max(2048)).max(51).safeParse(tokens)
  if (!parsed.success || parsed.data.length === 0) return
  try {
    await (purpose === "chat" ? wssFetch : apiFetch)({
      method: "DELETE",
      path:
        purpose === "chat"
          ? "/chat-uploads/staged"
          : "/private/uploads/images/staged",
      body: { tokens: parsed.data },
    })
  } catch {
    // Scheduled cleanup removes abandoned uploads if the request fails.
  }
}

export async function requestImageUploadsAction(
  purpose: ImagePurpose,
  uploads: { size: number; content_type: string; filename?: string }[]
): Promise<
  ActionState & { data?: { tokens: string[]; uploads: ImageUploadSession[] } }
> {
  if (
    !z.enum(["avatar", "product", "review", "chat"]).safeParse(purpose).success
  ) {
    return { success: false, message: "Mục đích tải ảnh không hợp lệ." }
  }
  const parsed = z
    .array(
      z.object({
        size: z
          .number()
          .int()
          .min(1)
          .max(20 * 1024),
        content_type: z.literal("image/webp"),
        filename: z.string().min(1).max(255).optional(),
      })
    )
    .min(1)
    .max(purpose === "product" ? 51 : 1)
    .safeParse(uploads)
  if (!parsed.success) {
    return { success: false, message: "Thông tin tải ảnh không hợp lệ." }
  }
  let tokens: string[] = []
  try {
    const response = await (purpose === "chat" ? wssFetch : apiFetch)({
      method: "POST",
      path:
        purpose === "chat" ? "/chat-uploads/images" : "/private/uploads/images",
      body: { purpose, uploads: parsed.data },
    })
    // Retain tokens even if another response field is malformed so reservations
    // can be released instead of unnecessarily consuming the owner's quota.
    const reserved = z
      .object({ uploads: z.array(z.object({ token: z.string() })) })
      .safeParse(response)
    if (reserved.success)
      tokens = reserved.data.uploads.map(({ token }) => token)
    const data = z
      .object({ uploads: z.array(sessionSchema).min(1).max(51) })
      .parse(response)
    if (data.uploads.length !== uploads.length)
      throw new Error("Missing upload sessions")
    for (const upload of data.uploads) {
      storageUploadUrl(upload.url)
      const asset = storageUploadUrl(upload.asset_url)
      if (asset.search) throw new Error("Invalid image reference")
      for (const header of Object.keys(upload.headers)) {
        if (!/^(content-type|x-amz-[a-z0-9-]+)$/i.test(header)) {
          throw new Error("Invalid storage upload header")
        }
      }
    }
    return {
      success: true,
      message: "",
      data: { tokens, uploads: data.uploads },
    }
  } catch (error) {
    await discardProductImageUploadsAction(tokens, purpose)
    return error instanceof ApiError
      ? { success: false, message: error.message, errors: error.errors }
      : {
          success: false,
          message: "Không thể chuẩn bị tải ảnh. Vui lòng thử lại.",
        }
  }
}
