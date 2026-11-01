import { IMAGE_OUTPUT_MAX_BYTES, imageFileSchema } from "@/lib/validation"
import type { ImagePurpose } from "@/types/media"

export const imageOutputMaxBytes = () => IMAGE_OUTPUT_MAX_BYTES

const outputFormats = [
  { mime: "image/webp", extension: "webp" },
  { mime: "image/jpeg", extension: "jpg" },
  { mime: "image/png", extension: "png" },
] as const

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      })
      return {
        source: bitmap as CanvasImageSource,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch (error) {
      // Some WebKit versions expose createImageBitmap but reject camera files
      // that the browser's ordinary image decoder can still read.
      if (typeof Image === "undefined") throw error
    }
  }

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
  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  }
}

// Draw into a fresh canvas so the encoded image carries no source metadata.
// Browsers apply EXIF orientation while decoding with imageOrientation.
export async function prepareBrowserImage(
  file: File,
  purpose: ImagePurpose
): Promise<File> {
  imageFileSchema("Ảnh không hợp lệ.").parse(file)
  const { source, width, height, release } = await decodeImage(file)

  let canvas: HTMLCanvasElement | undefined
  try {
    if (
      width < 1 ||
      height < 1 ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
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
    const maxBytes = imageOutputMaxBytes()
    let formatIndex = 0
    while (true) {
      for (; formatIndex < outputFormats.length; formatIndex++) {
        const format = outputFormats[formatIndex]
        targetCanvas.width = targetWidth
        targetCanvas.height = targetHeight
        const context = targetCanvas.getContext("2d")
        if (!context) throw new Error("Thiết bị không hỗ trợ xử lý ảnh.")
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = "high"
        if (format.mime === "image/jpeg") {
          // JPEG has no alpha channel; use a white background for transparent images.
          context.fillStyle = "#ffffff"
          context.fillRect(0, 0, targetWidth, targetHeight)
        }
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
        let supported = true
        const qualities =
          format.mime === "image/png"
            ? [undefined]
            : [0.86, 0.72, 0.58, 0.44, 0.3, 0.16]
        for (const quality of qualities) {
          const blob = await new Promise<Blob | null>((resolve) => {
            try {
              targetCanvas.toBlob(resolve, format.mime, quality)
            } catch {
              resolve(null)
            }
          })
          // Unsupported types can silently return PNG, or fail to encode.
          // Advance to a real encoder instead of relabeling the returned bytes.
          if (!blob || blob.size === 0 || blob.type !== format.mime) {
            supported = false
            break
          }
          if (blob.size <= maxBytes) {
            return new File(
              [blob],
              `${(file.name.replace(/\.[^.]+$/, "") || "image").slice(0, 250)}.${format.extension}`,
              { type: format.mime }
            )
          }
        }
        if (supported) break
      }
      if (formatIndex === outputFormats.length)
        throw new Error("Không thể nén ảnh trên thiết bị này.")
      if (targetWidth === 1 && targetHeight === 1) break
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
