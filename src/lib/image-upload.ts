import { UploadError } from "@/lib/form-utils"
import { prepareBrowserImage } from "@/lib/browser-image"
import { storageUploadUrl } from "@/lib/storage-upload"
import { imageFileSchema } from "@/lib/validation"
import {
  discardProductImageUploadsAction,
  requestImageUploadsAction,
} from "@/modules/media/actions"
import type { ValidationErrors } from "@/types/common"
import type { ImagePurpose, ImageUploadSession } from "@/types/media"

const uploadFallback =
  "Không thể tải ảnh lên. Vui lòng kiểm tra kết nối và thử lại."
export type ImageUploadStage =
  "queued" | "uploading" | "processing" | "complete" | "error"
type FileProgress = {
  stage: ImageUploadStage
  percent: number
  loaded: number
  total: number
}
export type ImageUploadProgress = {
  percent: number
  completed: number
  files: (FileProgress & { name: string; field: string; index: number })[]
}

// Separate limits let a form decode while another uploads, without keeping an
// unbounded number of full camera bitmaps or storage requests alive.
function taskPool(limit: number) {
  let active = 0
  const waiting: (() => void)[] = []
  return async function run<T>(action: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      const enter = () => {
        active++
        resolve()
      }
      if (active < limit) enter()
      else waiting.push(enter)
    })
    try {
      return await action()
    } finally {
      active--
      waiting.shift()?.()
    }
  }
}
const prepareInPool = taskPool(2)
const uploadInPool = taskPool(4)

function uploadImage(
  session: ImageUploadSession,
  file: File,
  field: string,
  fileName: string,
  onProgress: (progress: FileProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = storageUploadUrl(session.url)
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url.href)
    xhr.responseType = "arraybuffer"
    xhr.timeout = 90_000
    xhr.withCredentials = false
    for (const [name, value] of Object.entries(session.headers)) {
      xhr.setRequestHeader(name, value)
    }
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      onProgress({
        stage: "uploading",
        percent: Math.min(
          99,
          30 + Math.floor((event.loaded / event.total) * 69)
        ),
        loaded: event.loaded,
        total: event.total,
      })
    }
    xhr.onerror = () => reject(new Error(uploadFallback))
    xhr.ontimeout = () => reject(new Error(uploadFallback))
    xhr.onabort = () => reject(new Error("Upload aborted"))
    xhr.onload = () => {
      if (xhr.responseURL && xhr.responseURL !== url.href) {
        reject(new Error("Unexpected upload redirect"))
        return
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        let error: { message?: string; errors?: ValidationErrors } | undefined
        if (
          xhr.getResponseHeader("content-type")?.includes("application/json")
        ) {
          try {
            error = JSON.parse(new TextDecoder().decode(xhr.response))
          } catch {
            /* Preserve the upload failure. */
          }
        }
        reject(
          Object.assign(
            imageUploadError(
              field,
              fileName,
              error?.message || uploadFallback,
              error?.errors
            ),
            { status: xhr.status }
          )
        )
        return
      }
      resolve()
    }
    xhr.send(file)
  })
}

function imageUploadError(
  field: string,
  fileName: string,
  message: string,
  errors?: ValidationErrors
): UploadError {
  const messages = errors ? Object.values(errors).flat() : []
  const prefix = fileName ? `${fileName}: ` : ""
  return new UploadError(`${prefix}${message}`, {
    [field]: (messages.length > 0 ? messages : [message]).map(
      (detail) => `${prefix}${detail}`
    ),
  })
}

