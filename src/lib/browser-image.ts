import { imageFileSchema } from "@/lib/validation"
import type { ImagePurpose } from "@/types/media"

export const imageOutputMaxBytes = (purpose: ImagePurpose) =>
  (purpose === "product" ? 512 : 20) * 1024

// Draw into a fresh canvas so the encoded image carries no source metadata.
// Browsers apply EXIF orientation while decoding with imageOrientation.
export async function prepareBrowserImage(
  file: File,
  purpose: ImagePurpose
): Promise<File> {
  imageFileSchema("Ảnh không hợp lệ.").parse(file)
  let source: CanvasImageSource
  let width: number
  let height: number
  let release: () => void
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    })
    source = bitmap
    width = bitmap.width
    height = bitmap.height
    release = () => bitmap.close()
  } else {
    const url = URL.createObjectURL(file)
    const image = new Image()
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("Không thể đọc ảnh đã chọn."))
        image.src = url
      })
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    source = image
    width = image.naturalWidth
    height = image.naturalHeight
    release = () => URL.revokeObjectURL(url)
  }

  let canvas: HTMLCanvasElement | undefined
  try {
    if (
      width < 1 ||
      height < 1 ||
      width * height > 40_000_000 ||
      width > 32768 ||
      height > 32768
    ) {
      throw new Error("Kích thước ảnh quá lớn hoặc không hợp lệ.")
    }
    const targetCanvas = document.createElement("canvas")
    canvas = targetCanvas
    const cropSize = Math.min(width, height)
    const sourceWidth = purpose === "avatar" ? cropSize : width
    const sourceHeight = purpose === "avatar" ? cropSize : height
    const offsetX = (width - sourceWidth) / 2
    const offsetY = (height - sourceHeight) / 2
    const maxEdge = purpose === "avatar" ? 640 : 1280
    const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight))
    let targetWidth = Math.max(1, Math.round(sourceWidth * scale))
    let targetHeight = Math.max(1, Math.round(sourceHeight * scale))
    const maxBytes = imageOutputMaxBytes(purpose)
    for (let resize = 0; resize < 12; resize++) {
      targetCanvas.width = targetWidth
      targetCanvas.height = targetHeight
      const context = targetCanvas.getContext("2d")
      if (!context) throw new Error("Thiết bị không hỗ trợ xử lý ảnh.")
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(
        source,
        offsetX,
        offsetY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      )
      for (const quality of [0.86, 0.72, 0.58, 0.44]) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          targetCanvas.toBlob(
            (output) =>
              output
                ? resolve(output)
                : reject(new Error("Không thể nén ảnh trên thiết bị này.")),
            "image/webp",
            quality
          )
        })
        if (blob.type !== "image/webp") {
          throw new Error("Trình duyệt chưa hỗ trợ tạo ảnh WebP.")
        }
        if (blob.size > 0 && blob.size <= maxBytes) {
          return new File(
            [blob],
            `${(file.name.replace(/\.[^.]+$/, "") || "image").slice(0, 250)}.webp`,
            {
              type: "image/webp",
            }
          )
        }
      }
      if (targetWidth <= 64 && targetHeight <= 64) break
      targetWidth = Math.max(1, Math.floor(targetWidth * 0.75))
      targetHeight = Math.max(1, Math.floor(targetHeight * 0.75))
    }
    throw new Error("Không thể nén ảnh tới dung lượng cho phép.")
  } finally {
    release()
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
  }
}
