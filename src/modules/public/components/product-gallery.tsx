"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon } from "lucide-react"

import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type ProductGalleryProps = {
  name: string
  imageUrl: string | null
  images: Array<{ id: string; image_url: string }>
  videoUrl?: string | null
}

export function ProductGallery({
  name,
  imageUrl,
  images,
  videoUrl,
}: ProductGalleryProps) {
  const gallery = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...(imageUrl ? [{ id: "primary", image_url: imageUrl }] : []),
            ...images,
          ]
            .filter((image) => image.image_url?.trim())
            .map((image) => ({ ...image, image_url: image.image_url.trim() }))
            .map((image) => [image.image_url.trim(), image])
        ).values()
      ),
    [imageUrl, images]
  )
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const activeIndex = Math.max(
    0,
    gallery.findIndex((image) => image.image_url === selectedUrl)
  )
  const activeUrl = gallery[activeIndex]?.image_url ?? null
  const selectAdjacent = (direction: number) => {
    const nextIndex =
      (activeIndex + direction + gallery.length) % gallery.length
    setSelectedUrl(gallery[nextIndex]?.image_url ?? null)
  }
  const handleArrowKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (gallery.length < 2) return
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault()
      selectAdjacent(event.key === "ArrowLeft" ? -1 : 1)
    }
  }
  const navigation =
    gallery.length > 1 ? (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          aria-label="Ảnh sản phẩm trước"
          tooltip="Ảnh sản phẩm trước"
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => selectAdjacent(-1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          aria-label="Ảnh sản phẩm tiếp theo"
          tooltip="Ảnh sản phẩm tiếp theo"
          size="icon-sm"
          type="button"
          variant="outline"
          onClick={() => selectAdjacent(1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    ) : null

  return (
    <div className="min-w-0 space-y-3">
      <Dialog>
        <Card className="gap-0 py-0">
          <CardContent className="relative p-0">
            <MediaImage
              alt={`${name} — ảnh ${activeIndex + 1}`}
              className="aspect-square w-full"
              imageClassName="object-contain"
              fallbackLabel="Không thể tải ảnh sản phẩm"
              fetchPriority="high"
              loading="eager"
              retryable
              sizes="(max-width: 1024px) 100vw, 55vw"
              src={activeUrl}
            />
            {activeUrl ? (
              <DialogTrigger
                render={
                  <Button
                    className="absolute right-3 bottom-3 bg-background/95"
                    size="sm"
                    variant="outline"
                  />
                }
                aria-label={`Phóng to ảnh ${activeIndex + 1} của ${name}`}
              >
                <ZoomInIcon /> Phóng to
              </DialogTrigger>
            ) : null}
          </CardContent>
        </Card>
        <DialogContent
          className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-3 overflow-hidden p-3 sm:max-w-6xl"
          onKeyDown={handleArrowKey}
        >
          <DialogTitle className="line-clamp-3 shrink-0 pr-9 text-base leading-6 [overflow-wrap:anywhere]">
            {name}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Dùng các nút hoặc phím mũi tên để xem ảnh sản phẩm.
          </DialogDescription>
          <MediaImage
            alt={`${name} — ảnh ${activeIndex + 1}`}
            className="h-[min(70dvh,calc(100dvh-12rem))] min-h-0 w-full shrink rounded-lg"
            imageClassName="object-contain"
            fallbackLabel="Không thể tải ảnh sản phẩm"
            loading="eager"
            retryable
            sizes="(max-width: 1200px) 100vw, 1152px"
            src={activeUrl}
          />
          <div className="flex shrink-0 items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              Ảnh {activeIndex + 1} / {gallery.length}
            </p>
            {navigation}
          </div>
        </DialogContent>
      </Dialog>
      {gallery.length > 0 ? (
        <div className="flex items-center justify-between gap-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            Ảnh {activeIndex + 1} / {gallery.length}
          </p>
          {navigation}
        </div>
      ) : null}
      {gallery.length > 1 ? (
        <div
          aria-label="Chọn ảnh sản phẩm"
          className="flex max-w-full gap-2 overflow-x-auto pb-1"
          role="group"
          onKeyDown={handleArrowKey}
        >
          {gallery.map((image, index) => (
            <Button
              key={image.image_url}
              aria-label={`Xem ảnh ${index + 1} của ${name}`}
              aria-pressed={activeUrl === image.image_url}
              className="h-auto w-16 shrink-0 overflow-hidden p-1 sm:w-20"
              type="button"
              variant={activeUrl === image.image_url ? "default" : "outline"}
              onClick={() => setSelectedUrl(image.image_url)}
            >
              <MediaImage
                alt=""
                className="aspect-square w-full rounded-sm"
                imageClassName="object-contain"
                fallbackLabel="Ảnh lỗi"
                fetchPriority="low"
                sizes="80px"
                src={image.image_url}
              />
            </Button>
          ))}
        </div>
      ) : null}
      {videoUrl ? (
        <video
          className="aspect-video w-full rounded-lg bg-black"
          controls
          playsInline
          preload="metadata"
          src={videoUrl}
          aria-label={`Video ${name}`}
        />
      ) : null}
    </div>
  )
}
