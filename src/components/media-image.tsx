"use client"

import Image from "next/image"
import { ImageIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { apiAssetUrl, env } from "@/config/env"
import { isPublicMediaAssetUrl } from "@/lib/public-media-url"
import { cn } from "@/lib/utils"

type MediaImageProps = {
  src: string | null | undefined
  alt: string
  className?: string
  imageClassName?: string
  fallbackLabel?: string
  fetchPriority?: "high" | "low" | "auto"
  loading?: "eager" | "lazy"
  retryable?: boolean
  sizes?: string
  onLoad?: () => void
}

export function MediaImage({
  src,
  alt,
  className,
  imageClassName,
  fallbackLabel = "Chưa có ảnh",
  fetchPriority = "auto",
  loading = "lazy",
  retryable = false,
  sizes = "100vw",
  onLoad,
}: MediaImageProps) {
  const normalizedSrc = apiAssetUrl(src?.trim()) || null
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const [retry, setRetry] = useState({ src: "", attempt: 0 })
  const canRenderImage = normalizedSrc !== null && failedSrc !== normalizedSrc
  const loaded = normalizedSrc !== null && loadedSrc === normalizedSrc
  const attempt = retry.src === normalizedSrc ? retry.attempt : 0
  const state = canRenderImage ? (loaded ? "ready" : "loading") : "error"

  const retryImage = () => {
    if (!normalizedSrc) return
    setFailedSrc(null)
    setLoadedSrc(null)
    setRetry({ src: normalizedSrc, attempt: attempt + 1 })
  }

  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      data-image-state={state}
    >
      {canRenderImage ? (
        <>
          {!loaded ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-muted-foreground/10"
            />
          ) : null}
          <Image
            key={`${normalizedSrc}:${attempt}`}
            fill
            unoptimized={!isPublicMediaAssetUrl(normalizedSrc, env.API_URL)}
            alt={alt}
            className={cn(
              "object-cover transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0",
              imageClassName
            )}
            decoding="async"
            fetchPriority={fetchPriority}
            loading={loading}
            sizes={sizes}
            src={normalizedSrc}
            onError={() => setFailedSrc(normalizedSrc)}
            onLoad={() => {
              setLoadedSrc(normalizedSrc)
              onLoad?.()
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-6" />
          <span className="text-xs">{fallbackLabel}</span>
          {retryable && normalizedSrc ? (
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={retryImage}
            >
              Thử tải lại ảnh
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}
