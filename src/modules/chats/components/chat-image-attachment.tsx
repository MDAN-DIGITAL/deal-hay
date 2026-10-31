"use client"

import { useEffect, useState } from "react"
import { FileIcon, PaperclipIcon } from "lucide-react"
import { toast } from "sonner"
import { ImagePreview } from "@/components/image-preview"
import { Button } from "@/components/ui/button"
import { env } from "@/config/env"
import { getAccessToken } from "@/lib/session"

async function loadAttachment(messageId: string, signal?: AbortSignal) {
  const token = getAccessToken()
  if (!token) throw new Error("Vui lòng đăng nhập lại.")
  const response = await fetch(
    `${env.API_URL}/messages/attachments/${encodeURIComponent(messageId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/octet-stream",
      },
      credentials: "omit",
      redirect: "error",
      signal,
    }
  )
  if (!response.ok) throw new Error("Không thể tải tệp đính kèm.")
  return response.blob()
}

export function ChatImageAttachment({
  messageId,
  name,
}: {
  messageId: string
  name: string
}) {
  const [image, setImage] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    void loadAttachment(messageId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ id: messageId, url: objectUrl })
      })
      .catch(() => {})
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [messageId])
  if (!image || image.id !== messageId)
    return <p className="p-2 text-xs text-muted-foreground">Ảnh đính kèm</p>
  return (
    <ImagePreview
      alt={name}
      className="mb-2"
      sizes="256px"
      src={image.url}
      thumbnailClassName="aspect-video w-64 max-w-full rounded-xl"
    />
  )
}

export function DownloadAttachment({
  messageId,
  name,
  image,
}: {
  messageId: string
  name: string
  image: boolean
}) {
  const [loading, setLoading] = useState(false)
  const download = async () => {
    if (loading) return
    setLoading(true)
    try {
      const blob = await loadAttachment(messageId)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = name
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể tải tệp.")
    } finally {
      setLoading(false)
    }
  }
  return (
    <Button
      className="max-w-full"
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={() => void download()}
    >
      {image ? <PaperclipIcon /> : <FileIcon />}
      <span className="max-w-52 truncate">
        {loading ? "Đang tải..." : name}
      </span>
    </Button>
  )
}
