"use client"

import { useCallback, useState } from "react"

import {
  prepareImageUploads,
  type ImageUploadProgress,
} from "@/lib/image-upload"
import type { ImagePurpose } from "@/types/media"

export function useImageUpload() {
  const [uploadProgress, setUploadProgress] =
    useState<ImageUploadProgress | null>(null)
  const prepareUploads = useCallback(
    (formData: FormData, purpose: ImagePurpose, isCurrent?: () => boolean) => {
      setUploadProgress(null)
      return prepareImageUploads(
        formData,
        purpose,
        setUploadProgress,
        isCurrent
      )
    },
    []
  )

  return { prepareUploads, uploadProgress }
}