export async function prepareImageUploads(
  formData: FormData,
  purpose: ImagePurpose,
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<FormData> {
  const entries = Array.from(formData.entries())
  const images = entries.flatMap(([field, value], index) =>
    value instanceof File &&
    (purpose !== "chat" || value.type.startsWith("image/"))
      ? [{ field, file: value, index }]
      : []
  )
  const progress: ImageUploadProgress["files"] = images.map(
    ({ field, file, index }) => ({
      field,
      name: file.name,
      index,
      stage: "queued",
      percent: 0,
      loaded: 0,
      total: file.size,
    })
  )
  const publish = () =>
    onProgress?.({
      percent:
        progress.length === 0
          ? 0
          : Math.floor(
              progress.reduce((sum, file) => sum + file.percent, 0) /
                progress.length
            ),
      completed: progress.filter((file) => file.stage === "complete").length,
      files: progress.map((file) => ({ ...file })),
    })
  publish()
  for (const [position, { field, file }] of images.entries()) {
    const parsed = imageFileSchema("Ảnh không hợp lệ.").safeParse(file)
    if (!parsed.success) {
      Object.assign(progress[position], { stage: "error" })
      publish()
      throw imageUploadError(field, file.name, parsed.error.issues[0].message)
    }
  }
  if (images.length === 0) {
    const payload = new FormData()
    for (const [field, value] of entries) payload.append(field, value)
    return payload
  }
  if (
    images.length > (purpose === "product" ? 51 : purpose === "chat" ? 50 : 1)
  ) {
    throw new UploadError("Số lượng ảnh vượt quá giới hạn cho phép.")
  }

  const processed: File[] = []
  let preparationFailure: Error | undefined
  const preparationOutcomes = await Promise.allSettled(
    images.map(({ field, file }, position) =>
      prepareInPool(async () => {
        if (preparationFailure) return
        try {
          Object.assign(progress[position], { stage: "processing", percent: 0 })
          publish()
          const image = await prepareBrowserImage(file, purpose)
          processed[position] = image
          Object.assign(progress[position], {
            stage: "queued",
            percent: 30,
            total: image.size,
          })
          publish()
        } catch (error) {
          Object.assign(progress[position], { stage: "error" })
          publish()
          preparationFailure ??= imageUploadError(
            field,
            file.name,
            error instanceof Error ? error.message : "Không thể xử lý ảnh."
          )
        }
      })
    )
  )
  if (preparationFailure) throw preparationFailure
  const failedPreparation = preparationOutcomes.find(
    (outcome) => outcome.status === "rejected"
  )
  if (failedPreparation?.status === "rejected") throw failedPreparation.reason

  const sessions = await requestImageUploadsAction(
    purpose,
    processed.map((file) => ({
      size: file.size,
      content_type: file.type,
      filename: file.name,
    }))
  )
  if (!sessions.success || !sessions.data) {
    throw new UploadError(sessions.message || uploadFallback, sessions.errors)
  }
  const sessionData = sessions.data
  const stagedTokens = sessionData.tokens
  const references = new Map<number, string>()
  try {
    if (
      sessionData.uploads.length !== images.length ||
      stagedTokens.length !== images.length
    ) {
      throw new Error("Không thể chuẩn bị đủ phiên tải ảnh.")
    }
    let uploadFailure: unknown
    const outcomes = await Promise.allSettled(
      images.map(({ field, file: original, index }, position) =>
        uploadInPool(async () => {
          if (uploadFailure) return
          const file = processed[position]
          const session = sessionData.uploads[position]
          const update = (update: FileProgress) => {
            Object.assign(progress[position], update)
            publish()
          }
          try {
            for (let attempt = 0; ; attempt++) {
              if (uploadFailure) return
              try {
                update({
                  stage: "uploading",
                  percent: 30,
                  loaded: 0,
                  total: file.size,
                })
                await uploadImage(session, file, field, original.name, update)
                break
              } catch (error) {
                const retryable =
                  error instanceof Error &&
                  (error.message === uploadFallback ||
                    ("status" in error &&
                      [408, 429, 500, 502, 503, 504].includes(
                        Number(error.status)
                      )))
                if (!retryable || attempt >= 2) {
                  update({
                    stage: "error",
                    percent: 30,
                    loaded: 0,
                    total: file.size,
                  })
                  throw error
                }
                await new Promise((resolve) =>
                  setTimeout(resolve, 1000 * (attempt + 1))
                )
              }
            }
            update({
              stage: "complete",
              percent: 100,
              loaded: file.size,
              total: file.size,
            })
          } catch (error) {
            uploadFailure ??= error
            throw error
          }
          references.set(
            index,
            purpose === "product" ? session.token : session.asset_url
          )
        })
      )
    )
    const failed = outcomes.find((outcome) => outcome.status === "rejected")
    if (failed?.status === "rejected") throw failed.reason
  } catch (error) {
    await discardProductImageUploadsAction(stagedTokens, purpose)
    throw error
  }

  const payload = new FormData()
  for (const [index, [field, value]] of entries.entries()) {
    const reference = references.get(index)
    if (reference !== undefined) {
      payload.append(
        purpose === "product"
          ? field === "image"
            ? "primary_image_upload"
            : "gallery_image_uploads"
          : field,
        reference
      )
    } else {
      payload.append(field, value)
    }
  }
  return payload
}
